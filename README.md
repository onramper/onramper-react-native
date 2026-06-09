# @onramper/onramper-react-native

React Native wrapper for the Onramper iOS SDK.

> **iOS only.** Android calls throw `platformUnsupported`. A native Android SDK is not part of this release.

## Install

```bash
npm install @onramper/onramper-react-native react-native-nitro-modules
cd ios && pod install
```

Requires React Native 0.79+, `react-native-nitro-modules` 0.35+, the **New Architecture**, and an iOS **16.0+** deployment target. Works in **bare React Native (no Expo required)** and **Expo** apps — not Expo Go, since the package vendors a native binary.

**Expo apps** — add the bundled config plugin to `app.json`, then prebuild:

```json
{ "expo": { "plugins": ["@onramper/onramper-react-native"] } }
```

The plugin applies the required iOS build flag (it does not change your deployment target). Set your app's deployment target to **16.4+** — Expo SDK 56's own minimum (bare RN only needs 16.0). For bare-RN Podfile setup (Xcode 16+/26) and full details, see the [integration guide](docs/INTEGRATION.md).

## Quick start

```ts
import { OnramperClient } from '@onramper/onramper-react-native';

const client = new OnramperClient({
  apiKey: 'pk_live_...',
  clientId: '01K...',
  environment: 'production',
  // Fully async — fetch fresh credentials when the SDK asks.
  onSessionExpired: async () => {
    const r = await fetch('/api/onramper-session', { method: 'POST' });
    return r.json();
  },
});

await client.initialize({ sessionId, sessionToken });

const { button, quote } = await client.getCheckoutRequirements({
  source: 'usd',
  destination: 'eth',
  amount: 100,
  type: 'buy',
  paymentMethod: 'creditcard',
  wallet: { network: 'ethereum', address: '0x...' },
});

return (
  <View>
    <Text>Rate: {quote.rate ?? 'unavailable'}</Text>
    {button}
  </View>
);
```

The button renders natively and presents login + payment sheets internally. ToS is rendered inside the button view.

## Checkout events

The SwiftUI `OnramperCheckoutButton` does not expose external callback hooks; checkout outcomes flow via the module-level event stream:

```ts
const unsub = client.addEventListener('completed', (e) => {
  console.log('done:', e.checkoutId);
});

const onFailed = client.addEventListener('failed', (e) => {
  console.log('failed:', e.error.code, e.error.message);
});
```

## Error handling

All native errors arrive as `OnramperError` with a typed `code`:

```ts
import { OnramperError } from '@onramper/onramper-react-native';

try {
  await client.initialize({ sessionId, sessionToken });
} catch (e) {
  if (e instanceof OnramperError) {
    switch (e.code) {
      case 'deviceBlocked':
      case 'amountOutOfRange':
      // ...
    }
  }
}
```

Full code list in `src/errors.ts`.

## Versioning

`@onramper/onramper-react-native@X.Y.Z` always bundles `OnramperSDK@X.Y.Z` (iOS). Wrapper-only patches are published as `X.Y.Z-N` pre-releases (`npm install @onramper/onramper-react-native@next` to opt in).

## Privacy manifest

The vendored `OnramperSDK.xcframework` already ships its own `PrivacyInfo.xcprivacy`. Don't add a duplicate.

## Known limitations

- Native checkout outcomes are observed via the module-level event stream (`client.addEventListener(...)`); the native checkout button exposes no per-instance callbacks.

## Troubleshooting

- **`pod install` fails finding the xcframework** — confirm `node_modules/@onramper/onramper-react-native/ios/Frameworks/OnramperSDK.xcframework/` exists.
- **Bare RN build fails with `module map file ... not found` (Xcode 16+/26)** — disable explicit Swift modules in your `Podfile` `post_install` (`SWIFT_ENABLE_EXPLICIT_MODULES = NO`). Expo apps get this automatically via the config plugin. See the [integration guide](docs/INTEGRATION.md).
- **App Attest errors in simulator** — expected. App Attest only works on real devices. The SDK surfaces this as `attestationFailed`.
- **Buttons appear but sheets don't open** — the host RN screen must be inside a normal `UIViewController` (the default). Modal-presented screens may need extra care; report an issue with a repro.
