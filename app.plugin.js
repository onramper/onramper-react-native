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
//
// Option `providers` (e.g. `["stripe"]`): the opt-in native checkout providers.
// Written to the Podfile as `$OnramperProviders`, which the podspec reads to
// link the matching onramper-ios products (Stripe: `OnramperStripe`, which adds
// Stripe's iOS SDK). Omitted or empty: no provider SDK is built.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const MARKER = '# @onramper/onramper-react-native: disable explicit Swift modules';
const PROVIDERS_MARKER = '# @onramper/onramper-react-native: providers';
const SUPPORTED_PROVIDERS = ['stripe'];

function normalizeProviders(providers) {
  if (providers === undefined || providers === null) return [];
  if (!Array.isArray(providers)) {
    throw new Error('@onramper/onramper-react-native: the `providers` option must be an array, e.g. ["stripe"]');
  }
  const names = [...new Set(providers.map((p) => String(p).trim().toLowerCase()).filter(Boolean))];
  const unknown = names.filter((p) => !SUPPORTED_PROVIDERS.includes(p));
  if (unknown.length > 0) {
    throw new Error(
      `@onramper/onramper-react-native: unknown provider(s) ${unknown.join(', ')}. Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
    );
  }
  return names;
}

// Sets (or removes) the `$OnramperProviders = [...]` line at the top of the
// Podfile. It must come before `use_expo_modules!`, which evaluates the podspec.
// Re-running with other providers replaces the line.
function setPodfileProviders(contents, providers) {
  const lines = contents.split('\n').filter((line) => !line.includes(PROVIDERS_MARKER));
  if (providers.length > 0) {
    const list = providers.map((p) => `'${p}'`).join(', ');
    lines.unshift(`$OnramperProviders = [${list}] ${PROVIDERS_MARKER}`);
  }
  return lines.join('\n');
}

function withOnramperProviders(config, providers) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfile, 'utf8');
      const updated = setPodfileProviders(contents, providers);
      if (updated !== contents) fs.writeFileSync(podfile, updated);
      return cfg;
    },
  ]);
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

module.exports = function withOnramper(config, options = {}) {
  const providers = normalizeProviders(options?.providers);
  return withOnramperProviders(withOnramperDisableExplicitModules(config), providers);
};
module.exports.setPodfileProviders = setPodfileProviders;
module.exports.normalizeProviders = normalizeProviders;
