# Changelog

All notable changes to this project are documented in this file.

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
