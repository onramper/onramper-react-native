# Onramper React Native bare example

This app demonstrates the Nitro-based Onramper React Native SDK, including
configuration, checkout requirements, optional user prefill, and the durable
Onramper transaction ID.

## Prerequisites

- Node.js 22.11 or newer.
- Standalone CocoaPods 1.16.2. The committed iOS lockfile was generated with
  this version; use it rather than the Gemfile-pinned 1.15.2 for this example.
- iOS 16 or newer.
- A registered real device with App Attest available. The Onramper SDK does not
  support simulator checkout flows.

## Environment-file setup

Copy `env.local.example.ts` to `env.local.ts` and replace the placeholder
values with your development API key, client ID, and demo token. The local file
is ignored by Git so credentials stay out of the repository.

## Install

Install the repository package and fetch the pinned iOS SDK framework before
installing the example and its pods:

```bash
# repository root
npm ci
npm run fetch-xcframework

cd example
npm ci
cd ios
pod --version  # must print 1.16.2 for a no-churn lockfile update
pod install
```

## Run on iOS

From `example/`, with a real registered device connected, run; the CLI selects the connected registered device:

```bash
npm run ios -- --device
```
