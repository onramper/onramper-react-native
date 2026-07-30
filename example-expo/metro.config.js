const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

// The wrapper is linked into node_modules via `file:..` (symlink). Expo's
// default config handles symlinks correctly out of the box. We just need to
// teach Metro that the symlinked source lives one directory up so it watches
// changes to wrapper code during development.
const wrapperRoot = path.resolve(__dirname, '..');
const appNodeModules = path.resolve(__dirname, 'node_modules');

const config = getDefaultConfig(__dirname);

config.watchFolders = [...(config.watchFolders ?? []), wrapperRoot];

// The wrapper repo has its own node_modules, reachable via the file:.. symlink,
// so these packages exist twice in the tree. Two copies means two JS module
// instances with separate view registries; the symptom is "View config getter
// callback ... must be a function (received `undefined`)" when the wrapper-side
// `requireNativeViewManager` registers against one registry but the app renders
// against the other. Pin exactly these to the app's copy.
//
// Don't broaden this to every package (i.e. a blanket disableHierarchicalLookup
// + single nodeModulesPaths). npm does not hoist all of expo's dependencies —
// expo-asset, expo-constants, expo-file-system, expo-font and expo-keep-awake
// sit in node_modules/expo/node_modules — and a single search path hides them,
// which fails the bundle with "Unable to resolve module expo-asset".
const SINGLETONS = [
  'react',
  'react-dom',
  'react-native',
  'react-native-nitro-modules',
  'expo',
  'expo-modules-core',
];

config.resolver.nodeModulesPaths = [appNodeModules];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSingleton = SINGLETONS.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`),
  );

  return context.resolveRequest(
    isSingleton
      ? { ...context, nodeModulesPaths: [appNodeModules], disableHierarchicalLookup: true }
      : context,
    moduleName,
    platform,
  );
};

module.exports = config;
