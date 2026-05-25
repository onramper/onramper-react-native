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

### 2.4 App Attest capability (required in production, recommended in dev)

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

```ts
import { OnramperClient } from '@onramper/react-native';

const client = new OnramperClient({
  apiKey: 'pk_live_...',           // your partner API key
  clientId: '01K...',              // your partner client ID
  environment: 'production',       // or 'development' for staging BFF
  theme: 'system',                 // 'system' | 'light' | 'dark'
  logLevel: 'off',                 // 'off' | 'error' | 'info' | 'debug'

  // Called by the SDK when the session token expires. May be async.
  // Implement on your backend: this should hit YOUR session-mint endpoint
  // that holds the partner-private demoToken/secret.
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

// Get a checkout button + quote in one call.
const { button, quote } = await client.getCheckoutRequirements(
  {
    onramp: 'moonpay',
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

The Buy button renders natively (SwiftUI under the hood) and presents OIDC
login + payment webview sheets internally. Terms-of-service text appears
below the button automatically.

### 4.1 Listening to checkout outcomes

The SwiftUI button doesn't expose per-instance callbacks. Subscribe to the
SDK's event stream:

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
```

### 4.2 Error handling

Every native error surfaces as `OnramperError` with a typed `code`:

```ts
import { OnramperError } from '@onramper/react-native';

try {
  await client.initialize({ sessionId, sessionToken });
} catch (e) {
  if (e instanceof OnramperError) {
    switch (e.code) {
      case 'deviceBlocked':           // App Attest device on blocklist
      case 'attestationFailed':       // App Attest failed (simulator?)
      case 'amountOutOfRange':        // outside partner min/max
      case 'networkError':            // BFF or network unreachable
      case 'configurationError':      // invalid apiKey/clientId
      case 'temporaryFailure':        // transient — retry with backoff
      // ... see src/errors.ts for the full code list
    }
  }
}
```

---

## 6. Backend requirements

The SDK calls Onramper's BFF directly. Your **backend** is responsible for:

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

### `CheckoutEvent.checkoutCancelled` is not surfaced
The bundled `OnramperSDK@1.0.0` xcframework doesn't include the
`checkoutCancelled` case. It will be re-added when the SDK is rebuilt with
the case. To detect cancellation today, subscribe to state changes and watch
for unexpected transitions back to `ready`.

### App Attest in the simulator
Always returns `attestationFailed`. Apple's `DCAppAttestService` only works
on physical iOS 14+ devices. Use a real device for any end-to-end test.

### Per-view event handlers
`OnramperCheckoutButtonView` declares `onCheckoutCompleted` /
`onCheckoutFailed` / `onCheckoutCancelled` props for forward-compatibility,
but only `onCheckoutFailed` fires today (for handle-binding errors). Use
`client.addEventListener(...)` for checkout outcomes.

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
can't reach the BFF.

---

## 9. Getting help

- Wrapper bug? File an issue at
  [github.com/onramper/onramper-react-native](https://github.com/onramper/onramper-react-native/issues)
- iOS SDK behavior question? File against `onramper/onramper-ios`.
- BFF / partner credentials? Contact your Onramper account manager.
