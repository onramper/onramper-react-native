import { OnramperClient } from '../src/OnramperClient';
import { __mockEmit, __mockNative } from './__mocks__/expo-modules-core';

describe('OnramperClient', () => {
  beforeEach(() => {
    Object.values(__mockNative).forEach((fn) => {
      if (typeof (fn as jest.Mock).mockClear === 'function') (fn as jest.Mock).mockClear();
    });
    __mockNative.configure.mockResolvedValue(undefined);
    __mockNative.initialize.mockResolvedValue(undefined);
    __mockNative.provideSessionCredentials.mockResolvedValue(undefined);
    __mockNative.failSessionRefresh.mockResolvedValue(undefined);
  });

  it('calls configure on construction', async () => {
    const onSessionExpired = jest.fn().mockReturnValue({ sessionId: 's', sessionToken: 't' });
    new OnramperClient({
      apiKey: 'k',
      clientId: 'c',
      environment: 'development',
      onSessionExpired,
    });
    await new Promise<void>((r) => setImmediate(() => r()));
    expect(__mockNative.configure).toHaveBeenCalledWith(
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
    const client = new OnramperClient({
      apiKey: 'k',
      clientId: 'c',
      environment: 'development',
      onSessionExpired: jest.fn().mockReturnValue({ sessionId: 's', sessionToken: 't' }),
    });
    await client.initialize({ sessionId: 's', sessionToken: 't' });
    expect(__mockNative.initialize).toHaveBeenCalledWith('s', 't');
  });

  it('returns a button element + quote from getCheckoutRequirements', async () => {
    __mockNative.getCheckoutRequirements.mockResolvedValueOnce({
      intentHandle: '01J',
      quote: { rate: 1, payout: 0, ramp: 'demo' },
    });
    const client = new OnramperClient({
      apiKey: 'k',
      clientId: 'c',
      environment: 'development',
      onSessionExpired: jest.fn().mockReturnValue({ sessionId: 's', sessionToken: 't' }),
    });
    const result = await client.getCheckoutRequirements({
      source: 'usd',
      destination: 'eth',
      amount: 100,
      type: 'buy',
      paymentMethod: 'creditcard',
      wallet: { network: 'ethereum', address: '0x' },
    });
    expect(result.button).toBeTruthy();
    expect(result.quote.rate).toBe(1);
  });

  it('wraps native errors as OnramperError', async () => {
    __mockNative.initialize.mockRejectedValueOnce({ code: 'deviceBlocked', message: 'no' });
    const client = new OnramperClient({
      apiKey: 'k',
      clientId: 'c',
      environment: 'development',
      onSessionExpired: jest.fn().mockReturnValue({ sessionId: 's', sessionToken: 't' }),
    });
    await expect(client.initialize({ sessionId: 's', sessionToken: 't' })).rejects.toMatchObject({
      code: 'deviceBlocked',
    });
  });

  it('handles onSessionExpired event via async round-trip', async () => {
    const onSessionExpired = jest.fn().mockResolvedValue({ sessionId: 'fresh-id', sessionToken: 'fresh-tok' });
    new OnramperClient({
      apiKey: 'k',
      clientId: 'c',
      environment: 'development',
      onSessionExpired,
    });
    __mockEmit('onSessionExpired', { token: 'session-1' });
    // Let the async callback chain settle.
    await new Promise<void>((r) => setImmediate(() => r()));
    await new Promise<void>((r) => setImmediate(() => r()));
    expect(onSessionExpired).toHaveBeenCalled();
    expect(__mockNative.provideSessionCredentials).toHaveBeenCalledWith('session-1', {
      sessionId: 'fresh-id',
      sessionToken: 'fresh-tok',
    });
  });

  it('reports failed onSessionExpired via failSessionRefresh', async () => {
    const onSessionExpired = jest.fn().mockRejectedValue(new Error('refresh denied'));
    new OnramperClient({
      apiKey: 'k',
      clientId: 'c',
      environment: 'development',
      onSessionExpired,
    });
    __mockEmit('onSessionExpired', { token: 'session-2' });
    await new Promise<void>((r) => setImmediate(() => r()));
    await new Promise<void>((r) => setImmediate(() => r()));
    expect(__mockNative.failSessionRefresh).toHaveBeenCalledWith('session-2', 'refresh denied');
  });

  it('signOut() awaits configure then forwards to native', async () => {
    const client = new OnramperClient({
      apiKey: 'k',
      clientId: 'c',
      environment: 'development',
      onSessionExpired: jest.fn().mockReturnValue({ sessionId: 's', sessionToken: 't' }),
    });
    await client.signOut();
    expect(__mockNative.configure).toHaveBeenCalled();
    expect(__mockNative.signOut).toHaveBeenCalledTimes(1);
  });

  it('destroy() removes every listener added via addStateListener / addEventListener', () => {
    const client = new OnramperClient({
      apiKey: 'k',
      clientId: 'c',
      environment: 'development',
      onSessionExpired: jest.fn().mockReturnValue({ sessionId: 's', sessionToken: 't' }),
    });
    const stateFn = jest.fn();
    const completedFn = jest.fn();
    client.addStateListener(stateFn);
    client.addEventListener('completed', completedFn);

    client.destroy();

    __mockEmit('onStateChanged', { kind: 'ready' });
    __mockEmit('onCheckoutEvent', { type: 'completed', checkoutId: 'abc' });

    expect(stateFn).not.toHaveBeenCalled();
    expect(completedFn).not.toHaveBeenCalled();
  });
});
