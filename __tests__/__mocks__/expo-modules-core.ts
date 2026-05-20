const nativeModuleSingleton = {
  configure: jest.fn().mockResolvedValue(undefined),
  initialize: jest.fn().mockResolvedValue(undefined),
  getCheckoutRequirements: jest.fn(),
  cancelPreparedIntent: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
};

export const requireNativeModule = jest.fn(() => nativeModuleSingleton);
export const __mockNative = nativeModuleSingleton;

export const requireNativeViewManager = jest.fn(() => () => null);

export class EventEmitter {
  private listeners = new Map<string, Set<(e: unknown) => void>>();
  constructor(_target: unknown) {}
  addListener(name: string, fn: (e: unknown) => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(fn);
    return { remove: () => this.listeners.get(name)?.delete(fn) };
  }
  emit(name: string, payload: unknown) {
    this.listeners.get(name)?.forEach((fn) => fn(payload));
  }
}
