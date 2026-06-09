# Onramper React Native — Expo example

The **Expo** demo for [`@onramper/onramper-react-native`](../). It exercises `OnramperClient` end-to-end
(prepare intent → quote → present widget) inside an Expo app using **prebuild** and a **dev client**.

> This app is **iOS-only** (`app.json` → `platforms: ["ios"]`) and integrates the SDK via its Expo
> [config plugin](app.json) (`plugins: ["@onramper/onramper-react-native"]`).
>
> Looking for the **bare React Native** integration instead? See [`../example`](../example).

## Prerequisites

- **Node** ≥ 22.11.0
- **Xcode** + an iOS Simulator (or a provisioned device)
- **CocoaPods** + Ruby bundler (`bundle install` on first clone)
- The library is consumed as `@onramper/onramper-react-native: file:..`, so the **parent package must be built**
  and its native **xcframework fetched** before this app can build (see Step 1).

## Step 1 — Build the library (from the repo root)

```sh
cd ..                        # repo root
npm install                  # install + build the library (bob)
npm run fetch-xcframework    # download OnramperSDK.xcframework into ios/Frameworks
```

`fetch-xcframework` uses `gh release download`, so make sure `gh auth status` shows an active
account with access to the `onramper/onramper-ios` repo. (CI uses a `RELEASE_REPO_TOKEN` instead.)

## Step 2 — Install this app's dependencies

```sh
cd example-expo
npm install
```

## Step 3 — Configure secrets

Demo credentials are read from a gitignored `env.local.ts`. Copy the template and fill in real values:

```sh
cp env.local.example.ts env.local.ts
```

```ts
// env.local.ts
export const ENV = {
  apiKey: 'pk_test_…',   // Onramper publishable API key
  clientId: '01K…',      // Onramper client id
  demoToken: '…',        // token for the dev-only demo session mint
};
```

`demoToken` is used by [`createDemoSession.ts`](createDemoSession.ts) to mint a session against
`demo-stg.onramper.dev` — **dev only**, never ship a client-side session mint to production.

## Step 4 — Build & run on iOS

The first run does a native prebuild + `pod install`, so it takes a few minutes:

```sh
npm run ios          # expo run:ios — prebuild, build, install & launch the dev client
```

Once the dev client is installed, iterate quickly by just starting Metro:

```sh
npm start            # expo start --dev-client
```

Then reload the app (press <kbd>R</kbd> in the Simulator) to pick up JS changes via Fast Refresh.

## Using the app

The screen is a small harness: edit the transaction fields (source/destination/amount, payment
method, wallet) and use the buttons to create a client, fetch a quote, and present the widget.
A live log at the bottom shows SDK state transitions and any errors.

## Troubleshooting

- **`OnramperSDK.xcframework` not found / pod install fails** — rerun Step 1; the xcframework must
  exist at the repo root `ios/Frameworks/` before building.
- **Stale native build after dependency changes** — `rm -rf ios && npm run ios` to regenerate the
  prebuild, or `cd ios && pod install` if only pods changed.
- **`env.local.ts` missing** — the app imports `ENV` from it; complete Step 3.
- General Expo issues: [Expo docs](https://docs.expo.dev). General RN issues:
  [React Native troubleshooting](https://reactnative.dev/docs/troubleshooting).
