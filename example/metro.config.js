const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const wrapperRoot = path.resolve(__dirname, '..');
const WRAPPER_PACKAGE = '@onramper/onramper-react-native';

// The wrapper's package.json has an `exports` map, which Metro honours. Its
// `import`/`require` conditions point at the built `lib/`, so without this the
// example silently runs whatever `lib/` was last built — not the code being
// edited. Ask for the `source` condition (→ src/index.ts) for the wrapper only.
const resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(
    moduleName === WRAPPER_PACKAGE || moduleName.startsWith(`${WRAPPER_PACKAGE}/`)
      ? { ...context, unstable_conditionNames: ['source', ...context.unstable_conditionNames] }
      : context,
    moduleName,
    platform,
  );

const config = {
  watchFolders: [wrapperRoot],
  resolver: {
    disableHierarchicalLookup: true,
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    resolveRequest,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
