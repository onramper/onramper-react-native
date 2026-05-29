import { NitroModules } from 'react-native-nitro-modules';
import type { OnramperNitro } from './specs/OnramperNitro.nitro';

/**
 * Creates a fresh native Onramper Nitro hybrid object. Each `OnramperClient`
 * owns its own instance, so its listeners and the underlying SDK client are
 * isolated per client and torn down by `destroy()` → `dispose()`.
 */
export function createOnramperNative(): OnramperNitro {
  return NitroModules.createHybridObject<OnramperNitro>('OnramperNitro');
}

export type { OnramperNitro };
