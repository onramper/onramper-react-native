import { isValidElement } from 'react';
import { OnramperClient } from '../src/OnramperClient';
import type { CheckoutEvent } from '../src/events';
import type { CheckoutRequest } from '../src/types';
import { __lastNative } from './__mocks__/react-native-nitro-modules';

const baseConfig = {
  apiKey: 'k',
  clientId: 'c',
  environment: 'development' as const,
};

const checkoutRequest: CheckoutRequest = {
  source: 'usd',
  destination: 'eth',
  amount: 100,
  type: 'buy',
  paymentMethod: 'creditcard',
  wallet: { network: 'ethereum', address: '0xabc' },
};

const checkoutFinalizedEvent: Extract<CheckoutEvent, { type: 'checkoutFinalized' }> = {
  type: 'checkoutFinalized',
  response: {
    headlessCheckoutId: 'checkout_123',
    onramperTransactionId: 'txn_123',
    headlessCheckoutData: {
      checkoutPaymentType: 'applepay',
      url: 'https://pay.example/checkout_123',
      renderType: 'webview',
    },
  },
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

  it('reset() clears the transaction ID after native reset succeeds', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    const listener = jest.fn();
    client.addTransactionIdListener(listener);
    native.__eventListener?.(JSON.stringify(checkoutFinalizedEvent));
    listener.mockClear();

    await client.reset();

    expect(native.reset).toHaveBeenCalledTimes(1);
    expect(client.currentTransactionId).toBeNull();
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('reset() preserves the transaction ID when native reset fails', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    native.__eventListener?.(JSON.stringify(checkoutFinalizedEvent));
    native.reset.mockRejectedValueOnce(new Error('reset failed'));

    await expect(client.reset()).rejects.toBeInstanceOf(Error);

    expect(client.currentTransactionId).toBe('txn_123');
  });

  it('signOut() clears the transaction ID after native sign-out succeeds', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    const listener = jest.fn();
    client.addTransactionIdListener(listener);
    native.__transactionIdListener?.('txn_123');
    listener.mockClear();

    await client.signOut();

    expect(native.signOut).toHaveBeenCalledTimes(1);
    expect(client.currentTransactionId).toBeNull();
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('signOut() preserves the transaction ID when native sign-out fails', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    native.__transactionIdListener?.('txn_123');
    native.signOut.mockRejectedValueOnce(new Error('sign-out failed'));

    await expect(client.signOut()).rejects.toBeInstanceOf(Error);

    expect(client.currentTransactionId).toBe('txn_123');
  });

  it('getCheckoutRequirements serializes request/style and parses the quote', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    // Success-only quote: core fields are always present (failures arrive as OnramperError).
    const quote = {
      quoteId: 'q1',
      ramp: 'moonpay',
      rate: 1800,
      payout: 0.03,
      paymentMethod: 'creditcard',
      networkFee: 1.5,
      transactionFee: 3.99,
    };
    native.getCheckoutRequirements.mockResolvedValueOnce({
      intentHandle: 'intent-1',
      quoteJson: JSON.stringify(quote),
    });

    const style = { borderRadius: 12 };
    const result = await client.getCheckoutRequirements(checkoutRequest, style);

    // JSON contract: request, prefill and style are serialized as JSON strings,
    // in the native argument order (request, prefill, style).
    expect(native.getCheckoutRequirements).toHaveBeenCalledWith(
      JSON.stringify(checkoutRequest),
      '{}',
      JSON.stringify(style),
    );
    // Quote is parsed back from quoteJson.
    expect(result.quote).toEqual(quote);
    // A native checkout button element is returned for rendering.
    expect(isValidElement(result.button)).toBe(true);
  });

  it('getCheckoutRequirements defaults buttonStyle to {} when omitted', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    native.getCheckoutRequirements.mockResolvedValueOnce({ intentHandle: 'h', quoteJson: '{}' });
    await client.getCheckoutRequirements(checkoutRequest);
    expect(native.getCheckoutRequirements).toHaveBeenCalledWith(JSON.stringify(checkoutRequest), '{}', '{}');
  });

  it('getCheckoutRequirements serializes prefill as the second native argument', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    native.getCheckoutRequirements.mockResolvedValueOnce({ intentHandle: 'h', quoteJson: '{}' });

    const prefill = {
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneNumber: '+3712345678',
    };
    await client.getCheckoutRequirements(checkoutRequest, {}, prefill);

    expect(native.getCheckoutRequirements).toHaveBeenCalledWith(
      JSON.stringify(checkoutRequest),
      JSON.stringify(prefill),
      '{}',
    );
  });

  it('getCheckoutRequirements carries only the prefill fields that were supplied', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    native.getCheckoutRequirements.mockResolvedValueOnce({ intentHandle: 'h', quoteJson: '{}' });

    // A names-only prefill (no email, no phone) is valid — undefined fields drop
    // out of JSON.stringify rather than crossing the bridge as nulls.
    await client.getCheckoutRequirements(checkoutRequest, {}, { firstName: 'Ada', lastName: 'Lovelace' });

    expect(native.getCheckoutRequirements).toHaveBeenCalledWith(
      JSON.stringify(checkoutRequest),
      '{"firstName":"Ada","lastName":"Lovelace"}',
      '{}',
    );
  });

  it('getCheckoutRequirements wraps native errors as OnramperError', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    __lastNative().getCheckoutRequirements.mockRejectedValueOnce({ code: 'quoteUnavailable', message: 'no quote' });
    await expect(client.getCheckoutRequirements(checkoutRequest)).rejects.toMatchObject({ code: 'quoteUnavailable' });
  });

  it('parses requireLogin requirements in the flat bridge shape (incl. reverification)', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();

    // The native bridge flattens each requirement to `{ type, ...fields }`.
    const requirements = [
      { type: 'tos', providerId: 'coinbasepay', items: [{ type: 'tos', required: true, satisfied: false }] },
      { type: 'amount_limit', providerId: 'moonpay', minAmountLimit: 20, amountLimitSatisfied: false },
      { type: 'user_info', providerId: 'moonpay', fields: [{ type: 'phone_number', required: true, satisfied: false }] },
      { type: 'reverification', providerId: 'moonpay', field: 'phone', requiredRecencyDays: 30, lastVerifiedAt: '2026-01-01T00:00:00Z' },
    ];

    let observed: typeof client.state | undefined;
    client.addStateListener((s) => {
      observed = s;
    });
    native.__stateListener?.(JSON.stringify({ kind: 'requireLogin', requirements }));

    expect(client.state).toEqual({ kind: 'requireLogin', requirements });
    expect(observed).toEqual({ kind: 'requireLogin', requirements });
    // The reverification requirement narrows on `type` and carries phone fields.
    if (observed?.kind === 'requireLogin') {
      const reverify = observed.requirements.find((r) => r.type === 'reverification');
      expect(reverify).toMatchObject({ field: 'phone', requiredRecencyDays: 30 });
    }
  });

  it('cancelPreparedIntent forwards the handle to native', async () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    await client.cancelPreparedIntent('intent-1');
    expect(native.cancelPreparedIntent).toHaveBeenCalledWith('intent-1');
  });

  it('fans out parsed state to addStateListener', () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    const stateFn = jest.fn();
    client.addStateListener(stateFn);
    native.__stateListener?.(JSON.stringify({ kind: 'ready' }));
    expect(stateFn).toHaveBeenCalledWith({ kind: 'ready' });
  });

  it('mirrors native transaction ID updates, including reset to null', () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    const listener = jest.fn();
    const unsubscribe = client.addTransactionIdListener(listener);

    expect(client.currentTransactionId).toBeNull();
    native.__transactionIdListener?.('txn_123');
    expect(client.currentTransactionId).toBe('txn_123');
    expect(listener).toHaveBeenLastCalledWith('txn_123');

    native.__transactionIdListener?.(undefined);
    expect(client.currentTransactionId).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);

    unsubscribe();
    native.__transactionIdListener?.('txn_456');
    expect(listener).toHaveBeenCalledTimes(2);
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

  it('updates transaction ID subscribers before delivering checkoutFinalized', () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    const order: string[] = [];
    const transactionIdListener = jest.fn(() => order.push('transactionId'));
    const listener = jest.fn(() => {
      order.push('checkoutFinalized');
      expect(client.currentTransactionId).toBe('txn_123');
    });
    client.addTransactionIdListener(transactionIdListener);
    client.addEventListener('checkoutFinalized', listener);

    native.__eventListener?.(JSON.stringify(checkoutFinalizedEvent));
    expect(client.currentTransactionId).toBe('txn_123');
    expect(transactionIdListener).toHaveBeenCalledWith('txn_123');
    expect(listener).toHaveBeenCalledWith(checkoutFinalizedEvent);
    expect(order).toEqual(['transactionId', 'checkoutFinalized']);
  });

  it.each(['publisher-first', 'event-first'] as const)(
    'does not republish the same transaction ID when sources arrive %s',
    (sourceOrder) => {
      const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
      const native = __lastNative();
      const listener = jest.fn();
      client.addTransactionIdListener(listener);

      if (sourceOrder === 'publisher-first') {
        native.__transactionIdListener?.('txn_123');
        native.__eventListener?.(JSON.stringify(checkoutFinalizedEvent));
      } else {
        native.__eventListener?.(JSON.stringify(checkoutFinalizedEvent));
        native.__transactionIdListener?.('txn_123');
      }

      expect(listener).toHaveBeenCalledTimes(1);
      expect(client.currentTransactionId).toBe('txn_123');
    },
  );

  it('isolates transaction ID subscriber errors from checkoutFinalized fan-out', () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    const subscriberError = new Error('subscriber failed');
    const survivingTransactionListener = jest.fn();
    const checkoutListener = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      client.addTransactionIdListener(() => {
        throw subscriberError;
      });
      client.addTransactionIdListener(survivingTransactionListener);
      client.addEventListener('checkoutFinalized', checkoutListener);

      expect(() => native.__eventListener?.(JSON.stringify(checkoutFinalizedEvent))).not.toThrow();
      expect(survivingTransactionListener).toHaveBeenCalledWith('txn_123');
      expect(checkoutListener).toHaveBeenCalledWith(checkoutFinalizedEvent);
      expect(consoleError).toHaveBeenCalledWith('Onramper transaction ID listener threw:', subscriberError);
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each(['reset', 'signOut'] as const)(
    '%s remains successful when a transaction ID subscriber throws',
    async (method) => {
      const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
      const native = __lastNative();
      const subscriberError = new Error('subscriber failed');
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      try {
        native.__eventListener?.(JSON.stringify(checkoutFinalizedEvent));
        client.addTransactionIdListener(() => {
          throw subscriberError;
        });

        await expect(client[method]()).resolves.toBeUndefined();
        expect(client.currentTransactionId).toBeNull();
        expect(consoleError).toHaveBeenCalledWith('Onramper transaction ID listener threw:', subscriberError);
      } finally {
        consoleError.mockRestore();
      }
    },
  );

  it('destroy() clears listeners and disposes the native instance', () => {
    const client = new OnramperClient({ ...baseConfig, onSessionExpired: jest.fn() });
    const native = __lastNative();
    const stateFn = jest.fn();
    const transactionIdFn = jest.fn();
    client.addStateListener(stateFn);
    client.addTransactionIdListener(transactionIdFn);

    client.destroy();

    expect(native.dispose).toHaveBeenCalledTimes(1);
    native.__stateListener?.(JSON.stringify({ kind: 'ready' }));
    native.__transactionIdListener?.('txn_after_destroy');
    expect(stateFn).not.toHaveBeenCalled();
    expect(transactionIdFn).not.toHaveBeenCalled();
  });
});
