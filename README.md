# @onramper/react-native

React Native wrapper for the Onramper iOS SDK.

> **iOS only.** Android calls throw `platformUnsupported`. A native Android SDK is not part of this release.

## Install

```bash
npm install @onramper/react-native expo-modules-core
cd ios && pod install
```

Requires React Native 0.81+, `expo-modules-core` 56+, and iOS deployment target 16.4. Works in bare RN and Expo dev clients (not Expo Go — the package vendors a native binary).

If your app doesn't yet use Expo Modules:

```bash
npx install-expo-modules@latest
```

## Quick start

```ts
import { OnramperClient } from '@onramper/react-native';

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
  onramp: 'moonpay',
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
import { OnramperError } from '@onramper/react-native';

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

`@onramper/react-native@X.Y.Z` always bundles `OnramperSDK@X.Y.Z` (iOS). Wrapper-only patches are published as `X.Y.Z-N` pre-releases (`npm install @onramper/react-native@next` to opt in).

## Privacy manifest

The vendored `OnramperSDK.xcframework` already ships its own `PrivacyInfo.xcprivacy`. Don't add a duplicate.

## Known limitations (v1)

- `CheckoutEvent.checkoutCancelled` is not surfaced in this release — the bundled `OnramperSDK@1.0.0` xcframework doesn't include the case. It will be available when the SDK is rebuilt with the case.
- Native checkout outcomes flow via the module-level event stream (`client.addEventListener(...)`), not per-view event handlers. The view's `onCheckoutCompleted`/`onCheckoutFailed`/`onCheckoutCancelled` props are declared for forward-compat but only `onCheckoutFailed` fires today (for handle-binding errors).

## Troubleshooting

- **`pod install` fails finding the xcframework** — confirm `node_modules/@onramper/react-native/ios/Frameworks/OnramperSDK.xcframework/` exists.
- **App Attest errors in simulator** — expected. App Attest only works on real devices. The SDK surfaces this as `attestationFailed`.
- **Buttons appear but sheets don't open** — the host RN screen must be inside a normal `UIViewController` (the default). Modal-presented screens may need extra care; report an issue with a repro.
