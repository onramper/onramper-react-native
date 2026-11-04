#!/usr/bin/env node
// Verifies the onramper-ios release this package resolves. The podspec pins
// onramper-ios through Swift Package Manager to the commit recorded in
// package.json `onramperIOS.revision`, which must be the commit of tag
// v<version> (this package's version without a prerelease suffix).
//
// Checks:
//   - the tag exists and still points at the recorded commit (a moved or
//     re-created tag fails here instead of silently changing what apps build);
//   - that commit's Package.swift declares every product the podspec can link
//     (onramper_spm.rb).
//
// `--record` writes the tag's current commit into package.json first (the
// release workflow does this once, when the version is cut). Runs from
// `prepack` and in CI. SDK development: ONRAMPER_IOS_PACKAGE_URL=file:///path
// checks that local copy's Package.swift instead.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { fileURLToPath } = require('node:url');

const REPO = 'onramper/onramper-ios';
const REPO_URL = `https://github.com/${REPO}`;
// Keep in sync with OnramperSPM.products in onramper_spm.rb.
const PRODUCTS = ['OnramperSDK', 'OnramperStripe'];
const PKG_PATH = path.join(__dirname, '..', 'package.json');

function missingProducts(manifest) {
  return PRODUCTS.filter((name) => !new RegExp(`\\.library\\(\\s*name:\\s*"${name}"`).test(manifest));
}

// The commit a tag points at; for an annotated tag, the peeled `^{}` entry.
function tagCommit(lsRemoteOutput, tag) {
  const refs = new Map(
    lsRemoteOutput
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, ref] = line.split('\t');
        return [ref, sha];
      }),
  );
  return refs.get(`refs/tags/${tag}^{}`) ?? refs.get(`refs/tags/${tag}`);
}

async function fetchManifest(revision) {
  const url = `https://raw.githubusercontent.com/${REPO}/${revision}/Package.swift`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const record = process.argv.includes('--record');
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const version = String(pkg.version).split('-')[0];

  const override = process.env.ONRAMPER_IOS_PACKAGE_URL;
  if (override?.startsWith('file://')) {
    const file = path.join(fileURLToPath(override), 'Package.swift');
    const missing = missingProducts(fs.readFileSync(file, 'utf8'));
    if (missing.length > 0) throw new Error(`${file} doesn't declare product(s) ${missing.join(', ')}.`);
    console.log(`OK (local override): ${file} declares ${PRODUCTS.join(', ')}.`);
    return;
  }

  const tag = `v${version}`;
  const output = execFileSync('git', ['ls-remote', REPO_URL, `refs/tags/${tag}`, `refs/tags/${tag}^{}`], {
    encoding: 'utf8',
  });
  const commit = tagCommit(output, tag);
  if (!commit) throw new Error(`${REPO} has no tag ${tag}. Release the iOS SDK first.`);

  if (record && pkg.onramperIOS?.revision !== commit) {
    pkg.onramperIOS = { ...pkg.onramperIOS, revision: commit };
    fs.writeFileSync(PKG_PATH, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`Recorded onramperIOS.revision = ${commit} (${tag}).`);
  }

  const recorded = pkg.onramperIOS?.revision;
  if (recorded !== commit) {
    throw new Error(
      `package.json onramperIOS.revision (${recorded ?? 'missing'}) is not the commit of ${REPO} ${tag} (${commit}). ` +
        'If the tag was moved on purpose, run `node scripts/verify-version.js --record` and review the change.',
    );
  }

  const missing = missingProducts(await fetchManifest(commit));
  if (missing.length > 0) {
    throw new Error(`${REPO} ${tag} (${commit}) Package.swift doesn't declare product(s) ${missing.join(', ')}.`);
  }
  console.log(`OK: ${REPO} ${tag} is ${commit.slice(0, 12)} and declares ${PRODUCTS.join(', ')}.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { missingProducts, tagCommit, PRODUCTS };
