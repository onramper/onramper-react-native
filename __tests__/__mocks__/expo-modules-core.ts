const nativeModuleSingleton = {
  configure: jest.fn().mockResolvedValue(undefined),
  initialize: jest.fn().mockResolvedValue(undefined),
  getCheckoutRequirements: jest.fn(),
  cancelPreparedIntent: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
  provideSessionCredentials: jest.fn().mockResolvedValue(undefined),
  failSessionRefresh: jest.fn().mockResolvedValue(undefined),
};

export const requireNativeModule = jest.fn(() => nativeModuleSingleton);
export const __mockNative = nativeModuleSingleton;

export const requireNativeViewManager = jest.fn(() => () => null);

class TestEventEmitter {
  private listeners = new Map<string, Set<(e: unknown) => void>>();
  constructor(_target: unknown) {}
  addListener(name: string, fn: (e: unknown) => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)?.add(fn);
    return { remove: () => this.listeners.get(name)?.delete(fn) };
  }
  emit(name: string, payload: unknown) {
    this.listeners.get(name)?.forEach((fn) => fn(payload));
  }
}

// Singleton emitter so tests can grab it via the exported helper.
export const __mockEmitter = new TestEventEmitter(nativeModuleSingleton);
export const EventEmitter = jest.fn().mockImplementation(() => __mockEmitter);
