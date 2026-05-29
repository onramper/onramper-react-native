import { OnramperClient } from '../src/OnramperClient';
import { __lastNative } from './__mocks__/react-native-nitro-modules';

const baseConfig = {
  apiKey: 'k',
  clientId: 'c',
  environment: 'development' as const,
};

const tick = () => new Promise<void>((r) => setImmediate(r));

describe('OnramperClient', () => {
  it('calls configure on construction with defaulted theme/logLevel', async () => {
    new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    await tick();
    expect(__lastNative().configure).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'k',
        clientId: 'c',
        environment: 'development',
        theme: 'system',
        logLevel: 'off',
      }),
    );
  });

  it('forwards initialize to native', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    await client.initialize({ sessionId: 's', sessionToken: 't' });
    expect(native.initialize).toHaveBeenCalledWith('s', 't');
  });

  it('wraps native errors as OnramperError', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    __lastNative().initialize.mockRejectedValueOnce({ code: 'deviceBlocked', message: 'no' });
    await expect(client.initialize({ sessionId: 's', sessionToken: 't' })).rejects.toMatchObject({
      code: 'deviceBlocked',
    });
  });

  it('registers a session handler that returns fresh credentials', async () => {
    const onSessionExpired = jest.fn().mockResolvedValue({ sessionId: 'fresh-id', sessionToken: 'fresh-tok' });
    new OnramperClient({ ...baseConfig, onSessionExpired });
    const handler = __lastNative().__sessionHandler;
    expect(handler).toBeDefined();
    await expect(handler?.()).resolves.toEqual({ sessionId: 'fresh-id', sessionToken: 'fresh-tok' });
    expect(onSessionExpired).toHaveBeenCalled();
  });

  it('propagates session-handler rejection', async () => {
    const onSessionExpired = jest.fn().mockRejectedValue(new Error('refresh denied'));
    new OnramperClient({ ...baseConfig, onSessionExpired });
    await expect(__lastNative().__sessionHandler?.()).rejects.toThrow('refresh denied');
  });

  it('signOut() awaits configure then forwards to native', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    await client.signOut();
    expect(native.configure).toHaveBeenCalled();
    expect(native.signOut).toHaveBeenCalledTimes(1);
  });

  it('fans out parsed state to addStateListener', () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    const stateFn = jest.fn();
    client.addStateListener(stateFn);
    native.__stateListener?.(JSON.stringify({ kind: 'ready' }));
    expect(stateFn).toHaveBeenCalledWith({ kind: 'ready' });
  });

  it('addEventListener fires only for the matching event type', () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    const completedFn = jest.fn();
    client.addEventListener('completed', completedFn);
    native.__eventListener?.(JSON.stringify({ type: 'cancelled' }));
    expect(completedFn).not.toHaveBeenCalled();
    native.__eventListener?.(JSON.stringify({ type: 'completed', checkoutId: 'abc' }));
    expect(completedFn).toHaveBeenCalledWith({ type: 'completed', checkoutId: 'abc' });
  });

  it('destroy() clears listeners and disposes the native instance', () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    const stateFn = jest.fn();
    client.addStateListener(stateFn);
    client.destroy();
    expect(native.dispose).toHaveBeenCalledTimes(1);
    native.__stateListener?.(JSON.stringify({ kind: 'ready' }));
    expect(stateFn).not.toHaveBeenCalled();
  });
});
