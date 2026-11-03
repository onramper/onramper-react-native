#!/usr/bin/env node
// Verifies that the onramper-ios release this package resolves exists: the
// podspec pins onramper-ios to this package's version (without a prerelease
// suffix) through Swift Package Manager, so publishing before that tag exists,
// or against a tag without the products the podspec links, ships a package
// whose `pod install` / Xcode build fails for every app.
//
// Checks that tag `v<version>` of onramper/onramper-ios has a Package.swift
// declaring every product the podspec can link (onramper_spm.rb). Runs from
// `prepack` and in CI. SDK development: ONRAMPER_IOS_PACKAGE_URL=file:///path
// checks that local copy's Package.swift instead.

const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const REPO = 'onramper/onramper-ios';
// Keep in sync with OnramperSPM.products in onramper_spm.rb.
const PRODUCTS = ['OnramperSDK', 'OnramperStripe'];

function missingProducts(manifest) {
  return PRODUCTS.filter((name) => !new RegExp(`\\.library\\(\\s*name:\\s*"${name}"`).test(manifest));
}

async function readManifest(version) {
  const override = process.env.ONRAMPER_IOS_PACKAGE_URL;
  if (override?.startsWith('file://')) {
    const file = path.join(fileURLToPath(override), 'Package.swift');
    return { source: file, manifest: fs.readFileSync(file, 'utf8') };
  }
  const url = `https://raw.githubusercontent.com/${REPO}/v${version}/Package.swift`;
  const response = await fetch(url);
  if (response.status === 404) {
    throw new Error(`${REPO} has no tag v${version} (or it has no Package.swift). Release the iOS SDK first.`);
  }
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  return { source: `${REPO}@v${version}`, manifest: await response.text() };
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const version = String(pkg.version).split('-')[0];
  const { source, manifest } = await readManifest(version);
  const missing = missingProducts(manifest);
  if (missing.length > 0) {
    throw new Error(`${source} Package.swift doesn't declare product(s) ${missing.join(', ')}.`);
  }
  console.log(`OK: ${source} declares ${PRODUCTS.join(', ')}.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { missingProducts, PRODUCTS };
