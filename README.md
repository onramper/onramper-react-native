# @onramper/onramper-react-native

React Native wrapper for the Onramper iOS SDK.

> **iOS only.** Constructing an `OnramperClient` on a non-iOS platform throws immediately with a clear "iOS-only in this release" error. A native Android SDK is not part of this release, and no Android native code is shipped.

## Install

```bash
npm install @onramper/onramper-react-native react-native-nitro-modules
cd ios && pod install
```

Requires React Native 0.79+, `react-native-nitro-modules` 0.35+, the **New Architecture**, and an iOS **16.0+** deployment target. Works in **bare React Native (no Expo required)** and **Expo** apps — not Expo Go, since the package vendors a native binary.

**Expo apps** — add the bundled config plugin to `app.json`, then prebuild:

```json
{ "expo": { "plugins": ["@onramper/onramper-react-native"] } }
```

The plugin applies the required iOS build flag (it does not change your deployment target). Set your app's deployment target to **16.4+** — Expo SDK 56's own minimum (bare RN only needs 16.0). For bare-RN Podfile setup (Xcode 16+/26) and full details, see the [integration guide](docs/GETTING_STARTED.md).

## Quick start

```ts
import { OnramperClient } from '@onramper/onramper-react-native';

const client = new OnramperClient({
  apiKey: 'pk_live_...',
  clientId: '01K...',
  environment: 'production',
  // Fully async — fetch fresh credentials when the SDK asks.
  onSessionExpired: async () => {
    const r = await fetch('/api/onramper-session', { method: 'POST' });
    return r.json();
  },
});

await client.initialize({ sessionId, sessionToken });

const { button, quote } = await client.getCheckoutRequirements({
  source: 'usd',
  destination: 'eth',
  amount: 100,
  type: 'buy',
  paymentMethod: 'creditcard',
  wallet: { network: 'ethereum', address: '0x...' },
});

return (
  <View>
    <Text>Rate: {quote.rate}</Text>
    {button}
  </View>
);
```

The button renders natively and presents login + payment sheets internally. ToS is rendered inside the button view, and the button sizes its own height to fit it — don't give its container a fixed height.

Already know the user? Pass a third `prefill` argument (`email`, `firstName`, `lastName`, `phoneNumber` — all optional) to have the OnramperID screens arrive pre-populated. It's best-effort and never blocks sign-in. See [prefilling known user values](docs/GETTING_STARTED.md#prefilling-known-user-values) — note the caveat on `email` before supplying it.

## Checkout events

The SwiftUI `OnramperCheckoutButton` does not expose external callback hooks; checkout outcomes flow via the module-level event stream:

```ts
import { OnramperError } from '@onramper/onramper-react-native';

const onFinalized = client.addEventListener('checkoutFinalized', ({ response }) => {
  // Durable transaction identifier: store this for support/reconciliation.
  persistTransactionId(response.onramperTransactionId);
});

const unsub = client.addEventListener('completed', (e) => {
  console.log('done:', e.checkoutId);
});

const onFailed = client.addEventListener('failed', (e) => {
  const failure = OnramperError.from(e.error);
  showError(failure.userMessage, failure.supportCode);
});
```

`checkoutStarted.intentId` and `completed.checkoutId` identify an attempt, while
`onramperTransactionId` identifies the transaction and is available before payment rendering.
`client.currentTransactionId` mirrors the same value; `reset()` clears it.

`paymentPending` means accepted but awaiting settlement. Show processing and track
`currentTransactionId`; do not treat it as completion or automatically restart payment.
When MoonPay has no payment disclosures to show, Buy goes straight to the native
Apple Pay sheet; the payment sheet stays invisible until it is needed, and your
screen can't present its own modal meanwhile.
The native button also handles MoonPay onboarding and 3-D Secure. Observe
`customerOnboardingRequired`, `challengeStarted`, and `challengeCompleted` for progress.
These events do not establish payment success. All flows still require backend webhooks.

## Error handling

All native errors arrive as `OnramperError` with a typed `code`:

```ts
import { OnramperError } from '@onramper/onramper-react-native';

try {
  await client.initialize({ sessionId, sessionToken });
} catch (e) {
  if (e instanceof OnramperError) {
    switch (e.code) {
      case 'deviceBlocked':
      case 'amountOutOfRange':
      // ...
    }
  }
}
```

Use `error.userMessage` for customer copy and `error.supportCode` for support.
`paymentFailed` confirms payment failure; `providerFailed` does not confirm the
payment outcome. The same fields survive native Promise rejections and failed events.
Full code list in `src/errors.ts`.

## Client lifecycle

Each client keeps only its latest unmounted checkout button. A new
`getCheckoutRequirements()` call, `reset()`, or `signOut()` invalidates older
preparations; an in-flight request that becomes obsolete rejects with
`intentInvalidated`. When replacing a quote, remove the previous button and
ignore that obsolete request's rejection while waiting for the current request.
Do not treat it as a payment failure. Other clients are unaffected.

Call `destroy()` when disposing of a client and unmount its checkout button.
Repeated destruction is safe. Further operations reject with `clientDestroyed`;
new listener subscriptions throw the same typed error. Pending results and late
callbacks cannot update the destroyed JS client. Create a new `OnramperClient`
to start again; calling `initialize()` on a destroyed instance does not revive it.

These rules release local prepared views; they do not cancel an already submitted
payment or guarantee cancellation of a request already sent to the backend.

When your app's signed-in user changes, call `signOut()`, then `destroy()` the
client and create and initialize a new `OnramperClient` with a session minted for
the new user. Without `signOut()`, an existing OnramperID login on the device wins
and the next checkout reuses the previous user's account.

## Trusted partner login

If your backend has already verified the user's email, add `user: { email }` to
its signed `client-sessions` request. On Buy, the user is signed in to OnramperID
without the email OTP — with no login UI at all, or only the "additional info"
form when profile fields are missing. No JavaScript changes are needed; it is
enabled per integration by Onramper and falls back to the normal OTP sign-in on
any failure. Available with RN package 1.4.0 or newer. See
[Backend session endpoint](docs/BACKEND_SESSION_ENDPOINT.md#trusted-partner-login).

## Stripe checkout (experimental)

iOS, from package 1.5.0: **USD to USDC on Solana, Ethereum or Base, paid with Apple Pay, for customers in the US outside New York, up to 100 USD per purchase before fees.** It is off until your app turns it on, and Stripe and Onramper must have set it up for your app first (talk to your Onramper contact).

1. **Capabilities.** Add **Apple Pay** with the merchant ID set up with Stripe, and **App Attest** (`com.apple.developer.devicecheck.appattest-environment` = `production`). Stripe requires app attestation, so it doesn't run in the Simulator.
2. **Turn it on** once, before the first checkout:

   ```ts
   await client.enableStripeCheckout({
     merchantIdentifier: 'merchant.com.yourcompany.app',
     merchantName: 'Your App', // optional; Apple Pay shows "Your App (through Stripe)"
   });
   ```

   Without it, a request for `['stripe']` runs the regular checkout.
3. **Request it** with `onlyOnramps: ['stripe']`:

   ```ts
   const { button, quote } = await client.getCheckoutRequirements({
     source: 'usd',
     destination: 'usdc_solana', // or usdc_ethereum, usdc_base
     amount: 25,                 // USD before fees, at most 100, at most 2 decimals
     type: 'buy',
     country: 'us',              // optional, derived from the request IP if omitted
     subdivision: 'us-ca',       // optional; New York is not supported
     paymentMethod: 'applepay',
     wallet: { network: 'solana', address: userWalletAddress },
     onlyOnramps: ['stripe'],
   });
   ```

   The wallet network must match the destination network. Inputs this checkout can't handle reject with an `OnramperError` (`invalidRequest` or `amountOutOfRange`) before anything is sent.
4. **Show the total.** `amount` and `quote.rate` exclude fees; `quote.payout` is the USDC the user receives, and the total Apple Pay will charge is `quote.providerContext?.sourceTotalAmount` (a string such as `"25.83"`).
5. **What the user sees.** After Buy: OnramperID sign-in as usual, then the Apple Pay sheet opens on its own. First-time users then create or sign in to a Link account (Stripe's checkout account) and may be asked to verify their identity. The checkout sheet stays invisible until a step needs it; meanwhile your screen can't present its own modal.
6. **Outcome.** Same states and events as other providers, except that a Stripe checkout reports `paymentPending` once paid and then `completed` when the USDC is delivered. For Stripe, `paymentPending` is not final.

**Stripe's iOS SDK.** From 1.5.0 the pod depends on Stripe's iOS SDK 26.15.1 (exact), which Stripe publishes through Swift Package Manager only. `pod install` adds it with React Native's `spm_dependency` helper, so your Podfile needs nothing beyond the standard `react_native_post_install`. It is built for every app, even one that never calls `enableStripeCheckout`. **Apps that already include Stripe's iOS SDK another way (for example through `@stripe/stripe-react-native`, which uses Stripe's CocoaPods) can't use 1.5.0 yet**: the app would contain Stripe's modules twice. Talk to your Onramper contact.

## Diagnostic logs

Pass `logLevel: 'info'` (or `'debug'`) and `logHandler: record => yourStore.append(record)`
to receive structured `OnramperLogRecord`s in JavaScript. Native Console output is
preserved. Logging defaults to off; storage and export are owned by your app.
The bare demo records by default: Settings → Diagnostic logs lists daily files
with previews, individual sharing, and confirmed deletion.
See [debugging](docs/DEBUGGING.md) for the record shape and retention guidance.

For migration details, including new enum cases and one-time OnramperID sign-in,
see [1.3.0 release notes](CHANGELOG.md#130).

## Runtime SDK version

Read `OnramperClient.sdkVersion` to identify the native iOS SDK loaded by the app:

```ts
import { OnramperClient } from '@onramper/onramper-react-native';

const sdkVersion = OnramperClient.sdkVersion; // e.g. "1.3.1"
```

This is a synchronous, read-only property. It needs no client instance, API key,
SDK session, or initialization. Use it in diagnostics and support screens;
read the RN package version separately from its `package.json`. Wrapper-only
releases can have a different version from their bundled native SDK.

Available on iOS with RN package 1.3.1 or newer. Run `pod install` and rebuild the
native app after upgrading; a JavaScript-only update cannot add the native getter.

## Versioning

`@onramper/onramper-react-native@X.Y.Z` always bundles `OnramperSDK@X.Y.Z` (iOS). Wrapper-only patches are published as `X.Y.Z-N` pre-releases (`npm install @onramper/onramper-react-native@next` to opt in).

## Privacy manifest

The vendored `OnramperSDK.xcframework` already ships its own `PrivacyInfo.xcprivacy`. Don't add a duplicate.

## Known limitations

- Native checkout outcomes are observed via the module-level event stream (`client.addEventListener(...)`); the native checkout button exposes no per-instance callbacks.

## Troubleshooting

- **`pod install` fails finding the xcframework** — confirm `node_modules/@onramper/onramper-react-native/ios/Frameworks/OnramperSDK.xcframework/` exists.
- **`pod install` fails with "needs React Native's spm_dependency helper"** — your Podfile must `require` React Native's `react_native_pods` script and call `react_native_post_install(installer, ...)` in `post_install`, as the React Native and Expo templates do. That helper adds Stripe's iOS SDK (Swift Package Manager) to the pod.
- **`[SPM] WARNING!!! ... with static linking, this might cause linker errors`** during `pod install` — React Native prints this for any pod with Swift package dependencies. Static linking (the default) is what we build and test with; you can ignore it unless your app build reports linker errors.
- **Bare RN build fails with `module map file ... not found` (Xcode 16+/26)** — disable explicit Swift modules in your `Podfile` `post_install` (`SWIFT_ENABLE_EXPLICIT_MODULES = NO`). Expo apps get this automatically via the config plugin. See the [integration guide](docs/GETTING_STARTED.md).
- **App Attest errors in simulator** — expected. App Attest only works on real devices. The SDK surfaces this as `attestationFailed`.
- **Buttons appear but sheets don't open** — the host RN screen must be inside a normal `UIViewController` (the default). Modal-presented screens may need extra care; report an issue with a repro.
