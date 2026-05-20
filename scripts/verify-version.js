#!/usr/bin/env node
// Verifies that the SHA-256 checksum of ios/Frameworks/OnramperSDK.xcframework.zip
// matches the value recorded under `onramperSDK.checksum` in package.json.
// Run in CI before publishing to make desync mechanically impossible.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const zipPath = path.join(root, 'ios', 'Frameworks', 'OnramperSDK.xcframework.zip');

if (!fs.existsSync(zipPath)) {
  console.error('ios/Frameworks/OnramperSDK.xcframework.zip not found — run `npm run fetch-xcframework`.');
  process.exit(1);
}

const computed = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
const recorded = pkg.onramperSDK?.checksum;

if (recorded !== computed) {
  console.error(`Checksum mismatch.\n  recorded: ${recorded}\n  computed: ${computed}`);
  process.exit(1);
}
console.log(`OK: package.json checksum matches xcframework (${computed.slice(0, 12)}...).`);
