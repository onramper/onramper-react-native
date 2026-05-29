import type { HybridObject } from 'react-native-nitro-modules';

export interface OnramperNitro extends HybridObject<{ ios: 'swift' }> {
  // Spike #1: prove the JS<->Swift bridge end to end.
  ping(message: string): Promise<string>;
  // Spike #2: prove the vendored OnramperSDK.xcframework links & is callable
  // from a Nitro Swift target (Swift <-> C++ interop).
  sdkProbe(): Promise<string>;
  // Spike #4: prove a stored JS callback fires native->JS repeatedly — the
  // mechanism the real event streams (onStateChanged/onCheckoutEvent) will use.
  startTicker(onTick: (count: number) => void): Promise<void>;
  stopTicker(): Promise<void>;
}
