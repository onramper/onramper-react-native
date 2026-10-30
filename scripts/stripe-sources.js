// OnramperStripe sources: the iOS SDK's Stripe checkout module, which ships as
// Swift source (Sources/OnramperStripe in onramper/onramper-ios) because it
// builds against Stripe's iOS SDK. We copy it from the same release tag as the
// xcframework into ios/OnramperStripe/ (gitignored, packed into the npm tarball)
// and the pod compiles it next to our bridge.
//
// Integrity: the tag's source archive is not byte-stable, so we hash the
// extracted files instead. The checksum is SHA-256 over, for each *.swift file
// sorted by name, "<name>\0<sha256 of contents>\n". It is recorded under
// onramperSDK.stripeSourcesChecksum and verified exactly like the xcframework
// checksum ('PENDING_FETCH' or missing = record it on the next fetch).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const RELATIVE_DIR = path.join('ios', 'OnramperStripe');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function swiftFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.swift'))
    .sort();
}

function sourcesChecksum(dir) {
  const manifest = swiftFiles(dir)
    .map((name) => `${name}\0${sha256(fs.readFileSync(path.join(dir, name)))}\n`)
    .join('');
  return sha256(manifest);
}

function fetchStripeSources({ root, pkgPath, releaseRepo, releaseTag }) {
  const archiveUrl = `https://codeload.github.com/${releaseRepo}/tar.gz/refs/tags/${releaseTag}`;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'onramper-stripe-'));
  try {
    const archive = path.join(work, 'source.tar.gz');
    console.log(`Downloading ${releaseTag} sources from ${releaseRepo} (Sources/OnramperStripe) ...`);
    const curl = spawnSync(
      'curl',
      ['--fail', '--location', '--silent', '--show-error', '--retry', '3', '--retry-delay', '1', '--output', archive, archiveUrl],
      { stdio: 'inherit' },
    );
    if (curl.status !== 0) {
      console.error(`Source archive download failed (status ${curl.status}): ${archiveUrl}`);
      process.exit(curl.status ?? 1);
    }
    const tar = spawnSync('tar', ['-xzf', archive, '-C', work], { stdio: 'inherit' });
    if (tar.status !== 0) {
      console.error('Extracting the source archive failed.');
      process.exit(tar.status ?? 1);
    }
    // GitHub archives have one top-level directory (<repo>-<tag without v>).
    const top = fs.readdirSync(work).find((name) => fs.statSync(path.join(work, name)).isDirectory());
    const extracted = top && path.join(work, top, 'Sources', 'OnramperStripe');
    if (!extracted || !fs.existsSync(extracted) || swiftFiles(extracted).length === 0) {
      console.error(`${releaseTag} has no Sources/OnramperStripe/*.swift. Is this release older than 1.5.0?`);
      process.exit(1);
    }

    const dest = path.join(root, RELATIVE_DIR);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    for (const name of swiftFiles(extracted)) {
      fs.copyFileSync(path.join(extracted, name), path.join(dest, name));
    }

    const computed = sourcesChecksum(dest);
    console.log(`Computed OnramperStripe sources checksum: ${computed}`);
    // Re-read: the xcframework step may have just written its own checksum.
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const recorded = pkg.onramperSDK?.stripeSourcesChecksum;
    if (!recorded || recorded === 'PENDING_FETCH') {
      pkg.onramperSDK = pkg.onramperSDK || {};
      pkg.onramperSDK.stripeSourcesChecksum = computed;
      fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      console.log('Wrote computed OnramperStripe sources checksum to package.json.');
    } else if (recorded !== computed) {
      console.error(`OnramperStripe sources checksum mismatch! recorded=${recorded} computed=${computed}`);
      process.exit(1);
    }
    console.log(`Copied ${swiftFiles(dest).length} OnramperStripe source file(s) into ${RELATIVE_DIR}/.`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// For verify-version / prepack: returns an error message, or null when the
// fetched sources match the recorded checksum.
function stripeSourcesProblem(root, pkg) {
  const dir = path.join(root, RELATIVE_DIR);
  if (!fs.existsSync(dir) || swiftFiles(dir).length === 0) {
    return `${RELATIVE_DIR}/*.swift not found. Run \`npm run fetch-xcframework\`.`;
  }
  const recorded = pkg.onramperSDK?.stripeSourcesChecksum;
  const computed = sourcesChecksum(dir);
  if (recorded !== computed) {
    return `OnramperStripe sources checksum mismatch.\n  recorded: ${recorded}\n  computed: ${computed}`;
  }
  return null;
}

module.exports = { fetchStripeSources, sourcesChecksum, stripeSourcesProblem, RELATIVE_DIR };
