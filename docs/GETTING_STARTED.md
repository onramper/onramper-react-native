A consumer-facing guide to embedding the Onramper Headless solution in a React Native app via this wrapper.

---

## At a glance

Three calls and a native button — no checkout UI, ToS screen, or login flow to build:

```ts
const client = new OnramperClient({ apiKey, clientId, environment, onSessionExpired });

await client.initialize({ sessionId, sessionToken });            // 1. bootstrap

const { button, quote } = await client.getCheckoutRequirements({ // 2. priced quote + Buy button
  source: 'usd', destination: 'sol', amount: 100,
  type: 'buy', paymentMethod: 'applepay',
  wallet: { network: 'solana', address: 'Br2j...' },
});

client.addEventListener('completed', (e) => console.log(e.checkoutId)); // 3. outcome

return <View><Text>≈ {quote.payout} SOL</Text>{button}</View>;
```

---

## Why this wrapper

Ship fully compliant, aggregated headless onramping without building the hard parts. 

Terms-of-Service consent, KYC, token refresh, and the Apple Pay / card payment surface are all owned by the Headless Wrapper — you **wire up three calls and render a native Buy button**. No checkout UI, no PII to hold, no auth plumbing to maintain.

➡️ **See [what this wrapper does for you](doc:what-this-kit-does)** — the full list of what you get out of the box, and how a checkout flows end to end.

---

## What kind of app can use this?

The wrapper is built with **Nitro Modules** and requires React Native's **New Architecture** (the default on the versions it targets). There is **no Expo Modules dependency** — it works in a plain bare React Native app as well as an Expo app:

| You have… | What you need to do |
|---|---|
| **A bare React Native app** (no Expo) | `npm install @onramper/react-native react-native-nitro-modules`, apply the iOS build settings, then `pod install` ([iOS build setup](doc:ios-build-setup)). |
| **An Expo app** (prebuild / CNG) | `npm install @onramper/react-native react-native-nitro-modules`, add the bundled config plugin to `app.json` `plugins`, then `npx expo prebuild` — the plugin applies the iOS build settings for you. |

No `install-expo-modules` step and no AppDelegate changes are required. Not compatible with Expo Go (the package vendors a native binary).

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| iOS | 16.0+ | The package's floor (bare RN). **Expo SDK 56 apps require 16.4** — Expo's own minimum. |
| React Native | 0.79+ | With the New Architecture enabled |
| New Architecture | Required | Nitro Modules run on the New Architecture only |
| `react-native-nitro-modules` | 0.35+ | Peer dependency — the package's native bridge is built with Nitro |
| Node | 22.11.0+ | |
| Xcode | 16+ (Xcode 26 tested) | |
| Real iOS device | Required for App Attest | Simulator can launch but attestation returns `attestationFailed` |
| Apple Developer account | Required for signing | Free or paid; needs the App Attest capability under your team |

---

## 1. Install

```bash
npm install @onramper/react-native react-native-nitro-modules
```

`react-native-nitro-modules` is a peer dependency — install it in your app. The native binary (`OnramperSDK.xcframework`) and the Nitro module autolink in during `pod install`. Ensure the **New Architecture** is enabled (the default on RN 0.76+).

**Expo apps** — add the bundled config plugin so prebuild applies the iOS build settings automatically:

```json
{ "expo": { "plugins": ["@onramper/react-native"] } }
```

Set your app's iOS deployment target to **16.4+** — Expo SDK 56's own minimum (e.g. `ios.deploymentTarget` in `app.json`). Then run `npx expo prebuild` followed by `npx expo run:ios`. You can skip the [iOS build setup](doc:ios-build-setup) — the plugin applies the required build flag for you.

---

## 2. iOS build setup

The iOS build settings, App Attest capability, first build, and Metro configuration live in a dedicated guide:

➡️ **[iOS build setup](doc:ios-build-setup)**

Cover it before your first build, then return here for usage. (Expo apps get the iOS build settings from the config plugin in §1 — see the guide for what the plugin applies.)

---

## 3. How to use

### 3.1 Concepts: the checkout flow & OnramperID

For a step-by-step walkthrough of how a checkout flows through the wrapper, and what OnramperID is, see ➡️ **[What this wrapper does](doc:what-this-kit-does)**.

### 3.2 Constructing the client

```ts
import { OnramperClient } from '@onramper/react-native';

const client = new OnramperClient({
  apiKey: 'pk_live_...',           // your partner API key
  clientId: '01K...',              // your partner client ID
  environment: 'production',       // or 'development' for staging Onramper backend
  theme: 'system',                 // 'system' | 'light' | 'dark'
  logLevel: 'off',                 // 'off' | 'error' | 'info' | 'debug'

  // The Headless Wrapper calls this when its session needs to be re-bootstrapped.
  // Return a fresh { sessionId, sessionToken } pair from your backend;
  // the Headless Wrapper re-runs the bootstrap and silently retries the in-flight
  // request — your user sees no error.
  //
  // This fires *rarely*: the Headless Wrapper refreshes its session token proactively
  // (≤60s before expiry) and reactively (on 401), with single-flight
  // coalescing. `onSessionExpired` is only invoked when the refresh
  // token itself has been revoked or rotated out of acceptance.
  onSessionExpired: async () => {
    const r = await fetch('https://api.yourapp.com/onramper-session', {
      method: 'POST',
      headers: { authorization: `Bearer ${userJWT}` },
    });
    return r.json(); // must return { sessionId, sessionToken }
  },
});

// Bootstrap. Pass the initial session you minted before app launch.
await client.initialize({ sessionId, sessionToken });
```

If your backend is unreachable when the Headless Wrapper calls `onSessionExpired`, throw or reject — the Headless Wrapper surfaces it as `OnramperError` with code `userTokenRefreshFailed` (or `initializationFailed` if the failure happens during `initialize`).

### 3.3 Requesting the checkout button

```ts
const { button, quote } = await client.getCheckoutRequirements(
  {
    source: 'usd',
    destination: 'sol',
    amount: 100,
    type: 'buy',
    paymentMethod: 'applepay',
    wallet: { network: 'solana', address: 'Br2j...' },
  },
  {
    backgroundColor: '#0A84FF',
    foregroundColor: '#FFFFFF',
    borderRadius: 12,
  },
);

// `button` is a ready-to-render React element. Drop it anywhere in your tree.
return (
  <View>
    <Text>Rate: {quote.rate ?? 'unavailable'}</Text>
    <Text>Payout: {quote.payout ?? 'unavailable'}</Text>
    {button}
  </View>
);
```

The Buy button renders natively (SwiftUI under the hood) and presents OIDC login + payment webview sheets internally. Terms-of-service text appears below the button automatically.

When the user taps **Buy**, the button:

1. Records the Terms-of-Service consent timestamp.
2. Presents the OnramperID login sheet, if required by the provider.
3. Finalizes the transaction.
4. Presents the appropriate payment view (Apple Pay, card, etc. — chosen automatically based on the onramp's response).

If the user's OnramperID session expires mid-checkout, the button automatically re-presents the login sheet — the user signs in again and the checkout resumes from where it was.

### 3.4 Observing outcomes

The native button doesn't expose per-instance callbacks. Subscribe to the Headless Wrapper's event stream:

```ts
const offCompleted = client.addEventListener('completed', (e) => {
  console.log('checkout complete:', e.checkoutId);
});

const offFailed = client.addEventListener('failed', (e) => {
  console.log('checkout failed:', e.error.code, e.error.message);
});

// Optional: high-level state machine
const offState = client.addStateListener((state) => {
  console.log('state →', state.kind);
});

// Each subscribe returns an unsubscribe. Call `client.destroy()` on unmount
// to drop all listeners and release the native client.
```

### 3.5 Re-requesting on input changes

If the user changes amount, payment method, or country, call `getCheckoutRequirements()` again with the updated request. The Headless Wrapper resets internally and returns a fresh button — no need to call `reset()` first.

```ts
try {
  const result = await client.getCheckoutRequirements(updatedRequest, style);
  setButton(result.button);
  setQuote(result.quote);
} catch (e) {
  // A superseded call (another getCheckoutRequirements arrived first)
  // surfaces as an OnramperError. Render only the most recent result and
  // ignore older rejections — the next call's result is what your UI
  // should reflect.
}
```

The native side single-flights this: any prior in-flight call is invalidated when a new one starts. You can wire `getCheckoutRequirements` directly to a country/amount picker without debouncing or checking `client.state` first — just discard older rejections.

After a `completed` or `failed` outcome, call `await client.reset()` to return to `ready`. The Headless Wrapper session and OnramperID login both remain valid; you don't need to re-`initialize()` unless the Headless Wrapper itself surfaces an unrecoverable failure.

### 3.6 Signing the OnramperID user out

`reset()` keeps the user's OnramperID login active so the next checkout skips the login sheet. Call `await client.signOut()` when you want to clear the stored OIDC tokens — useful for a "Sign out" menu item, a "Switch account" flow, or for ending a session when your app's own user logs out.

```ts
await client.signOut();
// Stored OIDC access + refresh tokens are wiped from the keychain. The
// next checkout that requires `user_info` will re-present the OnramperID
// login sheet. The partner Headless Wrapper session (DPoP key + session token) is
// preserved — you do NOT need to call initialize(...) again unless that
// session itself has expired.
```

### 3.7 Customizing the Buy button

`CheckoutButtonStyle` exposes three fields. Style is **per-checkout** (not global) — pass the same value on every `getCheckoutRequirements()` call if you want a consistent look.

```ts
interface CheckoutButtonStyle {
  backgroundColor?: string;   // hex '#RRGGBB' or '#RRGGBBAA'   (default: system blue)
  foregroundColor?: string;   // hex '#RRGGBB' or '#RRGGBBAA'   (default: white)
  borderRadius?: number;      // pt                              (default: 12)
}
```

Only those three fields are styleable. The button label ("Buy"), height, internal padding, font, ToS sentence rendering, and the login / payment sheets are Headless Wrapper-owned in this release — partners cannot override them. If your design needs more, raise it with the Headless Wrapper team rather than wrapping the button in a custom container (the underlying SwiftUI view is opaque and may relayout).

### 3.8 Error handling

Every native error surfaces as `OnramperError` (a real JS `Error` subclass) with a typed `code`. The taxonomy is small, stable, and actionable — internal plumbing (token refresh, DPoP, re-bootstrap) is handled silently, so you only see what you can act on.

```ts
import { OnramperError } from '@onramper/react-native';

try {
  const { button, quote } = await client.getCheckoutRequirements(request, style);
  // ...
} catch (e) {
  if (e instanceof OnramperError) {
    switch (e.code) {
      case 'amountOutOfRange':    showAmountPrompt(e.info); break;
      case 'quoteUnavailable':    showMessage('No quote — try a different amount or method.'); break;
      case 'checkoutForbidden':   showMessage('Not available for your region or tier.'); break;
      case 'temporaryFailure':    showRetry(); break;
      case 'networkError':
      case 'timeout':             showRetry(); break;
      case 'deviceBlocked':       showTerminalMessage('Unable to continue on this device.'); break;
      case 'configurationError':  logToSentry(e.message); showTerminalMessage('Setup error.'); break;
      case 'unrecoverable':       await client.reset(); showRetry(); break;
      // ...
    }
  }
}
```

#### Error code reference

| Code | What to do |
|---|---|
| `notInitialized` | An API was called before `initialize()` succeeded. Caller-side bug — `await` initialize before any other call. |
| `initializationFailed` | `initialize()` failed (attestation, secure-storage setup, or your `onSessionExpired` threw during a recovery attempt). Show retry UI and call `initialize()` again with a fresh session. |
| `attestationFailed` | App Attest is supported on this device but the attestation step failed. Not the simulator path (that one is handled silently). Treat as terminal for this session; advise the user to update iOS or reinstall. |
| `securityStorageFailed` | Keychain read/write failed. Terminal. Show a generic "couldn't securely store credentials" message. |
| `invalidRequest` | A 4xx validation. Inspect `e.info` for the offending field. Fix the request and retry. |
| `requirementNotSatisfied` | A checkout requirement couldn't be satisfied locally. Rare — the button normally drives this. Surface as a developer/support issue if it appears. |
| `amountOutOfRange` | Local validation — amount is outside the provider's range. `e.info` carries `min` / `max`. Prompt the user to adjust. |
| `quoteUnavailable` | No provider returned a usable quote. Suggest a different amount, currency, or payment method. |
| `checkoutForbidden` | Region / KYC tier / partner policy blocks this checkout. Show a "not available" message. |
| `temporaryFailure` | Server-side 5xx. Show retry; if `e.info.retryAfter` is populated, respect it. |
| `networkError` / `timeout` | Transport-level failure. Show retry. |
| `deviceBlocked` | Server rejected the device — terminal. |
| `configurationError` | Partner-side setup error (bad API key, missing scope). Not user-actionable — log it and show a setup-error message. |
| `unrecoverable` | Catch-all for failures the Headless Wrapper couldn't resolve internally (refresh + re-bootstrap exhausted, or a superseded `getCheckoutRequirements`). Show retry, call `reset()`, and re-initialize if needed. |
| `oidcFlowCancelled` | User dismissed the OnramperID login sheet. Tapping Buy again retries. |
| `oidcFlowFailed` / `oidcTokenExchangeFailed` | OnramperID flow inconsistency or code-exchange failure. Show retry — tapping Buy re-presents the login sheet. |
| `userTokenInvalid` / `userTokenRefreshFailed` | OnramperID refresh token terminally rejected. The Headless Wrapper has already transitioned to `requireLogin` and the button will re-present the login sheet — usually nothing to do unless you want to log it. |
| `webviewLoadFailed` | The payment webview couldn't load. Terminal for that checkout — show an error and let the user retry from the start. |
| `decodingError` / `invalidState` / `invalidStateTransition` / `deepLinkFailed` | Bridge / Headless Wrapper protocol inconsistency — treat as `unrecoverable`. Log `e.message` and `e.info` and report. |
| `platformUnsupported` | Calling an iOS-only API on Android (Android is a stub in this release). Guard your call sites with a platform check. |
| `intentInvalidated` | The button was rendered against an intent that has since been replaced by a newer `getCheckoutRequirements()` call. Render only the most recent button. |
| `intentAlreadyConsumed` | A single button instance can only drive one checkout. Re-render against a fresh result. |
| `clientAlreadyConfigured` | Constructing a second `OnramperClient` with a different `apiKey`/`clientId` in the same JS context. Either reuse the existing client or `destroy()` it first. |
| `sessionExpirationHandlerFailed` | Your `onSessionExpired` handler threw or rejected. Surfaces if a refresh recovery attempt could not get fresh credentials. Same UX as `userTokenRefreshFailed`. |

#### What you won't see

The Headless Wrapper absorbs these signals internally — they never surface to your code:

- **Headless Wrapper session expired / DPoP plumbing.** Token refresh and re-bootstrap run on a single-flight path with at-most-one retry per request. Only after recovery is exhausted does the failure surface, and it surfaces as `unrecoverable` — not as a raw 401 / DPoP / attestation signal.
- **Server-side wire codes.** Numeric `errorCode` values from the Onramper backend are mapped to the typed codes above. You will never receive a raw numeric code.

#### Diagnostics

Many errors carry an `info` payload (e.g., `{ debugInfo: 'OnramperBackend-40005: ...' }`). Treat it as opaque support-ticket fodder: **log it, but don't switch on its contents.** The format is non-localized and may change without notice.

### 3.9 Logging

Pass `logLevel: 'info'` while integrating to see HTTP method, URL path, and status for every Onramper-backend + security call in the device console. Levels:

| Level | Emits |
|---|---|
| `'off'` *(default)* | Nothing. Use in production. |
| `'error'` | Failed requests only — non-2xx status + decoded error code. |
| `'info'` | Adds method + URL path + status for every request. |
| `'debug'` | Adds low-level detail. |

### 3.10 Reference: state, events, methods

#### Methods on `OnramperClient`

| Method | Returns | Notes |
|---|---|---|
| `initialize({ sessionId, sessionToken })` | `Promise<void>` | Runs attestation + Headless Wrapper-session bootstrap. Call once per app session. |
| `getCheckoutRequirements(request, buttonStyle?)` | `Promise<{ button, quote }>` | Creates the intent, resolves requirements, returns a ready-to-render React element + priced quote. Safe to call repeatedly. |
| `reset()` | `Promise<void>` | Returns the Headless Wrapper to `ready` after `completed` / `failed`. Does not invalidate the session token or OIDC login. |
| `signOut()` | `Promise<void>` | Clears stored OIDC tokens (access + refresh) and calls `reset()`. Next checkout re-presents the OnramperID login sheet. Does not invalidate the partner Headless Wrapper session. |
| `cancelPreparedIntent(intentHandle)` | `Promise<void>` | Drops a prepared-intent handle on the native side. Rarely needed — `getCheckoutRequirements()` invalidates the prior intent automatically. |
| `addStateListener(fn)` | `() => void` | Returns an unsubscribe. `fn` receives every `OnramperState` transition. |
| `addEventListener(name, fn)` | `() => void` | Returns an unsubscribe. `fn` receives only events whose `type` matches `name`. |
| `destroy()` | `void` | Removes all listeners (host + internal). Call on unmount. |

#### `client.state` (mirror of `OnramperState`)

| `kind` | When |
|---|---|
| `'idle'` | Before `initialize()` resolves. |
| `'initializing'` | `initialize()` is in flight. |
| `'ready'` | Bootstrap complete; ready for `getCheckoutRequirements()`. |
| `'checkoutPreparing'` | `getCheckoutRequirements()` is in flight. |
| `'requireLogin'` | Intent created; requires `user_info` — login sheet will present on Buy. Carries `requirements: CheckoutRequirement[]`. |
| `'authenticating'` | OnramperID login sheet is on screen. |
| `'readyToCheckout'` | All requirements satisfied; tapping Buy goes straight to finalize. |
| `'finalizing'` | Backend finalize is in flight. |
| `'rendering'` | Payment view is on screen. Carries `url`, `renderType`, `paymentType`. |
| `'completed'` | Terminal success. |
| `'failed'` | Terminal failure. Carries `error: OnramperErrorPayload`. |

#### `CheckoutEvent` cases (delivered to `addEventListener`)

| `type` | Fires when |
|---|---|
| `'stateChanged'` | Any state transition. Carries `state`. |
| `'checkoutStarted'` | Intent has been created. Carries `intentId`. |
| `'loginRequired'` | The current intent requires `user_info`. Carries `requirements`. |
| `'readyToCheckout'` | All requirements satisfied. |
| `'requirementSatisfied'` | A requirement (`tos`, `amount_limit`, `user_info`) just passed. |
| `'checkoutFinalized'` | Backend finalized; payment surface is about to render. |
| `'renderingStarted'` | The payment view is on screen. Carries `url`, `renderType`. |
| `'completed'` | Terminal success. Carries `checkoutId`. |
| `'failed'` | Terminal failure. Carries `error`. |
| `'cancelled'` | User dismissed the payment webview. The Headless Wrapper transparently re-prepares the intent (Onramper backend intent ids are single-use) and lands back in `'readyToCheckout'` — tapping Buy again starts a fresh checkout. |
| `'providerReady'` | A provider checkout page (e.g. Coinbase) loaded and is ready for input. |
| `'paymentAuthorized'` | The user authorized payment in the provider's native sheet (e.g. Apple Pay). Not terminal — settling follows. |
| `'paymentProcessing'` | The provider accepted the payment and is settling it. |
| `'paymentCancelled'` | The provider reported the user cancelled (e.g. dismissed the Apple Pay sheet). Distinct from `'cancelled'`, which is the Headless Wrapper-level webview dismissal. |
| `'providerError'` | The provider reported a non-recoverable failure. Carries `reason`. |

These provider-lifecycle events come from third-party checkout webviews; not every provider emits every one.

> For what the Headless Wrapper handles so you don't have to (ToS, login, token refresh, payment surface), see ➡️ **[What this wrapper does](doc:what-this-kit-does)**.

---

## 4. Backend requirements

The Headless Wrapper calls the Onramper backend directly. Your **backend** is responsible for:

1. **Minting session tokens.** Before constructing `OnramperClient`, your app should call your backend's session endpoint, which in turn calls `https://demo-stg.onramper.dev/demo/create-session` (or production equivalent) with your private partner secret. The endpoint returns `{ sessionId, sessionToken }` that you pass to `client.initialize(...)`.

2. **Refreshing tokens** when the Headless Wrapper invokes your `onSessionExpired` handler. Same flow as above.

3. **Holding the partner secret** server-side. **Never** embed the demo token or partner secret in the client app.

A sample dev-only client-side session mint is in `example/createDemoSession.ts` — do not copy this pattern to production.

---

## 5. Debugging your integration

Known limitations and gotchas — App Attest in the simulator, Xcode Swift modules, Android, and `file:` symlink local development — live in a dedicated guide:

➡️ **[Debugging your integration](doc:debugging-your-integration)**

---

## 6. Verifying your setup

After installation, you should be able to build and run on a device:

```bash
# Bare RN
cd ios && pod install
cd .. && npx react-native run-ios --device

# Expo
npx expo prebuild
npx expo-doctor              # validates Expo config
npx expo run:ios --device
```

In Xcode (or via `codesign -dvv path/to/YourApp.app`), confirm:
- **Team identifier**: matches your Apple Developer team
- **Bundle identifier**: matches what's registered with Apple
- **Entitlements** include `com.apple.developer.devicecheck.appattest-environment`

In the running app, calling `client.initialize(...)` with valid staging credentials should drive the state machine through `initializing` → `ready`. If you see `failed: attestationFailed`, you're on the simulator or missing the App Attest entitlement. If you see `failed: networkError`, the device can't reach the Onramper backend.

---

## 7. Before going live

- Production `apiKey` and `clientId` configured per build flavour (no staging credentials in release builds).
- App Attest entitlement enabled on the production app id; signing team set under **Signing & Capabilities**.
- Backend session-mint endpoint deployed and reachable from the production app; returns both `sessionId` and `sessionToken`.
- `onSessionExpired` wired to your auth client and **tested end-to-end** by forcing a session expiry (e.g. revoke the Headless Wrapper session server-side mid-checkout) and confirming the user sees no error.
- `logLevel: 'off'` in production JS bundles.
- Tested on a real device (not just simulator) — attestation path verified.
- Error UI covers at minimum `amountOutOfRange`, `quoteUnavailable`, `checkoutForbidden`, `temporaryFailure`, `networkError`, `deviceBlocked`, `configurationError`, and `unrecoverable`.
- Analytics / observability hooked into `addStateListener` or `addEventListener('failed' | 'completed', …)`.
- `client.destroy()` called on unmount so re-mounting doesn't leak listeners.
