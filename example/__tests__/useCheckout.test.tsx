import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { CheckoutRequest, OnramperClient } from '@onramper/onramper-react-native';
import { useCheckout, type CheckoutHandle, type UseCheckoutOptions } from '../hooks/useCheckout';

const request: CheckoutRequest = {
  source: 'usd',
  destination: 'sol',
  amount: 100,
  type: 'buy',
  paymentMethod: 'applepay',
  wallet: { network: 'solana', address: 'addr' },
};
const style = { backgroundColor: '#B5F798', foregroundColor: '#000000', borderRadius: 14 };
const quote = (payout: number) => ({
  quoteId: `q${payout}`,
  ramp: 'moonpay',
  rate: 150,
  payout,
  paymentMethod: 'applepay',
  networkFee: 0.1,
  transactionFee: 1,
});
const result = (payout: number) => ({ quote: quote(payout), button: <></> });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeClient() {
  return { getCheckoutRequirements: jest.fn() };
}

let latest!: CheckoutHandle;
// Every render's (props, handle), for asserting what a given render exposed.
let renders: { props: UseCheckoutOptions; handle: CheckoutHandle }[] = [];
function Harness(props: UseCheckoutOptions) {
  latest = useCheckout(props);
  renders.push({ props, handle: latest });
  return null;
}

function options(client: ReturnType<typeof fakeClient> | null, overrides: Partial<UseCheckoutOptions> = {}) {
  return {
    client: client as unknown as OnramperClient | null,
    request,
    prefill: { firstName: 'Ada' },
    buttonStyle: style,
    onLog: jest.fn(),
    ...overrides,
  };
}

async function render(props: UseCheckoutOptions) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness {...props} />);
  });
  return renderer;
}

test('does nothing until there is a client', async () => {
  await render(options(null));
  expect(latest.result).toBeNull();
  expect(latest.loading).toBe(false);
});

test('fetches requirements with request, button style and prefill', async () => {
  const client = fakeClient();
  client.getCheckoutRequirements.mockResolvedValue(result(0.5));
  await render(options(client));
  expect(client.getCheckoutRequirements).toHaveBeenCalledWith(request, style, { firstName: 'Ada' });
  expect(latest.result?.quote.payout).toBe(0.5);
  expect(latest.loading).toBe(false);
});

test('logs prefill field names but never values', async () => {
  const client = fakeClient();
  client.getCheckoutRequirements.mockResolvedValue(result(0.5));
  const onLog = jest.fn();
  await render(options(client, { onLog, prefill: { firstName: 'Ada' } }));
  const lines = onLog.mock.calls.map(c => c[1] as string).join('\n');
  expect(lines).toContain('Sends: firstName');
  expect(lines).not.toContain('Ada');
});

test('drops a stale response that resolves after a newer one', async () => {
  const client = fakeClient();
  const first = deferred<ReturnType<typeof result>>();
  client.getCheckoutRequirements.mockReturnValueOnce(first.promise).mockResolvedValueOnce(result(2));
  const renderer = await render(options(client));
  await act(async () => {
    renderer.update(<Harness {...options(client, { request: { ...request, amount: 200 } })} />);
  });
  await act(async () => {
    first.resolve(result(1));
  });
  expect(latest.result?.quote.payout).toBe(2);
});

test('ignores a response that lands after the client was replaced', async () => {
  const client = fakeClient();
  const pending = deferred<ReturnType<typeof result>>();
  client.getCheckoutRequirements.mockReturnValueOnce(pending.promise);
  const renderer = await render(options(client));
  await act(async () => {
    renderer.update(<Harness {...options(null)} />);
  });
  await act(async () => {
    pending.resolve(result(1));
  });
  expect(latest.result).toBeNull();
  expect(latest.loading).toBe(false);
});

test('amountOutOfRange becomes an amount hint, not a status error', async () => {
  const client = fakeClient();
  client.getCheckoutRequirements.mockRejectedValue({ code: 'amountOutOfRange', message: 'Min 20 USD' });
  await render(options(client));
  expect(latest.amountHint).toBe('Min 20 USD');
  expect(latest.error).toBeNull();
});

test('other failures surface as an error', async () => {
  const client = fakeClient();
  client.getCheckoutRequirements.mockRejectedValue({ code: 'quoteUnavailable', message: 'no quote' });
  await render(options(client));
  expect(latest.error).toBe('quoteUnavailable — no quote');
  expect(latest.amountHint).toBeNull();
});

test('a null request clears the result without calling the SDK', async () => {
  const client = fakeClient();
  client.getCheckoutRequirements.mockResolvedValue(result(1));
  const renderer = await render(options(client));
  await act(async () => {
    renderer.update(<Harness {...options(client, { request: null })} />);
  });
  expect(client.getCheckoutRequirements).toHaveBeenCalledTimes(1);
  expect(latest.result).toBeNull();
});

test('refresh re-requests the same input', async () => {
  const client = fakeClient();
  client.getCheckoutRequirements.mockResolvedValue(result(1));
  await render(options(client));
  await act(async () => {
    latest.refresh();
  });
  expect(client.getCheckoutRequirements).toHaveBeenCalledTimes(2);
});

test('never exposes a result in the render where its client is replaced', async () => {
  const client = fakeClient();
  client.getCheckoutRequirements.mockResolvedValue(result(1));
  const renderer = await render(options(client));
  expect(latest.result?.quote.payout).toBe(1);
  renders = [];

  await act(async () => {
    renderer.update(<Harness {...options(null)} />);
  });

  expect(renders[0].props.client).toBeNull();
  expect(renders.filter(r => r.handle.result !== null)).toEqual([]);
});

test('clears a stale amount hint as soon as the next request starts', async () => {
  const client = fakeClient();
  const next = deferred<ReturnType<typeof result>>();
  client.getCheckoutRequirements
    .mockRejectedValueOnce({ code: 'amountOutOfRange', message: 'Min 20 USD' })
    .mockReturnValueOnce(next.promise);
  const renderer = await render(options(client, { request: { ...request, amount: 5 } }));
  expect(latest.amountHint).toBe('Min 20 USD');

  await act(async () => {
    renderer.update(<Harness {...options(client)} />);
  });

  expect(latest.loading).toBe(true);
  expect(latest.amountHint).toBeNull();
});
