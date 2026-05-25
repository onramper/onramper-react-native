// Simple typed listener registry. In production the native module IS an
// EventEmitter (Expo SDK 56+); tests substitute this lightweight equivalent.
const listeners = new Map<string, Set<(payload: unknown) => void>>();

function addListener(name: string, fn: (payload: unknown) => void) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name)?.add(fn);
  return { remove: () => listeners.get(name)?.delete(fn) };
}

const nativeModuleSingleton = {
  configure: jest.fn().mockResolvedValue(undefined),
  initialize: jest.fn().mockResolvedValue(undefined),
  getCheckoutRequirements: jest.fn(),
  cancelPreparedIntent: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
  signOut: jest.fn().mockResolvedValue(undefined),
  provideSessionCredentials: jest.fn().mockResolvedValue(undefined),
  failSessionRefresh: jest.fn().mockResolvedValue(undefined),
  addListener,
};

export const requireNativeModule = jest.fn(() => nativeModuleSingleton);
export const __mockNative = nativeModuleSingleton;

export const requireNativeViewManager = jest.fn(() => () => null);

// Helper for tests to push synthetic events through the mock listener registry.
export function __mockEmit(name: string, payload: unknown): void {
  listeners.get(name)?.forEach((fn) => fn(payload));
}
