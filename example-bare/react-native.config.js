// This example app lives inside the library repo and consumes the package via
// `file:..` (a symlink whose realpath is the repo root, OUTSIDE this app's
// node_modules). The React Native Community CLI autolinker does not detect
// native code through that symlink on its own, so we declare the local package
// explicitly here — rooted at the repo, with the iOS podspec path spelled out
// (the podspec lives in ios/, which the CLI does not probe by default).
const path = require('node:path');
const pkg = require('../package.json');

const repoRoot = path.join(__dirname, '..');

module.exports = {
  dependencies: {
    [pkg.name]: {
      root: repoRoot,
      platforms: {
        ios: {
          podspecPath: path.join(repoRoot, 'ios', 'OnramperReactNative.podspec'),
        },
      },
    },
  },
};
