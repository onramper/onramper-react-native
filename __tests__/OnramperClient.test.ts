import { OnramperClient } from '../src/OnramperClient';
import { __mockNative } from './__mocks__/expo-modules-core';

describe('OnramperClient', () => {
  beforeEach(() => {
    Object.values(__mockNative).forEach((fn: any) => fn.mockClear?.());
    __mockNative.configure.mockResolvedValue(undefined);
    __mockNative.initialize.mockResolvedValue(undefined);
  });

  it('calls configure on construction', async () => {
    const onSessionExpired = jest.fn().mockReturnValue({ sessionId: 's', sessionToken: 't' });
    new OnramperClient({
      apiKey: 'k', clientId: 'c', environment: 'development', onSessionExpired,
    });
    await new Promise<void>((r) => setImmediate(() => r()));
    expect(__mockNative.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'k', clientId: 'c', environment: 'development', theme: 'system', logLevel: 'off',
      }),
      expect.any(Function),
    );
  });

  it('forwards initialize to native', async () => {
    const client = new OnramperClient({
      apiKey: 'k', clientId: 'c', environment: 'development',
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
      apiKey: 'k', clientId: 'c', environment: 'development',
      onSessionExpired: jest.fn().mockReturnValue({ sessionId: 's', sessionToken: 't' }),
    });
    const result = await client.getCheckoutRequirements({
      onramp: 'demo',
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
      apiKey: 'k', clientId: 'c', environment: 'development',
      onSessionExpired: jest.fn().mockReturnValue({ sessionId: 's', sessionToken: 't' }),
    });
    await expect(client.initialize({ sessionId: 's', sessionToken: 't' })).rejects.toMatchObject({
      code: 'deviceBlocked',
    });
  });
});
