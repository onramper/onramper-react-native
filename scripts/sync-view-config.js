#!/usr/bin/env node
// Copies the nitrogen-generated Fabric view config JSON into src/generated/ so
// the published build can resolve it.
//
// react-native-builder-bob only relocates files under `src/` into `lib/`; an
// import that reaches outside `src/` (e.g. `../nitrogen/generated/...`) is left
// verbatim in the emitted lib/ files and resolves to the wrong directory. By
// vendoring the generated config under src/ and importing it locally, the bob
// output stays correct. nitrogen remains the source of truth — this runs as
// part of `npm run nitrogen`, and the copy is committed alongside the other
// generated artifacts.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'nitrogen', 'generated', 'shared', 'json', 'OnramperCheckoutButtonConfig.json');
const destDir = path.join(root, 'src', 'generated');
const dest = path.join(destDir, 'OnramperCheckoutButtonConfig.json');

if (!fs.existsSync(src)) {
  console.error(`Missing ${path.relative(root, src)} — run \`npm run nitrogen\` first.`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Synced ${path.relative(root, src)} -> ${path.relative(root, dest)}`);
