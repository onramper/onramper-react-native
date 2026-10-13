import { OnramperClient } from '../src/OnramperClient';
import { OnramperError } from '../src/errors';
import type { CheckoutRequest } from '../src/types';
import { __lastNative, makeNative, NitroModules } from './__mocks__/react-native-nitro-modules';

const config = { apiKey: 'test', clientId: 'test', environment: 'development' as const, onSessionExpired: jest.fn() };
const request: CheckoutRequest = { source: 'usd', destination: 'eth', amount: 100, type: 'buy', paymentMethod: 'applepay', wallet: { network: 'ethereum', address: 'test' } };
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const operations = [
  ['initialize', (client: OnramperClient) => client.initialize({ sessionId: 'test', sessionToken: 'test' })],
  ['reset', (client: OnramperClient) => client.reset()],
  ['signOut', (client: OnramperClient) => client.signOut()],
  ['getCheckoutRequirements', (client: OnramperClient) => client.getCheckoutRequirements(request)],
  ['cancelPreparedIntent', (client: OnramperClient) => client.cancelPreparedIntent('handle')],
] as const;

describe('client lifetime', () => {
  it.each(operations)('%s rejects after destroy without calling native', async (method, call) => {
    const client = new OnramperClient(config);
    const native = __lastNative();
    client.destroy();
    await expect(call(client)).rejects.toMatchObject({ name: 'OnramperError', code: 'clientDestroyed' });
    expect(native[method]).not.toHaveBeenCalled();
  });

  it.each(operations.filter(([name]) => name !== 'cancelPreparedIntent'))(
    '%s does not call native when destroyed while configuration is pending', async (method, call) => {
      const configuration = deferred<void>();
      const native = makeNative();
      native.configure.mockReturnValue(configuration.promise);
      NitroModules.createHybridObject.mockReturnValueOnce(native);
      const client = new OnramperClient(config);
      const result = expect(call(client)).rejects.toMatchObject({ code: 'clientDestroyed' });
      client.destroy();
      configuration.resolve();
      await result;
      expect(native[method]).not.toHaveBeenCalled();
    },
  );

  it.each(operations)('%s rejects a late native success after destroy', async (method, call) => {
    const client = new OnramperClient(config);
    const native = __lastNative();
    native.__transactionIdListener?.('existing-transaction');
    const pending = deferred<unknown>();
    native[method].mockReturnValueOnce(pending.promise);
    const result = expect(call(client)).rejects.toMatchObject({ code: 'clientDestroyed' });
    await tick();
    expect(native[method]).toHaveBeenCalledTimes(1);
    client.destroy();
    pending.resolve({ intentHandle: 'obsolete', quoteJson: '{}' });
    await result;
    expect(client.currentTransactionId).toBe('existing-transaction');
  });

  it('does not resurrect state or deliver events from captured callbacks', async () => {
    const onSessionExpired = jest.fn();
    const logHandler = jest.fn();
    const client = new OnramperClient({ ...config, onSessionExpired, logHandler });
    const native = __lastNative();
    const state = jest.fn();
    const event = jest.fn();
    const transaction = jest.fn();
    client.addStateListener(state);
    client.addEventListener('checkoutFinalized', event);
    client.addTransactionIdListener(transaction);
    client.destroy();
    native.__stateListener?.('{not valid JSON');
    native.__eventListener?.('{not valid JSON');
    native.__transactionIdListener?.('late-transaction');
    native.__logListener?.('{not valid JSON');
    await expect(native.__sessionHandler?.()).rejects.toMatchObject({ code: 'clientDestroyed' });
    expect(client.state).toEqual({ kind: 'idle' });
    expect(client.currentTransactionId).toBeNull();
    expect(client.lastError).toBeNull();
    for (const listener of [state, event, transaction, logHandler, onSessionExpired]) expect(listener).not.toHaveBeenCalled();
  });

  it('disposes only once, rejects subscriptions, and allows a new client', async () => {
    const client = new OnramperClient(config);
    const oldNative = __lastNative();
    const unsubscribe = client.addStateListener(jest.fn());
    client.destroy();
    client.destroy();
    unsubscribe();
    expect(oldNative.dispose).toHaveBeenCalledTimes(1);
    for (const subscribe of [() => client.addStateListener(jest.fn()), () => client.addEventListener('completed', jest.fn()), () => client.addTransactionIdListener(jest.fn())]) {
      expect(subscribe).toThrow(OnramperError);
      expect(subscribe).toThrow(expect.objectContaining({ code: 'clientDestroyed' }));
    }
    const fresh = new OnramperClient(config);
    const freshNative = __lastNative();
    await fresh.initialize({ sessionId: 'new', sessionToken: 'new' });
    expect(freshNative).not.toBe(oldNative);
    expect(freshNative.initialize).toHaveBeenCalledTimes(1);
    fresh.destroy();
  });

  it('normalizes a native failure that arrives after destruction', async () => {
    const client = new OnramperClient(config);
    const pending = deferred<unknown>();
    __lastNative().getCheckoutRequirements.mockReturnValueOnce(pending.promise);
    const result = expect(client.getCheckoutRequirements(request)).rejects.toMatchObject({ code: 'clientDestroyed' });
    await tick();
    client.destroy();
    pending.reject(new Error('late transport error'));
    await result;
    expect(client.lastError).toBeNull();
  });

  it('stops remaining transaction listeners when one destroys the client', () => {
    const client = new OnramperClient(config);
    client.addTransactionIdListener(() => client.destroy());
    const later = jest.fn();
    client.addTransactionIdListener(later);
    __lastNative().__transactionIdListener?.('transaction');
    expect(later).not.toHaveBeenCalled();
  });

  it('ignores a configuration failure after destroy', async () => {
    const pending = deferred<void>();
    const native = makeNative();
    native.configure.mockReturnValueOnce(pending.promise);
    NitroModules.createHybridObject.mockReturnValueOnce(native);
    const client = new OnramperClient(config);
    const result = expect(client.reset()).rejects.toMatchObject({ code: 'clientDestroyed' });
    client.destroy();
    pending.reject(new Error('late configuration failure'));
    await result;
    expect(client.lastError).toBeNull();
    expect(native.reset).not.toHaveBeenCalled();
  });

  it('does not return credentials when destroyed during session refresh', async () => {
    const pending = deferred<{ sessionId: string; sessionToken: string }>();
    const client = new OnramperClient({ ...config, onSessionExpired: () => pending.promise });
    const result = expect(__lastNative().__sessionHandler?.()).rejects.toMatchObject({ code: 'clientDestroyed' });
    client.destroy();
    pending.resolve({ sessionId: 'late', sessionToken: 'late' });
    await result;
  });

  it('preserves native invalidation as a typed error', async () => {
    const client = new OnramperClient(config);
    __lastNative().getCheckoutRequirements.mockRejectedValueOnce(new Error('ONRAMPER_ERROR:' + JSON.stringify({
      code: 'intentInvalidated', message: 'Superseded', userMessage: 'Use the latest quote.', supportCode: 'intentInvalidated',
    })));
    await expect(client.getCheckoutRequirements(request)).rejects.toMatchObject({
      code: 'intentInvalidated', userMessage: 'Use the latest quote.', supportCode: 'intentInvalidated',
    });
  });
});
