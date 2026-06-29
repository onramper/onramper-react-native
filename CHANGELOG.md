# Changelog

All notable changes to this project are documented in this file.

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
