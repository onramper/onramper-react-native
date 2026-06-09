#!/usr/bin/env node
// Trims link-irrelevant artifacts from ios/Frameworks/OnramperSDK.xcframework
// before the framework is packed into the npm tarball. Run AFTER
// `fetch-xcframework` + `verify-version` (those hash the source .zip; this
// mutates the unzipped directory only).
//
// Removed (not used to compile/link against the framework):
//   - **/*.swiftmodule/*.abi.json                 (ABI-diffing tooling only)
//   - **/*.swiftmodule/Project/                   (*.swiftsourceinfo; leaks internal paths)
//   - **/*.swiftmodule/*.private.swiftinterface   (non-public API surface)
//   - **/*.swiftmodule/*.package.swiftinterface   (non-public API surface)
//
// KEPT intentionally: dSYMs (downstream crash symbolication), the OnramperSDK
// binary, Info.plist, the public *.swiftinterface + *.swiftdoc, module.modulemap,
// the resource bundle, and PrivacyInfo.xcprivacy.

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const xcframework = path.join(root, 'ios', 'Frameworks', 'OnramperSDK.xcframework');

if (!fs.existsSync(xcframework)) {
  console.error('ios/Frameworks/OnramperSDK.xcframework not found — run `npm run fetch-xcframework` first.');
  process.exit(1);
}

let removedFiles = 0;
let removedBytes = 0;

function sizeOf(p) {
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  return fs
    .readdirSync(p)
    .reduce((sum, name) => sum + sizeOf(path.join(p, name)), 0);
}

function remove(p) {
  removedBytes += sizeOf(p);
  const before = countFiles(p);
  fs.rmSync(p, { recursive: true, force: true });
  removedFiles += before;
}

function countFiles(p) {
  const st = fs.statSync(p);
  if (!st.isDirectory()) return 1;
  return fs.readdirSync(p).reduce((n, name) => n + countFiles(path.join(p, name)), 0);
}

// Walk every *.swiftmodule directory inside the framework and prune within it.
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.endsWith('.swiftmodule')) {
        pruneSwiftModule(full);
      } else {
        walk(full);
      }
    }
  }
}

function pruneSwiftModule(moduleDir) {
  for (const entry of fs.readdirSync(moduleDir, { withFileTypes: true })) {
    const full = path.join(moduleDir, entry.name);
    if (entry.isDirectory() && entry.name === 'Project') {
      remove(full); // *.swiftsourceinfo
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.abi.json') ||
        entry.name.endsWith('.private.swiftinterface') ||
        entry.name.endsWith('.package.swiftinterface'))
    ) {
      remove(full);
    }
  }
}

walk(xcframework);

console.log(
  `Slimmed xcframework: removed ${removedFiles} file(s), ${(removedBytes / 1e6).toFixed(1)} MB (dSYMs kept).`,
);
