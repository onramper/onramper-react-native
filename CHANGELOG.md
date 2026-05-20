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
- `onSessionExpired` callback is invoked synchronously by the native bridge (`expo-modules-core`'s `JavaScriptFunction.call()` is sync-throws). Returning a `Promise` throws `sessionExpirationHandlerFailed`.
- `CheckoutEvent.checkoutCancelled` case is omitted from the JS event mapping because the bundled `OnramperSDK@1.0.0` xcframework does not include it.
- Per-view event handlers on `OnramperCheckoutButtonView` are declared but not fired by the SDK button; consumers should subscribe via `client.addEventListener(...)` instead.
- Swift unit tests in `ios/Tests/` are not executed by CI yet — the Xcode test scheme requires a one-time manual setup in `example/ios/OnramperReactNativeExample.xcworkspace`.
