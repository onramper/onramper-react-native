# Changelog

All notable changes to this project are documented in this file.

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
