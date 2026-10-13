# Changelog

All notable changes to this project are documented in this file.

## [1.3.0]

Bundles `OnramperSDK@1.3.0` from its published, checksum-verified release.

### Added

- **MoonPay Apple Pay checkout.** The native checkout button now drives MoonPay's
  Frames flow when MoonPay is selected: guest checkout or account onboarding,
  payment disclosures, Apple Pay, and 3-D Secure verification when required.
  Integrators continue to render the returned `button`; there is no separate
  MoonPay WebView to create. Coinbase and Paybis continue through the same API.

- **Pending payments.** `OnramperState.kind` and `CheckoutEvent.type` gain
  `paymentPending`. It means payment was accepted but settlement is still pending;
  it does **not** emit `completed`. Show a processing state and retain
  `currentTransactionId` for tracking through your backend and webhooks. Do not
  start another payment solely because the first is pending.

  ```ts
  client.addEventListener('paymentPending', () => {
    showProcessing(client.currentTransactionId);
  });
  ```

- **Customer-facing errors and support codes.** `OnramperError` now exposes
  `userMessage` for the customer and `supportCode` for diagnostics. The existing
  `code`, `message`, and `info` fields remain available. Native failed-event/state
  payloads carry the new fields too; `OnramperError.from()` supplies safe defaults
  for JavaScript errors and older, manually constructed payloads.

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

  New error codes are `paymentFailed` (confirmed payment failure),
  `providerFailed` (checkout surface failed without confirming payment outcome),
  and `applePayNotConfigured` (Apple Pay needs setup). A `providerFailed` error
  must not be treated as proof that no payment was taken. Follow `userMessage`
  rather than offering an unconditional retry.

- **Structured SDK logs in JavaScript.** Set `logLevel` and an optional
  `logHandler` on the client configuration. Each `OnramperLogRecord` contains a
  Unix-millisecond `timestamp`, `level`, `category`, `event`, string-valued
  `context`, and formatted `message`. Native Console output is preserved.

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

  Logging defaults to `off`. Callbacks run in JavaScript, stop after `destroy()`,
  and should do little work; callback exceptions do not interrupt checkout.
  Records use the public SDK's sanitization, not its internal verbose build.
  Provider messages receive best-effort redaction and may still contain personal
  data; choose retention and sharing appropriate for your app.

- **Provider lifecycle and metadata.** New events are `challengeStarted`,
  `challengeCompleted`, and `customerOnboardingRequired`. These describe progress,
  not successful payment. Optional `QuoteResponse.providerContext` preserves JSON
  strings, numbers, booleans, arrays, objects, and nulls (including provider tokens,
  executable flags, and limits). `ProviderJSONValue` and `PaymentDisclosure` are
  exported types; finalized data also types the optional `providerBootstrap`.
  Avoid logging provider metadata or payment URLs.

- **Optional provider-event logging controls.** `isEventLoggingEnabled` enables
  SDK event telemetry to the BFF. `isEventConsoleLoggingEnabled` emits provider
  events at info level even when `logLevel` is lower. Both default to `false`.

### Fixed

- Rejected native SDK calls now preserve the structured error code, customer
  message, support code, and associated information across Nitro, matching the
  error fields delivered by failed events. Previously Nitro reduced exceptions
  to a message and the wrapper could classify them as `unrecoverable`.

### Changed

- The bare RN demo shows pending payments separately from completion, displays
  customer-friendly failure copy, and includes provider lifecycle events. Its
  Settings sheet lists daily UTC `.log` files with sizes, readable previews,
  individual sharing, and confirmed deletion. Logs include a launch header with
  app/build/iOS/device-model details. Demo recording is on by default and respects
  a saved off choice; files are excluded from backups, limited to 5 MiB, and
  pruned after seven days during use. Older days are removed first; if one day
  fills the cap, its newest complete lines are kept with a truncation notice.
  The event panel remains an in-memory view. The Expo example demonstrates the
  new events and log callback.
- This stable release includes the self-sizing checkout button and demo changes
  previously published in `1.2.2-1`. Continue styling the button's container;
  `cloneElement(button, { style })` does not style the native button.

### Upgrading from 1.2.x

- Update exhaustive switches over errors, states, and events for the new cases.
  Keep pending separate from both completed and failed; use `userMessage` for UI
  and `supportCode` for support. The new error-payload fields are optional in
  TypeScript to keep existing fixtures and manually constructed payloads valid.
- Existing `getCheckoutRequirements`, prefill, button rendering, and session
  refresh signatures are unchanged. The minimum React Native and iOS versions
  are unchanged. Run `pod install` and rebuild the native app after upgrading.
- The iOS SDK now isolates stored credentials by environment and removes the old
  shared entries once. Previously signed-in users will see OnramperID sign-in
  again on their next checkout after upgrading; SDK session setup is automatic.
- Keep transaction webhooks configured for every provider and payment flow.
  In-app events complement your backend's transaction tracking.

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
