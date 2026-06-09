// Expo config plugin for @onramper/onramper-react-native.
//
// Applies the one iOS build fix that an Expo prebuild app can't be expected to
// know about: disabling explicit Swift modules. On Xcode 16+/26, CocoaPods +
// Swift pods (NitroModules, OnramperReactNative, RN's RCTSwiftUI) otherwise fail
// the app target's "Emit Swift module" phase with "module map file ... not found".
//
// It deliberately does NOT touch the iOS deployment target — that's a product
// decision (which OS versions you support). The package declares its floor
// (iOS 16) in its podspec; set your app's deployment target to 16.0+ yourself.
// New Architecture (required by Nitro) is the default on the targeted RN/Expo
// versions, so the plugin doesn't force it either.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const MARKER = '# @onramper/onramper-react-native: disable explicit Swift modules';

function withOnramperDisableExplicitModules(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER)) {
        const snippet = [
          `    ${MARKER}`,
          '    installer.pods_project.targets.each do |t|',
          "      t.build_configurations.each { |c| c.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO' }",
          '    end',
          '    installer.aggregate_targets.each do |at|',
          '      next if at.user_project.nil?',
          '      at.user_project.native_targets.each do |t|',
          "        t.build_configurations.each { |c| c.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO' }",
          '      end',
          '      at.user_project.save',
          '    end',
        ].join('\n');
        // Insert at the top of Expo's generated `post_install do |installer|` block.
        contents = contents.replace(/(post_install do \|installer\|\n)/, `$1${snippet}\n`);
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
}

module.exports = function withOnramper(config) {
  return withOnramperDisableExplicitModules(config);
};
