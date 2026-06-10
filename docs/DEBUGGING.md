Known limitations and gotchas when integrating `@onramper/onramper-react-native`. For the full integration walkthrough — install, usage, error handling, API reference — see [Getting started](doc:headless-react-native-getting-started).

---

## App Attest in the simulator
Always returns `attestationFailed`. Apple's `DCAppAttestService` only works on physical iOS 14+ devices. Use a real device for any end-to-end test.

## Xcode 16+/26 Swift modules
The app target's "Emit Swift module" phase can fail with `module map file ... not found` for the Swift pods. Disable explicit Swift modules (`SWIFT_ENABLE_EXPLICIT_MODULES = NO`) — see [iOS build setup](doc:ios-build-setup) for the Podfile snippet. Expo apps get this from the config plugin.

## Android
Stub-only. All Android calls throw `platformUnsupported`. A native Android SDK is not part of this release.

## Local development via `file:` symlink (contributors only)
If you link the wrapper into a host app via `"@onramper/onramper-react-native": "file:.."`, Metro can resolve `react-native-nitro-modules` and `react-native` from BOTH the host app and the wrapper repo's own node_modules — two parallel module instances, which break native view/registry lookups.

Fix it in the host app's `metro.config.js` (force a single copy):

```js
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
```

On a **bare RN (Community CLI)** host, the `file:..` symlink also hides the package from CLI autolinking; add a `react-native.config.js` in the host app pointing at the package root and its podspec. Registry installs hit neither issue — there's no symlink.
