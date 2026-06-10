#!/usr/bin/env node
// Fetches OnramperSDK.xcframework.zip from the onramper/onramper-ios GitHub
// release matching package.json's `version` (stripping any -N prerelease suffix),
// verifies SHA-256 against onramperSDK.checksum, unzips into ios/Frameworks/,
// and (if checksum was 'PENDING_FETCH') writes the computed checksum back to
// package.json.
//
// Uses `gh release download` so the same script works for public AND private
// releases transparently — the user's `gh auth` token is used implicitly.
// `spawnSync` with an argv array (no shell) keeps the call injection-safe.

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
const recordedChecksum = pkg.onramperSDK?.checksum;

const dest = path.join(root, 'ios', 'Frameworks');
fs.mkdirSync(dest, { recursive: true });
const zipPath = path.join(dest, assetName);

// Clean up any prior download so `gh release download` doesn't refuse.
if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });

console.log(`Downloading ${releaseTag}/${assetName} from ${releaseRepo} ...`);
const gh = spawnSync(
  'gh',
  ['release', 'download', releaseTag, '-R', releaseRepo, '-p', assetName, '-D', dest],
  { stdio: 'inherit' },
);
if (gh.status !== 0) {
  console.error(`gh release download failed (status ${gh.status}).`);
  console.error('Ensure `gh auth status` shows an active account with access to the repo.');
  process.exit(gh.status ?? 1);
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
