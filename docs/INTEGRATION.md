# Integrating `@onramper/react-native`

A consumer-facing guide to embedding the Onramper iOS SDK in a React Native
app via this wrapper. Assumes you already have a React Native (or Expo) app
and want to add Onramper crypto onramping.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| iOS | 16.4+ | Deployment target |
| React Native | 0.85.3 | Exact pin matching Expo SDK 56's RN |
| Expo SDK | 56.0.3+ | Required — the wrapper is an Expo Module |
| `expo-modules-core` | 56.0.12+ | Autolinked via the `expo` package |
| Node | 22.11.0+ | Per Expo's engines field |
| Xcode | 16+ (Xcode 26 tested) | New Architecture / Bridgeless mandatory in SDK 56+ |
| Real iOS device | Required for App Attest | Simulator can launch but attestation will return `attestationFailed` |
| Apple Developer account | Required for signing | Free or paid; need App Attest capability under your team |

> **Bare React Native is not supported.** The wrapper exposes an Expo Module
> (`OnramperReactNativeModule`). You must use the Expo toolchain (`expo start`,
> `expo prebuild`, `babel-preset-expo`). If your project doesn't currently use
> Expo, the easiest path is to run `npx install-expo-modules@latest` to add
> the Expo Modules layer without committing to the full Expo workflow.

---

## 1. Install

```bash
npm install @onramper/react-native expo expo-modules-core
```

Make sure these versions are present in your `package.json`:

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

## 2. iOS configuration

### 2.1 Podfile properties (CRITICAL)

The wrapper bundles `OnramperSDK.xcframework` and depends on React's
TurboModule registry being properly initialized under Bridgeless mode. The
prebuilt `React.xcframework` Expo ships by default has a bug that leaves the
TurboModule registry empty on first launch. Override it:

`ios/Podfile.properties.json`:

```json
{
  "expo.jsEngine": "hermes",
  "ios.deploymentTarget": "16.4",
  "ios.buildReactNativeFromSource": "true"
}
```

The `buildReactNativeFromSource: "true"` is **required**. First build will be
slower (~5 min) because React Native compiles from source, but subsequent
builds are cached. Without this, the app crashes at startup with
`Invariant Violation: TurboModuleRegistry.getEnforcing('PlatformConstants')
could not be found`.

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

## 3. Metro configuration

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

## 4. JavaScript usage

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

## 5. Backend requirements

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

## 6. Known limitations & gotchas

### `ios.buildReactNativeFromSource = "true"` is mandatory
Without it, the app crashes immediately with a missing `PlatformConstants`
TurboModule error. The prebuilt `React.xcframework` shipped by Expo SDK 56
has incomplete C++-side module registration under Bridgeless mode. Building
React Native from source produces a working binary. Tracked as a known issue
in the React Native GitHub repo (see [RN #47352](https://github.com/facebook/react-native/issues/47352)
and related).

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

## 7. Verifying your setup

After installation, you should be able to:

```bash
# JS contract checks
npx tsc --noEmit                # types resolve
npx expo-doctor                 # config validation

# iOS build (will take ~5 min the first time due to source-built React)
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

## 8. Getting help

- Wrapper bug? File an issue at
  [github.com/onramper/onramper-react-native](https://github.com/onramper/onramper-react-native/issues)
- iOS SDK behavior question? File against `onramper/onramper-ios`.
- BFF / partner credentials? Contact your Onramper account manager.
