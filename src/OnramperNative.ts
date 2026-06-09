import { Platform } from 'react-native';
import { NitroModules } from 'react-native-nitro-modules';
import type { OnramperNitro } from './specs/OnramperNitro.nitro';

/**
 * Creates a fresh native Onramper Nitro hybrid object. Each `OnramperClient`
 * owns its own instance, so its listeners and the underlying SDK client are
 * isolated per client and torn down by `destroy()` → `dispose()`.
 */
export function createOnramperNative(): OnramperNitro {
  // iOS-only in this release. Fail with a clear message rather than the opaque
  // "hybrid object not found" Nitro would throw on platforms without a native impl.
  if (Platform.OS !== 'ios') {
    throw new Error(`Onramper React Native is iOS-only in this release; it is not supported on ${Platform.OS}.`);
  }
  return NitroModules.createHybridObject<OnramperNitro>('OnramperNitro');
}

export type { OnramperNitro };
