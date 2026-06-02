const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

// The wrapper is linked into node_modules via `file:..` (symlink). Expo's
// default config handles symlinks correctly out of the box. We just need to
// teach Metro that the symlinked source lives one directory up so it watches
// changes to wrapper code during development.
const wrapperRoot = path.resolve(__dirname, '..');

const config = getDefaultConfig(__dirname);

config.watchFolders = [...(config.watchFolders ?? []), wrapperRoot];

// Force Metro to resolve EVERY package out of example/node_modules. Otherwise
// the wrapper repo's own node_modules (reached via the file:.. symlink) gives
// us two copies of expo-modules-core and react-native — separate JS module
// instances with separate view registries. The symptom is "View config
// getter callback ... must be a function (received `undefined`)" when the
// wrapper-side `requireNativeViewManager` registers against one registry but
// the app renders against the other.
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
