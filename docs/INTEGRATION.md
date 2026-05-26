# Integrating `@onramper/react-native`

A consumer-facing guide to embedding the Onramper iOS SDK in a React Native
app via this wrapper.

---

## What kind of app can use this?

The wrapper is an **Expo Module**. It needs the Expo Modules layer
(`expo-modules-core` + the `ExpoReactNativeFactory` AppDelegate setup) to
boot. It does **not** require Expo CLI, Expo Go, EAS, or any cloud services
— just the native runtime layer.

Three consumer scenarios, in order of effort:

| You have… | What you need to do |
|---|---|
| **An Expo SDK 56+ app** (managed or with prebuild) | Just `npm install @onramper/react-native` + `pod install`. Skip to §3. |
| **A bare RN app that already uses Expo Modules** (e.g. you previously ran `npx install-expo-modules`) | Same as above — skip to §3. |
| **A pure bare RN app, no Expo Modules at all** | Add the Expo Modules layer first (§2), then install the wrapper (§3). |

If you're unsure: check your `package.json`. If you see `"expo"` or
`"expo-modules-core"` in dependencies, you're in one of the first two
scenarios.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| iOS | 16.4+ | Deployment target |
| React Native | 0.85.3 | Exact pin matching Expo SDK 56's RN |
| `expo-modules-core` | 56.0.12+ | Autolinked via the `expo` package |
| Node | 22.11.0+ | Per Expo's engines field |
| Xcode | 16+ (Xcode 26 tested) | New Architecture / Bridgeless mandatory in SDK 56+ |
| Real iOS device | Required for App Attest | Simulator can launch but attestation will return `attestationFailed` |
| Apple Developer account | Required for signing | Free or paid; need App Attest capability under your team |

---

## 1. Install the wrapper

```bash
npm install @onramper/react-native
cd ios && pod install
```

That's it for the wrapper itself. The native binary
(`OnramperSDK.xcframework`) and the Expo Module autolink in. If you're in
the **first scenario above** (already on Expo SDK 56+), you can skip to §3.

---

## 2. Adding the Expo Modules layer to a bare RN app (only if needed)

If your `package.json` doesn't yet have `expo-modules-core`, run:

```bash
npx install-expo-modules@latest
```

This patches your `AppDelegate.swift`, `Podfile`, and `Info.plist` to enable
Expo Modules autolinking. After it completes, re-run `npm install` +
`pod install`.

If `install-expo-modules` doesn't work for you (some setups can't auto-detect
SDK version), hand-apply the changes documented in §3 below: the AppDelegate
template, Podfile snippets, and babel/Metro config.

Your `package.json` should end up with at least:

```json
{
  "dependencies": {
    "@onramper/react-native": "^1.0.0",
    "expo": "^56.0.3",
    "expo-modules-core": "~56.0.12",
    "react": "19.2.3",
    "react-native": "0.85.3"
  }
}
```

Run `npx expo-doctor` and resolve any version mismatches it flags.

---

## 3. iOS configuration

The rest of this section applies to **all** consumers. Already-Expo apps
will likely have most of this in place; bare-RN-with-fresh-Expo-Modules
consumers may need to apply some of it manually.

### 2.1 Podfile properties

`ios/Podfile.properties.json`:

```json
{
  "expo.jsEngine": "hermes",
  "ios.deploymentTarget": "16.4"
}
```

### 2.2 Podfile post-install

Add this to your `Podfile`'s `post_install` block to align deployment targets
and (on Xcode 26+) disable User Script Sandboxing so React's pre-build script
phases can extract framework intermediates:

```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.4'
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end

  user_project = installer.aggregate_targets.first&.user_project
  user_project&.targets&.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
    end
  end
  user_project&.save
end
```

### 2.3 AppDelegate (Expo template, mandatory)

Your `AppDelegate.swift` **must** use `ExpoReactNativeFactory`, not the bare
RN `RCTReactNativeFactory`. The Expo factory installs the JSI runtime hooks
that initialize `globalThis.expo` and register TurboModules — without it the
JS bundle starts before the bridge is ready and `requireNativeModule` returns
undefined.

If you scaffolded with `npx create-expo-app` or `expo prebuild` you already
have the right AppDelegate. If you started from bare RN, swap it for:

```swift
internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()
    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? { bridge.bundleURL ?? bundleURL() }
  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
```

### 2.4 App Attest capability

The SDK attests every session via Apple's `DCAppAttestService`. Without the
entitlement, attestation returns `attestationFailed`.

In Xcode → your target → **Signing & Capabilities** → **+ Capability** →
**App Attest**. This adds:

```xml
<key>com.apple.developer.devicecheck.appattest-environment</key>
<string>development</string>
```

For App Store builds, Xcode automatically switches to `production`.

You'll also need to set a **Development Team** under Signing & Capabilities.
The SDK works with any team; the bundle ID just needs to be registered with
Apple Developer Portal (Xcode does this automatically when you enable
automatic signing).

### 2.5 Pod install + first build

```bash
cd ios && pod install
cd .. && npx expo run:ios
```

If `pod install` fails with `Unable to find compatibility version string for
object version '70'` (Xcode 26+ project format), downgrade your project file:

```bash
sed -i '' 's/objectVersion = 70;/objectVersion = 60;/' \
  ios/<YourApp>.xcodeproj/project.pbxproj
```

Xcode may re-upgrade this each time you open the project in the UI; just
re-run the `sed` before each `pod install`.

---

## 4. Metro configuration

Use Expo's Metro config (not bare RN's):

`metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
```

`babel.config.js`:

```js
module.exports = {
  presets: ['babel-preset-expo'],
};
```

Start Metro with Expo's CLI:

```bash
npx expo start --dev-client
```

(Not `react-native start` — bare RN's Metro doesn't know about Expo's virtual
entry or the polyfills required for TurboModule init.)

---

## 5. JavaScript usage

### 5.1 How the pieces fit together

A typical checkout maps to these calls, in order:

1. **Your backend mints a session.** Your server calls Onramper's partner endpoint with your private partner key and gets back a one-shot `{ sessionId, sessionToken }` pair. It hands them to the app over your normal channel.
2. **Your app constructs `OnramperClient`** with config (`apiKey`, `clientId`, `environment`, `onSessionExpired`) and calls `initialize({ sessionId, sessionToken })`. The native side runs device attestation and exchanges the token for an authenticated SDK session. State becomes `ready`.
3. **Your app requests a checkout.** `getCheckoutRequirements(request, style)` creates a checkout intent, resolves what consent / KYC is needed for this user + amount, and returns `{ button, quote }`.
4. **Your app embeds `button`.** The user sees "Buy" and the Terms-of-Service sentence the SDK rendered for the selected provider.
5. **User taps Buy.** The button records ToS consent, presents the OnramperID login sheet if the provider needs user identity, then finalizes the intent.
6. **The SDK renders the payment surface.** Apple Pay, card webview, or other — chosen automatically from the provider's response. State transitions through `finalizing` → `rendering`.
7. **Outcome.** `completed` (with checkout id) or `failed` (with `OnramperError`). Call `client.reset()` to return to `ready` for another checkout.

Token refresh — both SDK session and OnramperID user token — is fully automatic. Your code only sees it if both refresh paths exhaust, in which case the SDK calls your `onSessionExpired` handler for a fresh `{ sessionId, sessionToken }` pair.

### 5.2 What OnramperID is

OnramperID is Onramper's hosted OIDC identity layer. It collects whatever identity / KYC data the chosen onramp requires (email, name, contact info, document upload) so partners don't host a login UI or hold user PII themselves.

- The SDK presents OnramperID as a sheet on Buy tap, **only when** the current checkout's requirements include `user_info`. If the provider doesn't need it, no sheet ever appears.
- Redirect is a **hosted HTTPS callback** intercepted inside the webview — you do **not** need to register a custom URL scheme, universal link, or anything in `Info.plist` for OnramperID.
- Token refresh, re-authentication, and re-presenting the login sheet on a terminal refresh failure are all handled by the SDK. Partners never read, write, or inspect OnramperID tokens.

### 5.3 Constructing the client

```ts
import { OnramperClient } from '@onramper/react-native';

const client = new OnramperClient({
  apiKey: 'pk_live_...',           // your partner API key
  clientId: '01K...',              // your partner client ID
  environment: 'production',       // or 'development' for staging Onramper backend
  theme: 'system',                 // 'system' | 'light' | 'dark'
  logLevel: 'off',                 // 'off' | 'error' | 'info' | 'debug'

  // The SDK calls this when its session needs to be re-bootstrapped.
  // Return a fresh { sessionId, sessionToken } pair from your backend;
  // the SDK re-runs the bootstrap and silently retries the in-flight
  // request — your user sees no error.
  //
  // This fires *rarely*: the SDK refreshes its session token proactively
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

If your backend is unreachable when the SDK calls `onSessionExpired`, throw or reject — the SDK surfaces it as `OnramperError` with code `userTokenRefreshFailed` (or `initializationFailed` if the failure happens during `initialize`).

### 5.4 Requesting the checkout button

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

### 5.5 Observing outcomes

The native button doesn't expose per-instance callbacks. Subscribe to the SDK's event stream:

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
// to drop all listeners (including the two internal ones the client uses
// for state mirroring and session refresh).
```

### 5.6 Re-requesting on input changes

If the user changes amount, payment method, or country, call `getCheckoutRequirements()` again with the updated request. The SDK resets internally and returns a fresh button — no need to call `reset()` first.

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

After a `completed` or `failed` outcome, call `await client.reset()` to return to `ready`. The SDK session and OnramperID login both remain valid; you don't need to re-`initialize()` unless the SDK itself surfaces an unrecoverable failure.

### 5.7 Signing the OnramperID user out

`reset()` keeps the user's OnramperID login active so the next checkout skips the login sheet. Call `await client.signOut()` when you want to clear the stored OIDC tokens — useful for a "Sign out" menu item, a "Switch account" flow, or for ending a session when your app's own user logs out.

```ts
await client.signOut();
// Stored OIDC access + refresh tokens are wiped from the keychain. The
// next checkout that requires `user_info` will re-present the OnramperID
// login sheet. The partner SDK session (DPoP key + session token) is
// preserved — you do NOT need to call initialize(...) again unless that
// session itself has expired.
```

### 5.8 Customizing the Buy button

`CheckoutButtonStyle` exposes three fields. Style is **per-checkout** (not global) — pass the same value on every `getCheckoutRequirements()` call if you want a consistent look.

```ts
interface CheckoutButtonStyle {
  backgroundColor?: string;   // hex '#RRGGBB' or '#RRGGBBAA'   (default: system blue)
  foregroundColor?: string;   // hex '#RRGGBB' or '#RRGGBBAA'   (default: white)
  borderRadius?: number;      // pt                              (default: 12)
}
```

Only those three fields are styleable in v0. The button label ("Buy"), height, internal padding, font, ToS sentence rendering, and the login / payment sheets are SDK-owned in this release — partners cannot override them. If your design needs more, raise it with the SDK team rather than wrapping the button in a custom container (the underlying SwiftUI view is opaque and may relayout).

### 5.9 Error handling

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
| `unrecoverable` | Catch-all for failures the SDK couldn't resolve internally (refresh + re-bootstrap exhausted, or a superseded `getCheckoutRequirements`). Show retry, call `reset()`, and re-initialize if needed. |
| `oidcFlowCancelled` | User dismissed the OnramperID login sheet. Tapping Buy again retries. |
| `oidcFlowFailed` / `oidcTokenExchangeFailed` | OnramperID flow inconsistency or code-exchange failure. Show retry — tapping Buy re-presents the login sheet. |
| `userTokenInvalid` / `userTokenRefreshFailed` | OnramperID refresh token terminally rejected. The SDK has already transitioned to `requireLogin` and the button will re-present the login sheet — usually nothing to do unless you want to log it. |
| `webviewLoadFailed` | The payment webview couldn't load. Terminal for that checkout — show an error and let the user retry from the start. |
| `decodingError` / `invalidState` / `invalidStateTransition` / `deepLinkFailed` | Bridge / SDK protocol inconsistency — treat as `unrecoverable`. Log `e.message` and `e.info` and report. |
| `platformUnsupported` | Calling an iOS-only API on Android (Android is a stub in this release). Guard your call sites with a platform check. |
| `intentInvalidated` | The button was rendered against an intent that has since been replaced by a newer `getCheckoutRequirements()` call. Render only the most recent button. |
| `intentAlreadyConsumed` | A single button instance can only drive one checkout. Re-render against a fresh result. |
| `clientAlreadyConfigured` | Constructing a second `OnramperClient` with a different `apiKey`/`clientId` in the same JS context. Either reuse the existing client or `destroy()` it first. |
| `sessionExpirationHandlerFailed` | Your `onSessionExpired` handler threw or rejected. Surfaces if a refresh recovery attempt could not get fresh credentials. Same UX as `userTokenRefreshFailed`. |

#### What you won't see

The SDK absorbs these signals internally — they never surface to your code:

- **SDK session expired / DPoP plumbing.** Token refresh and re-bootstrap run on a single-flight path with at-most-one retry per request. Only after recovery is exhausted does the failure surface, and it surfaces as `unrecoverable` — not as a raw 401 / DPoP / attestation signal.
- **Server-side wire codes.** Numeric `errorCode` values from the Onramper backend are mapped to the typed codes above. You will never receive a raw numeric code.

#### Diagnostics

Many errors carry an `info` payload (e.g., `{ debugInfo: 'OnramperBackend-40005: ...' }`). Treat it as opaque support-ticket fodder: **log it, but don't switch on its contents.** The format is non-localized and may change without notice.

### 5.10 Logging

Pass `logLevel: 'info'` while integrating to see HTTP method, URL path, and status for every Onramper-backend + security call in the device console. Levels:

| Level | Emits |
|---|---|
| `'off'` *(default)* | Nothing. Use in production. |
| `'error'` | Failed requests only — non-2xx status + decoded error code. |
| `'info'` | Adds method + URL path + status for every request. |
| `'debug'` | Adds low-level detail. |

### 5.11 Reference: state, events, methods

#### Methods on `OnramperClient`

| Method | Returns | Notes |
|---|---|---|
| `initialize({ sessionId, sessionToken })` | `Promise<void>` | Runs attestation + SDK-session bootstrap. Call once per app session. |
| `getCheckoutRequirements(request, buttonStyle?)` | `Promise<{ button, quote }>` | Creates the intent, resolves requirements, returns a ready-to-render React element + priced quote. Safe to call repeatedly. |
| `reset()` | `Promise<void>` | Returns the SDK to `ready` after `completed` / `failed`. Does not invalidate the session token or OIDC login. |
| `signOut()` | `Promise<void>` | Clears stored OIDC tokens (access + refresh) and calls `reset()`. Next checkout re-presents the OnramperID login sheet. Does not invalidate the partner SDK session. |
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
| `'cancelled'` | User dismissed the payment webview. The SDK transparently re-prepares the intent (Onramper backend intent ids are single-use) and lands back in `'readyToCheckout'` — tapping Buy again starts a fresh checkout. |

### 5.12 What you don't need to do

- ❌ Build a Terms-of-Service screen — the SDK renders consent text and links under the Buy button automatically.
- ❌ Build an OnramperID login UI — the SDK presents it as a sheet on Buy tap, and re-presents it automatically if the user's session expires mid-checkout.
- ❌ Register a custom URL scheme or universal link for the OIDC redirect — the SDK intercepts a hosted HTTPS callback inside the webview.
- ❌ Catch 401s and retry — the SDK refreshes both tokens proactively and reactively, with single-flight coalescing. You only handle a token failure if `onSessionExpired` itself can't deliver a fresh `{ sessionId, sessionToken }` pair.
- ❌ Hold or cache OIDC tokens on the JS side — they live in the iOS keychain and are managed entirely by the SDK.
- ❌ Pick the payment surface — the SDK picks the right view (Apple Pay, card, etc.) based on the provider's response.

---

## 6. Backend requirements

The SDK calls the Onramper backend directly. Your **backend** is responsible for:

1. **Minting session tokens.** Before constructing `OnramperClient`, your app
   should call your backend's session endpoint, which in turn calls
   `https://demo-stg.onramper.dev/demo/create-session` (or production equivalent)
   with your private partner secret. The endpoint returns `{ sessionId,
   sessionToken }` that you pass to `client.initialize(...)`.

2. **Refreshing tokens** when the SDK invokes your `onSessionExpired`
   handler. Same flow as above.

3. **Holding the partner secret** server-side. **Never** embed the demo token
   or partner secret in the client app.

A sample dev-only client-side session mint is in `example/createDemoSession.ts`
— do not copy this pattern to production.

---

## 7. Known limitations & gotchas

### App Attest in the simulator
Always returns `attestationFailed`. Apple's `DCAppAttestService` only works
on physical iOS 14+ devices. Use a real device for any end-to-end test.

### Xcode 26 project format
Xcode 26 saves projects in `objectVersion = 70`, which the bundled xcodeproj
gem in CocoaPods 1.16 doesn't yet support. Downgrade to `60` before each
`pod install`:

```bash
sed -i '' 's/objectVersion = 70;/objectVersion = 60;/' ios/<YourApp>.xcodeproj/project.pbxproj
```

### Android
Stub-only. All Android calls throw `platformUnsupported`. A native Android
SDK is not part of this release.

### Local development via `file:` symlink (contributors only)
If you're developing the wrapper itself by linking it into a host app via
`"@onramper/react-native": "file:.."`, Metro will resolve `expo-modules-core`
and `react-native` from BOTH the host app and the wrapper repo's own
node_modules. That gives you two parallel `ReactNativeViewConfigRegistry`
Maps and a confusing "View config getter callback for component
`ViewManagerAdapter_OnramperReactNative` must be a function (received
`undefined`)" error.

Fix it in the host app's `metro.config.js`:

```js
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
```

Consumers installing from the npm registry don't see this — there's no
symlink, so only one copy resolves.

---

## 8. Verifying your setup

After installation, you should be able to:

```bash
# JS contract checks
npx tsc --noEmit                # types resolve
npx expo-doctor                 # config validation

# iOS build
cd ios && pod install
cd .. && npx expo run:ios --device "Your iPhone"
```

In Xcode (or via `codesign -dvv path/to/YourApp.app`), confirm:
- **Team identifier**: matches your Apple Developer team
- **Bundle identifier**: matches what's registered with Apple
- **Entitlements** include `com.apple.developer.devicecheck.appattest-environment`

In the running app, calling `client.initialize(...)` with valid staging
credentials should drive the state machine through `initializing` → `ready`.
If you see `failed: attestationFailed`, you're on the simulator or missing
the App Attest entitlement. If you see `failed: networkError`, the device
can't reach the Onramper backend.

---

## 9. Going-live checklist

- [ ] Production `apiKey` and `clientId` configured per build flavour (no staging credentials in release builds).
- [ ] App Attest entitlement enabled on the production app id; signing team set under **Signing & Capabilities**.
- [ ] Backend session-mint endpoint deployed and reachable from the production app; returns both `sessionId` and `sessionToken`.
- [ ] `onSessionExpired` wired to your auth client and **tested end-to-end** by forcing a session expiry (e.g. revoke the SDK session server-side mid-checkout) and confirming the user sees no error.
- [ ] `logLevel: 'off'` in production JS bundles.
- [ ] Tested on a real device (not just simulator) — attestation path verified.
- [ ] Error UI covers at minimum `amountOutOfRange`, `quoteUnavailable`, `checkoutForbidden`, `temporaryFailure`, `networkError`, `deviceBlocked`, `configurationError`, and `unrecoverable`.
- [ ] Analytics / observability hooked into `addStateListener` or `addEventListener('failed' | 'completed', …)`.
- [ ] `client.destroy()` called on unmount so re-mounting doesn't leak listeners.

---

## 10. Getting help

- Wrapper bug? File an issue at
  [github.com/onramper/onramper-react-native](https://github.com/onramper/onramper-react-native/issues)
- iOS SDK behavior question? File against `onramper/onramper-ios`.
- Onramper backend / partner credentials? Contact your Onramper account manager.
