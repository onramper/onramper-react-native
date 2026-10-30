#!/usr/bin/env node
// prepack guard: refuse to pack/publish if the vendored xcframework is missing.
// The framework is gitignored and fetched via `npm run fetch-xcframework`, so a
// manual `npm pack`/`npm publish` from a fresh checkout would otherwise ship a
// binary-less, broken package. CI fetches it before publishing, so this is the
// safety net for local publishes.

const fs = require('node:fs');
const path = require('node:path');

const xcframework = path.resolve(__dirname, '..', 'ios', 'Frameworks', 'OnramperSDK.xcframework');

if (!fs.existsSync(xcframework)) {
  console.error('ios/Frameworks/OnramperSDK.xcframework is missing.');
  console.error('Run `npm run fetch-xcframework` before packing or publishing.');
  process.exit(1);
}

// The OnramperStripe sources are fetched the same way; without them the pod's
// Stripe checkout (and so the package) would not build.
const stripeSources = path.resolve(__dirname, '..', 'ios', 'OnramperStripe');
if (!fs.existsSync(stripeSources) || !fs.readdirSync(stripeSources).some((name) => name.endsWith('.swift'))) {
  console.error('ios/OnramperStripe/*.swift is missing.');
  console.error('Run `npm run fetch-xcframework` before packing or publishing.');
  process.exit(1);
}
