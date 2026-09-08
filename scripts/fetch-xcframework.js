#!/usr/bin/env node
// Fetches OnramperSDK.xcframework.zip from the onramper/onramper-ios GitHub
// release matching package.json's `version` (stripping any -N prerelease suffix),
// verifies SHA-256 against onramperSDK.checksum, unzips into ios/Frameworks/,
// and (if checksum was 'PENDING_FETCH') writes the computed checksum back to
// package.json.
//
// The release repository is public, so download its stable asset URL directly.
// No GitHub account or token is required. `spawnSync` with an argv array (no
// shell) keeps the call injection-safe.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const baseVersion = pkg.version.split('-')[0];
const releaseTag = `v${baseVersion}`;
const releaseRepo = 'onramper/onramper-ios';
const assetName = 'OnramperSDK.xcframework.zip';
const assetUrl = `https://github.com/${releaseRepo}/releases/download/${releaseTag}/${assetName}`;
const recordedChecksum = pkg.onramperSDK?.checksum;

const dest = path.join(root, 'ios', 'Frameworks');
fs.mkdirSync(dest, { recursive: true });
const zipPath = path.join(dest, assetName);

// Clean up any prior download so a failed/retried fetch cannot reuse stale data.
if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });

console.log(`Downloading ${releaseTag}/${assetName} from ${releaseRepo} ...`);
const curl = spawnSync(
  'curl',
  [
    '--fail',
    '--location',
    '--silent',
    '--show-error',
    '--retry',
    '3',
    '--retry-delay',
    '1',
    '--output',
    zipPath,
    assetUrl,
  ],
  { stdio: 'inherit' },
);
if (curl.status !== 0) {
  console.error(`Public release download failed (status ${curl.status}).`);
  console.error(`Release asset: ${assetUrl}`);
  process.exit(curl.status ?? 1);
}

const computed = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
console.log(`Computed checksum: ${computed}`);

if (!recordedChecksum || recordedChecksum === 'PENDING_FETCH') {
  pkg.onramperSDK = pkg.onramperSDK || {};
  pkg.onramperSDK.checksum = computed;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('Wrote computed checksum to package.json.');
} else if (recordedChecksum !== computed) {
  console.error(`Checksum mismatch! recorded=${recordedChecksum} computed=${computed}`);
  process.exit(1);
}

const xcfPath = path.join(dest, 'OnramperSDK.xcframework');
fs.rmSync(xcfPath, { recursive: true, force: true });
// -o: overwrite without prompting. The zip also contains a sibling LICENSE that
// may already exist from a prior fetch; without -o, unzip blocks on an
// interactive prompt and aborts (fine in fresh CI, breaks local re-fetch).
const unzip = spawnSync('unzip', ['-oq', zipPath, '-d', dest], { stdio: 'inherit' });
if (unzip.status !== 0) {
  console.error('unzip failed');
  process.exit(unzip.status ?? 1);
}
console.log('Unzipped xcframework into ios/Frameworks/.');
