# iOS build setup for `@onramper/onramper-react-native`

Build-time configuration for embedding the Onramper iOS SDK: iOS build settings, App Attest, the first build, and Metro. For the full integration walkthrough — install, usage, error handling, API reference — see [Getting started](doc:getting-started-1).

---

## 1. iOS build settings (bare React Native)

Bare RN apps need two iOS settings the package requires. (Expo apps get these from the config plugin — see [Getting started](doc:getting-started-1).)

Set your app's iOS deployment target to **16.0+**, and disable explicit Swift modules in the `Podfile` `post_install`:

```ruby
platform :ios, '16.0'

# ... target block ...

post_install do |installer|
  react_native_post_install(installer, config[:reactNativePath], :mac_catalyst_enabled => false)

  # Xcode 16+/26: explicit Swift modules break the app target's "Emit Swift
  # module" phase for CocoaPods Swift pods (NitroModules, OnramperReactNative,
  # RN's RCTSwiftUI) with "module map file ... not found". Build implicit modules.
  installer.pods_project.targets.each do |t|
    t.build_configurations.each { |c| c.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO' }
  end
  installer.aggregate_targets.each do |at|
    next if at.user_project.nil?
    at.user_project.native_targets.each do |t|
      t.build_configurations.each { |c| c.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO' }
    end
    at.user_project.save
  end
end
```

The Headless Wrapper's minimum is iOS 16.0; set your app target's deployment target to 16.0 (or higher) as well. Autolinking is automatic — the package's podspec is discovered without any `react-native.config.js` change.

---

## 2. App Attest & first build

### 2.1 App Attest capability

The Headless Wrapper attests every session via Apple's `DCAppAttestService`. Without the entitlement, attestation returns `attestationFailed`.

In Xcode → your target → **Signing & Capabilities** → **+ Capability** → **App Attest**. This adds:

```xml
<key>com.apple.developer.devicecheck.appattest-environment</key>
<string>development</string>
```

For App Store builds, Xcode automatically switches to `production`.

You'll also need to set a **Development Team** under Signing & Capabilities. The Headless Wrapper works with any team; the bundle ID just needs to be registered with Apple Developer Portal (Xcode does this automatically when you enable automatic signing).

### 2.2 Pod install + first build

Bare RN:

```bash
cd ios && pod install
cd .. && npx react-native run-ios --device
```

Expo:

```bash
npx expo prebuild
npx expo run:ios --device
```

---

## 3. Metro configuration

Use the standard Metro and Babel config for your app type — no special setup is required for this package.

**Bare RN** (the React Native Community CLI defaults):

```js
// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
module.exports = mergeConfig(getDefaultConfig(__dirname), {});
```

```js
// babel.config.js
module.exports = { presets: ['module:@react-native/babel-preset'] };
```

**Expo** apps use Expo's defaults (`expo/metro-config`, `babel-preset-expo`) — unchanged.
