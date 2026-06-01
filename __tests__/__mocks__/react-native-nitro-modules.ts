// Mocks the native Nitro hybrid object. `createHybridObject` returns a fresh
// instance per call (matching production, where each OnramperClient owns one),
// capturing the registered callbacks so tests can drive state / event / session
// flows. Grab the most-recently-created instance via `__lastNative()`.

export interface MockNative {
  configure: jest.Mock;
  initialize: jest.Mock;
  reset: jest.Mock;
  signOut: jest.Mock;
  setStateListener: jest.Mock;
  setEventListener: jest.Mock;
  setSessionExpirationHandler: jest.Mock;
  getCheckoutRequirements: jest.Mock;
  cancelPreparedIntent: jest.Mock;
  dispose: jest.Mock;
  // Captured callbacks (set by the corresponding setters):
  __stateListener?: (json: string) => void;
  __eventListener?: (json: string) => void;
  __sessionHandler?: () => Promise<{ sessionId: string; sessionToken: string }>;
}

function makeNative(): MockNative {
  const native = {
    configure: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(undefined),
    setStateListener: jest.fn((fn: (json: string) => void) => {
      native.__stateListener = fn;
    }),
    setEventListener: jest.fn((fn: (json: string) => void) => {
      native.__eventListener = fn;
    }),
    setSessionExpirationHandler: jest.fn((fn: () => Promise<{ sessionId: string; sessionToken: string }>) => {
      native.__sessionHandler = fn;
    }),
    getCheckoutRequirements: jest.fn().mockResolvedValue({ intentHandle: 'handle', quoteJson: '{}' }),
    cancelPreparedIntent: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
  } as MockNative;
  return native;
}

let last: MockNative | undefined;

export const NitroModules = {
  createHybridObject: jest.fn(() => {
    last = makeNative();
    return last;
  }),
};

/** The most-recently-created mock hybrid object (one per OnramperClient). */
export function __lastNative(): MockNative {
  if (!last) throw new Error('no hybrid object created yet');
  return last;
}

// View host factory. Tests don't render the native button, so a dummy component
// that ignores its props is sufficient.
export const getHostComponent = jest.fn(() => () => null);
