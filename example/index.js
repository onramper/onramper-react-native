/**
 * @format
 */

import { registerRootComponent } from 'expo';

import App from './App';

// Imports `expo/Expo.fx` under the hood, which installs `globalThis.expo`
// and wires up the TurboModule registry. Plain AppRegistry.registerComponent
// would skip that setup and leave Bridgeless mode with empty TurboModules.
registerRootComponent(App);
