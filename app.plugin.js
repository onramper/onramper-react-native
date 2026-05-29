// Expo config plugin for @onramper/react-native.
//
// Lets the (Nitro-based) package work in Expo prebuild / CNG apps by applying the
// two iOS build requirements that aren't Expo defaults:
//   1. iOS deployment target 16.4 — the vendored OnramperSDK.xcframework requires it.
//   2. SWIFT_ENABLE_EXPLICIT_MODULES = NO — Xcode 16+/26 + CocoaPods + Swift pods
//      (NitroModules, OnramperReactNative, RN's RCTSwiftUI) otherwise fail the app
//      target's "Emit Swift module" phase with "module map file ... not found".
//
// New Architecture is required by Nitro but is the default on the SDK versions
// this package targets (RN 0.85 / Expo SDK 56), so the plugin doesn't force it.

const { withPodfileProperties, withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const IOS_DEPLOYMENT_TARGET = '16.4';
const MARKER = '# @onramper/react-native: disable explicit Swift modules';

function withOnramperDeploymentTarget(config) {
  return withPodfileProperties(config, (cfg) => {
    cfg.modResults['ios.deploymentTarget'] = IOS_DEPLOYMENT_TARGET;
    return cfg;
  });
}

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
  config = withOnramperDeploymentTarget(config);
  config = withOnramperDisableExplicitModules(config);
  return config;
};
