import type { HybridObject } from 'react-native-nitro-modules';

export interface OnramperNitro extends HybridObject<{ ios: 'swift' }> {
  // Spike-only: prove the JS<->Swift bridge end to end.
  ping(message: string): Promise<string>;
}
