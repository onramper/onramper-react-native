# Changelog

All notable changes to this project are documented in this file.

## [1.3.1]

Bundles `OnramperSDK@1.3.1` from its published, checksum-verified release.

### Added

- **Runtime native SDK version.** `OnramperClient.sdkVersion` returns the iOS SDK
  version actually loaded by the app, as plain semver (for example, `"1.3.1"`).
  It is synchronous and read-only, and requires no client instance, credentials,
  or initialization. Use it in diagnostics, analytics, or a support screen.

  ```ts
  const sdkVersion = OnramperClient.sdkVersion;
  ```

  This reports the native SDK version, not the React Native package or app
  version. Do not infer it from the framework bundle's version fields.

### Changed

- The bare RN demo's Settings screen now reads the SDK version from native code
  instead of inferring it from the JavaScript package version. The Expo demo
  also shows the native SDK version in its build information.
- The bare RN demo records TestFlight build number 2 and declares its use of
  exempt encryption in `Info.plist`, avoiding a repeated encryption questionnaire
  for future uploads. Already uploaded builds still need their declaration in
  App Store Connect.

### Upgrading from 1.3.0

- Existing checkout, event, error, and logging APIs are unchanged. No existing
  call sites need to change; the runtime version property is optional and iOS-only.
- Run `pod install` and rebuild the native app after updating the package. A
  JavaScript-only update cannot add the native version getter.

## [1.3.0]

Bundles the published, checksum-verified `OnramperSDK@1.3.0` for iOS.

Most checkout changes in this release come from
[OnramperSDK for iOS 1.3.0](https://github.com/onramper/onramper-ios/releases/tag/v1.3.0):
MoonPay Apple Pay, pending payments, customer-facing errors, structured logging, and
credential isolation. The React Native wrapper exposes these native capabilities in
JavaScript and adds prepared-checkout cleanup and client-lifecycle fixes. The demo adds
log-file management and checkout recovery.

### Before you upgrade

- **Handle the new error, state and event cases.** Update exhaustive switches for the
  additions below. Keep `paymentPending` separate from completion and failure; an
  accepted payment may still be settling.
- **Previously signed-in users will sign in to OnramperID again.** The native SDK now
  stores credentials separately by environment and removes the old shared entries once.
  SDK session setup remains automatic; the next checkout requiring login presents
  sign-in again.
- **Rebuild the native app.** After updating the package, run `pod install` in your iOS
  project and rebuild. A JavaScript-only update cannot replace the bundled iOS SDK.

Existing checkout, prefill, button-rendering and session-refresh signatures are
unchanged. Minimum React Native and iOS versions are unchanged.

### Included from iOS SDK 1.3.0

**MoonPay Apple Pay checkout.** When MoonPay is selected for an available Apple Pay
quote, the native checkout button handles MoonPay's Frames flow: guest checkout or
account onboarding, required payment disclosures, Apple Pay, and 3-D Secure verification
when needed. Integrators continue rendering the returned `button`; no separate MoonPay
WebView is required. The MoonPay sheet opens at a compact height and expands when the
provider needs more room. Required disclosures appear next to the Apple Pay button and
cannot be hidden. Coinbase and Paybis continue through the same API.

**Pending-payment outcome and UI.** The native SDK distinguishes an accepted payment
awaiting settlement from a completed payment. Its sheet shows **Payment processing**
with the transaction ID; dismissing the sheet preserves the pending outcome.

**Customer-facing errors and failure UI.** The native SDK supplies `userMessage` and
`supportCode`, and distinguishes confirmed payment failure from a checkout-surface error
with an unknown payment outcome. Its failure screen displays that copy and support
code. **Try Again** closes the sheet and starts a fresh checkout. The RN API below
exposes the same error categories and messages for the integrator's own UI.

**Structured, sanitized logging.** The native SDK produces structured records and
supports a custom log sink. HTTP paths use route templates, URLs are reduced to hosts,
and sensitive-looking values are redacted. Native `errorDescription` and `debugInfo`
also exclude URLs, response bodies, and tokens. Provider messages receive best-effort
redaction, so exported logs may still contain personal data. Logging remains off by
default; the RN wrapper forwards these native records to JavaScript.

**Environment-specific credentials.** The native SDK now keeps credentials separate
for development and production, preventing a session from carrying across environments.
The one-time sign-in requirement is described above.

### React Native API additions

The following APIs expose the bundled native SDK's states, events, errors, logging, and
provider metadata to JavaScript.

**Pending-payment handling.** `OnramperState.kind` and `CheckoutEvent.type` now include
`paymentPending`. It means payment was accepted but settlement is pending, and does not
emit `completed`. Show a processing state and retain `currentTransactionId` to track the
transaction through your backend and webhooks. Do not start another payment just because
the first is pending.

```ts
client.addEventListener('paymentPending', () => {
  showProcessing(client.currentTransactionId);
});
```

**Customer-facing errors and support codes.** The JavaScript `OnramperError` now exposes
the native SDK's `userMessage` for customer copy and `supportCode` for diagnostics.
Existing `code`, `message` and `info` fields remain available. These fields are preserved
across both failed events and rejected native SDK calls.

```ts
client.addEventListener('failed', ({ error }) => {
  const failure = OnramperError.from(error);
  showError(failure.userMessage, failure.supportCode);
});

try {
  await client.getCheckoutRequirements(request);
} catch (error) {
  const failure = OnramperError.from(error);
  showError(failure.userMessage, failure.supportCode);
}
```

New JavaScript error codes mirroring iOS SDK 1.3.0:

- `paymentFailed`: the provider confirmed the payment failed.
- `providerFailed`: the checkout surface failed without confirming the payment outcome.
  This does not prove that no payment was taken; follow `userMessage` and check
  transaction status before offering another payment attempt.
- `applePayNotConfigured`: Apple Pay needs to be set up on the device.

`OnramperError.from()` supplies fallback customer copy and a support code for older or
manually constructed payloads. The new fields are optional on `OnramperErrorPayload` to
preserve compatibility with existing fixtures and callers.

**Structured SDK logs in JavaScript.** Configure `logLevel` and an optional `logHandler`
to receive native `OnramperLogRecord` values. Records contain a Unix-millisecond
timestamp, level, category, event, string-valued context and formatted message. The RN
bridge preserves native Console output while forwarding records to the callback.

```ts
const client = new OnramperClient({
  apiKey,
  clientId,
  environment: 'production',
  onSessionExpired,
  logLevel: 'info',
  logHandler: record => diagnosticStore.append(record),
});
```

Library logging defaults to `off`. Callbacks run in JavaScript, stop after `destroy()`,
and should do little work; callback exceptions do not interrupt checkout. Native
sanitization is preserved; choose appropriate retention and sharing controls for your
app's exported logs.

**Provider lifecycle events and metadata.** The wrapper exposes the native SDK's new
`challengeStarted`, `challengeCompleted` and `customerOnboardingRequired` events. These
describe progress, not payment completion. Optional `QuoteResponse.providerContext` preserves JSON values,
including executable flags and limits where supplied. `ProviderJSONValue` and
`PaymentDisclosure` are exported types, and finalized data types the optional
`providerBootstrap`. Provider metadata may contain tokens; avoid logging it or payment
URLs.

**Opt-in provider-event diagnostics.** The wrapper also exposes the native configuration
flags: `isEventLoggingEnabled` enables SDK event telemetry to the BFF.
`isEventConsoleLoggingEnabled` emits provider events at info level even when `logLevel`
is lower. Both default to `false`.

### React Native wrapper fixes

- **Superseded quote preparations release abandoned buttons.** A newer preparation
  invalidates older unmounted handles owned by that client, even if the newer request
  fails. Superseded in-flight calls reject with `intentInvalidated`; ignore those when
  waiting for the latest quote. Reset, sign-out and destruction clear owned handles, and
  expired handles cannot mount. Other clients are unaffected. This cleans up local
  views; it does not cancel a submitted payment or guarantee cancellation of a backend
  request.
- **Client destruction is safe and explicit.** Repeated `destroy()` calls are harmless.
  Subsequent operations reject, and listener subscriptions throw, with the typed
  `clientDestroyed` error instead of Nitro's `NativeState is null`. Late results, events
  and logs cannot update a destroyed JS client. Unmount the old button and create a new
  client to start another session.
- **Native errors retain their context across Nitro.** Promise rejections preserve the
  structured error code, customer message, support code and associated information,
  matching failed-event payloads. Previously, exceptions could be reduced to a message
  and classified as `unrecoverable`.

### Demo app changes

- The bare RN demo offers **Get a new quote** after a failure before finalization,
  replacing the disabled Buy button while preserving login. It fetches fresh
  requirements without automatically retrying payment. Failures after finalization
  retain the native outcome sheet.
- Pending payments appear separately from completion, and error displays use
  customer-friendly messages and support codes.
- Settings now lists daily UTC log files with previews, sizes, individual sharing and
  confirmed deletion. Demo recording is on by default and respects a saved off choice.
  Files are excluded from backups, capped at 5 MiB in total and pruned after seven days
  during use. The event panel remains an in-memory view.
- The Expo example demonstrates the new events, customer-facing errors and log callback.

### Upgrading from stable 1.2.2

This stable release also includes the self-sizing checkout button and demo improvements
previously published in `1.2.2-1`. The native button reports its content height,
including its Terms of Service text. Style the button's container; `cloneElement(button,
{ style })` does not style the native button.

Keep transaction webhooks configured for every provider and payment flow. In-app SDK
events complement backend transaction tracking.

### Known issue in the Expo example

The Expo demo's native build on the tested Xcode 27 toolchain remains blocked by the
existing `ExpoModulesJSI` compiler error in `JavaScriptRuntime.swift:219`: “a C function
pointer can only be formed from a reference to a 'func' or a literal closure.” This was
reproduced before these changes. Expo JavaScript tests and type checking pass; the bare
RN app's Release build has been validated.

[iOS SDK 1.3.0 changelog](https://github.com/onramper/onramper-ios/blob/master/CHANGELOG.md#130)
· [React Native changes since 1.2.2-1](https://github.com/onramper/onramper-react-native/compare/v1.2.2-1...v1.3.0)

## [1.2.2-1]

Wrapper-only change; still bundles `OnramperSDK@1.2.2`.

### Fixed

- The native checkout button no longer draws over neighbouring views. It reports its content height
  (for example when ToS text appears under the Buy button) and sizes itself to match, and clips any
  overflow as a backstop.
- A checkout button given an intent that has expired or was already used now shows nothing, instead of
  keeping the previous quote's button on screen.

### Changed

- No public TypeScript type changes. Containers around `button` no longer need a `minHeight`.
- `button` is now an element of a small sizing wrapper rather than the native view itself, and it
  manages its own `style`. Style passed with `cloneElement(button, { style })` is no longer applied;
  style the containing `View` instead.
- The bare example app is now a demo app: environment switching, automatic SDK initialization,
  currency / payment / country selection, and a settings sheet.

## [1.2.2]

Bundles `OnramperSDK@1.2.2`.

### Fixed

- Fixed authentication handling during SDK session initialization and refresh.

### Changed

- No public React Native API changes or migration are required.

## [1.2.1]

Bundles `OnramperSDK@1.2.1`.

### Added

- Durable Onramper transaction IDs. `checkoutFinalized.response` now includes the required
  `onramperTransactionId`, and `OnramperClient.currentTransactionId` mirrors the native
  published value. Subscribe with `addTransactionIdListener` when UI must react to it.
- Both example apps display and log the transaction ID at finalization.

### Changed

- No migration is required. The release is additive. Persist `onramperTransactionId` for
  support, reconciliation, and status lookup instead of per-attempt checkout/intent IDs.
  Read it before `reset()` or `signOut()`, which clear the current value. TypeScript tests
  that manually construct a `CheckoutFinalizeResponse` fixture must add the required field.

## [1.2.0]

Bundles `OnramperSDK@1.2.0`.

### Added

- Client-supplied **user-field prefill**. `getCheckoutRequirements()` accepts an optional third argument carrying values you already know about the user, and the OnramperID sign-in and additional-info screens arrive pre-populated instead of blank. New exported type: `OnramperUserPrefill` — `email`, `firstName`, `lastName`, `phoneNumber`, all optional; supply only what you know.

  ```ts
  const { button, quote } = await client.getCheckoutRequirements(request, style, {
    firstName: 'Ada',
    lastName: 'Lovelace',
    phoneNumber: '+3712345678', // E.164
  });
  ```

  Prefill is **best-effort and never blocks sign-in.** If it can't be applied, the login flow opens normally without it. No error surfaces to your app, and there is nothing to handle. Prefill values are never logged at any `logLevel`.

  A prefilled phone number is always a *candidate*: the user still verifies it, and a number already verified on the account takes precedence.

  **Supply `email` only when you are confident** it is the address the user will sign in with. It identifies which account the other values belong to, so it is not merely another prefilled value: when it matches the account that signs in, the remaining values may be applied automatically; when it does not match, the whole prefill is dropped — which is strictly worse than omitting `email`, where the values are still offered to the user for confirmation.

  Prefill is enabled per integration. Talk to your Onramper representative before relying on it — without it enabled, sign-in simply proceeds without prefill.

- Both example apps gained a prefill panel (a send/don't-send switch plus editable fields) so the flow can be exercised on device. `email` and `phoneNumber` start blank deliberately.

### Changed

- `getCheckoutRequirements(request, buttonStyle?)` gains a trailing `prefill?` parameter and is now `getCheckoutRequirements(request, buttonStyle?, prefill?)`. Existing call sites are unaffected; no migration is required. (The Swift SDK places `prefill` before `buttonStyle`, where argument labels keep it non-breaking — JavaScript has no labels, so the wrapper appends it instead.)

## [1.1.1]
Minor version bundling security enhancements from Onramper iOS SDK v1.1.1

### Changed (breaking)
- All clients should upgrade to this version. This version includes a new security paradigm for backend communications that is required.

## [1.1.0]

Bundles `OnramperSDK@1.1.0`. The SDK is pre-adoption, so breaking changes ship within the 1.x line.

### Changed (breaking)
- `QuoteResponse` is now success-only: `quoteId`, `ramp`, `rate`, `payout`, `paymentMethod`, `networkFee`, and `transactionFee` are non-optional, and `errors` / the `QuoteError` type are removed. `getCheckoutRequirements()` rejects with `OnramperError` (e.g. `quoteUnavailable`) when a quote can't be priced, rather than resolving with a partial quote.
- `CheckoutRequest.destination` is now required (was optional).

### Added
- Phone **reverification**: a `reverification` member on the `CheckoutRequirement` union (`field`, `requiredRecencyDays`, `lastVerifiedAt`), surfaced through the existing OnramperID flow — the native button handles it automatically. `requirementSatisfied` reports each resolved requirement type.
- `amountLimitSatisfied` on the `amount_limit` requirement.
- `UserInfoField.satisfied` and the typed `UserInfoFieldType` union (was `string`).
- New `docs/TYPE_REFERENCE.md` consolidating every client-facing type.

### Fixed
- `CheckoutRequirement` is now serialized by the native bridge in the flat `{ type, ...fields }` shape the TypeScript union declares (previously the Swift `Codable` nesting `{ type, requirement: {...} }` leaked through).

## [1.0.0] — 2026-05-20

### Added
- Initial release bundling `OnramperSDK@1.0.0`.
- `OnramperClient` JS class with `configure`, `initialize`, `getCheckoutRequirements`, `cancelPreparedIntent`, `reset`.
- `OnramperCheckoutButtonView` native view backed by the SwiftUI `OnramperCheckoutButton`.
- Event channels: `onStateChanged`, `onCheckoutEvent`.
- Typed `OnramperError` with a stable `code` enum mirroring the Swift `OnramperError` cases.
- Android stub that throws `platformUnsupported`.

### Known limitations
- `CheckoutEvent.checkoutCancelled` case is omitted from the JS event mapping because the bundled `OnramperSDK@1.0.0` xcframework does not include it.
- Per-view event handlers on `OnramperCheckoutButtonView` are declared but not fired by the SDK button; consumers should subscribe via `client.addEventListener(...)` instead.
- Requires `expo-modules-core` ≥ 56 (Expo SDK 56) and iOS deployment target 16.4. Older Expo / iOS targets won't link.

### Implementation notes
- Session refresh uses an event + AsyncFunction round-trip (`onSessionExpired` → `provideSessionCredentials`) so `onSessionExpired` can be fully async. Required because expo-modules-core's `JavaScriptFunction` became `~Copyable` in SDK 56 and can't be stored as a property on the native side.
