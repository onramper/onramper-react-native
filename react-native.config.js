// Tells the React Native Community CLI autolinker where this package's iOS
// podspec lives. Without this, the CLI does not discover `ios/OnramperReactNative.podspec`
// (it is not at the package root), so the Nitro module's pod — and the
// `add_nitrogen_files` wiring in the podspec — never make it into a consumer's
// Podfile. Android is iOS-only-stub for now (see migration plan).
const path = require('node:path');

module.exports = {
  dependency: {
    platforms: {
      ios: {
        podspecPath: path.join(__dirname, 'ios', 'OnramperReactNative.podspec'),
      },
    },
  },
};
