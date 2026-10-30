import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { OnramperClient } from '@onramper/onramper-react-native';
import { createDemoSession } from '../createDemoSession';
import { useOnramper, type OnramperHandle, type UseOnramperOptions } from '../hooks/useOnramper';

jest.mock(
  '../env.local',
  () => ({
    ENV: {
      development: { apiKey: 'pk_test_x', clientId: 'cid', demoToken: 'tok-dev' },
      production: { apiKey: 'pk_prod_x', clientId: 'cid', demoToken: 'tok-prod' },
    },
  }),
  { virtual: true },
);
jest.mock('@onramper/onramper-react-native', () => ({ OnramperClient: jest.fn() }));
jest.mock('../createDemoSession', () => ({ createDemoSession: jest.fn() }));

interface FakeClient {
  config: { environment: string; theme: string; apiKey: string };
  enableStripeCheckout: jest.Mock;
  initialize: jest.Mock;
  destroy: jest.Mock;
  addStateListener: jest.Mock;
  addTransactionIdListener: jest.Mock;
  addEventListener: jest.Mock;
}

const ClientMock = OnramperClient as unknown as jest.Mock;
const mintMock = createDemoSession as jest.Mock;
let clients: FakeClient[] = [];
let latest!: OnramperHandle;

// Every render's (props, handle) pair, for asserting what a given render exposed.
let renders: { props: UseOnramperOptions; handle: OnramperHandle }[] = [];

function Harness(props: UseOnramperOptions) {
  latest = useOnramper(props);
  renders.push({ props, handle: latest });
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const DEV = { environment: 'development', theme: 'dark', generation: 0, trustedLoginEmail: '' } as const;
const session = (id: string) => ({ sessionId: id, sessionToken: `${id}-token` });

beforeEach(() => {
  clients = [];
  ClientMock.mockReset();
  ClientMock.mockImplementation((config: FakeClient['config']) => {
    const client: FakeClient = {
      config,
      enableStripeCheckout: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
      addStateListener: jest.fn(() => () => {}),
      addTransactionIdListener: jest.fn(() => () => {}),
      addEventListener: jest.fn(() => () => {}),
    };
    clients.push(client);
    return client;
  });
  mintMock.mockReset();
  mintMock.mockResolvedValue(session('s1'));
});

// Every renderer is unmounted after its test: a still-mounted hook can have a
// mint or initialize in flight, and its late callbacks would otherwise land on
// the next test's shared mocks (seen as "mint called twice" under CPU load).
const mounted = new Set<ReactTestRenderer.ReactTestRenderer>();

afterEach(async () => {
  await act(async () => {
    for (const renderer of mounted) {
      renderer.unmount();
    }
  });
  mounted.clear();
});

async function render(props: UseOnramperOptions) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness {...props} />);
  });
  mounted.add(renderer);
  return renderer;
}

test('initializes automatically on mount for the selected environment', async () => {
  await render(DEV);
  expect(mintMock).toHaveBeenCalledWith('https://demo-stg.onramper.dev/demo/create-session', 'tok-dev', '');
  expect(clients).toHaveLength(1);
  expect(clients[0].config).toMatchObject({ environment: 'development', theme: 'dark', apiKey: 'pk_test_x' });
  expect(clients[0].initialize).toHaveBeenCalledWith(session('s1'));
  expect(latest.status).toBe('ready');
  expect(latest.client).toBe(clients[0]);
});

test('switching environment destroys the old client and initializes production', async () => {
  const renderer = await render(DEV);
  await act(async () => {
    renderer.update(<Harness {...DEV} environment="production" />);
  });
  expect(clients[0].destroy).toHaveBeenCalled();
  expect(mintMock).toHaveBeenLastCalledWith('https://demo-prod.onramper.com/demo/create-session', 'tok-prod', '');
  expect(clients[1].config.environment).toBe('production');
  expect(latest.client).toBe(clients[1]);
});

test('discards a run superseded while minting', async () => {
  const slow = deferred<ReturnType<typeof session>>();
  mintMock.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(session('s2'));
  const renderer = await render(DEV);
  expect(latest.status).toBe('initializing');
  await act(async () => {
    renderer.update(<Harness {...DEV} environment="production" />);
  });
  await act(async () => {
    slow.resolve(session('s1'));
  });
  expect(clients).toHaveLength(1);
  expect(clients[0].config.environment).toBe('production');
  expect(latest.status).toBe('ready');
});

test('bumping generation re-initializes with a fresh client', async () => {
  const renderer = await render(DEV);
  await act(async () => {
    renderer.update(<Harness {...DEV} generation={1} />);
  });
  expect(clients).toHaveLength(2);
  expect(clients[0].destroy).toHaveBeenCalled();
});

test('init failure surfaces an error and retry re-runs', async () => {
  mintMock.mockRejectedValueOnce(new Error('create-session 401: nope'));
  await render(DEV);
  expect(latest.status).toBe('error');
  expect(latest.initError).toBe('unknown — create-session 401: nope');
  expect(latest.log.some(l => l.level === 'error')).toBe(true);
  await act(async () => {
    latest.retry();
  });
  expect(latest.status).toBe('ready');
});

test('unmount destroys the client', async () => {
  const renderer = await render(DEV);
  await act(async () => {
    renderer.unmount();
  });
  mounted.delete(renderer);
  expect(clients[0].destroy).toHaveBeenCalled();
});

function fire(name: string, payload: unknown) {
  const calls = clients[0].addEventListener.mock.calls as unknown as [string, (e: unknown) => void][];
  for (const [n, fn] of calls) {
    if (n === name) {
      fn(payload);
    }
  }
}

test('a failed event after a completed event leaves no completed outcome', async () => {
  await render(DEV);
  await act(async () => fire('completed', { checkoutId: 'co_1' }));
  expect(latest.completedCheckoutId).toBe('co_1');
  await act(async () => fire('failed', { error: { code: 'payment_failed', message: 'nope' } }));
  expect(latest.completedCheckoutId).toBeNull();
  expect(latest.lastFailure).toBe('payment_failed — nope');
});

test('clearOutcome nulls the completed checkout and the last failure', async () => {
  await render(DEV);
  await act(async () => fire('completed', { checkoutId: 'co_1' }));
  await act(async () => fire('failed', { error: { code: 'x', message: 'y' } }));
  await act(async () => fire('completed', { checkoutId: 'co_2' }));
  expect(latest.completedCheckoutId).toBe('co_2');
  await act(async () => fire('failed', { error: { code: 'x', message: 'y' } }));
  await act(async () => fire('completed', { checkoutId: 'co_3' }));
  await act(async () => latest.clearOutcome());
  expect(latest.completedCheckoutId).toBeNull();
  expect(latest.lastFailure).toBeNull();
});

test('never exposes a client in the render that retires it', async () => {
  // Effects of children (e.g. useCheckout) run in the same commit as this
  // hook's cleanup, so a client returned during that render gets called after
  // it was disposed ("NativeState is null").
  const renderer = await render(DEV);
  expect(latest.client).toBe(clients[0]);
  renders = [];

  await act(async () => {
    renderer.update(<Harness {...DEV} theme="light" />);
  });

  expect(clients[0].destroy).toHaveBeenCalled();
  expect(renders[0].props.theme).toBe('light');
  expect(renders.filter(r => (r.handle.client as unknown) === clients[0])).toEqual([]);
  expect(latest.client).toBe(clients[1]);
});

test('settledEnvironment follows each finished run, failed or not', async () => {
  mintMock.mockRejectedValueOnce(new Error('create-session 401: nope'));
  const renderer = await render(DEV);
  expect(latest.status).toBe('error');
  expect(latest.settledEnvironment).toBe('development');

  mintMock.mockRejectedValueOnce(new Error('create-session 401: nope'));
  await act(async () => {
    renderer.update(<Harness {...DEV} environment="production" />);
  });
  expect(latest.status).toBe('error');
  expect(latest.settledEnvironment).toBe('production');
});


test('pending clears prior completion and logs the processing outcome', async () => {
  await render(DEV);
  await act(async () => fire('completed', { checkoutId: 'old' }));
  await act(async () => fire('paymentPending', {}));
  expect(latest.completedCheckoutId).toBeNull();
  expect(latest.lastFailure).toBeNull();
  expect(latest.log.at(-1)?.line).toContain('Payment processing');
});

test('uses customer-friendly error copy in the status box', async () => {
  await render(DEV);
  await act(async () => fire('failed', { error: { code: 'providerFailed', message: 'diagnostic', userMessage: 'Check your transaction before trying again.' } }));
  expect(latest.lastFailure).toBe('providerFailed — Check your transaction before trying again.');
});

test('records finalization separately from failures and clearing the message', async () => {
  await render(DEV);
  expect(latest.hasFinalizedCheckout).toBe(false);
  await act(async () => fire('failed', { error: { code: 'temporaryFailure', message: 'offline' } }));
  expect(latest.hasFinalizedCheckout).toBe(false);
  await act(async () => fire('checkoutFinalized', { response: { onramperTransactionId: 'tx' } }));
  await act(async () => fire('failed', { error: { code: 'providerFailed', message: 'Check status' } }));
  expect(latest.hasFinalizedCheckout).toBe(true);
  await act(async () => latest.clearOutcome());
  expect(latest.hasFinalizedCheckout).toBe(true);
});

test.each(['checkoutPreparing', 'ready'])(
  '%s clears finalization without losing the retained transaction ID',
  async kind => {
    await render(DEV);
    await act(async () => {
      clients[0].addTransactionIdListener.mock.calls[0][0]('old-tx');
      fire('checkoutFinalized', { response: { onramperTransactionId: 'old-tx' } });
    });
    await act(async () => clients[0].addStateListener.mock.calls[0][0]({ kind }));
    expect(latest.hasFinalizedCheckout).toBe(false);
    expect(latest.transactionId).toBe('old-tx');
  },
);

test('re-initializing does not carry finalization over to a new client', async () => {
  const renderer = await render(DEV);
  await act(async () => fire('checkoutFinalized', { response: { onramperTransactionId: 'tx' } }));
  expect(latest.hasFinalizedCheckout).toBe(true);
  await act(async () => renderer.update(<Harness {...DEV} generation={1} />));
  expect(latest.hasFinalizedCheckout).toBe(false);
});

describe('trusted partner login', () => {
  const EMAIL = 'tester@onramper.com';
  const onSessionExpired = (i: number) =>
    (ClientMock.mock.calls[i][0] as { onSessionExpired: () => Promise<unknown> }).onSessionExpired;

  test('without an email nothing is reported or logged', async () => {
    await render(DEV);
    expect(latest.trustedLogin).toBeNull();
    expect(latest.log.some(l => l.line.includes('trusted login'))).toBe(false);
  });

  test('sends the email, exposes the result and hands only credentials to the SDK', async () => {
    mintMock.mockResolvedValue({ ...session('s1'), trustedLogin: 'bound' });
    await render({ ...DEV, trustedLoginEmail: EMAIL });
    expect(mintMock).toHaveBeenCalledWith(expect.any(String), 'tok-dev', EMAIL);
    expect(clients[0].initialize).toHaveBeenCalledWith(session('s1'));
    expect(latest.trustedLogin).toBe('bound');
    expect(latest.log.map(l => l.line)).toContain('trusted login: bound');
  });

  test('never logs the email address', async () => {
    mintMock.mockResolvedValue({ ...session('s1'), trustedLogin: 'unavailable' });
    await render({ ...DEV, trustedLoginEmail: EMAIL });
    expect(latest.trustedLogin).toBe('unavailable');
    expect(latest.log.some(l => l.line.includes('trusted login: unavailable'))).toBe(true);
    expect(latest.log.some(l => l.line.includes(EMAIL))).toBe(false);
  });

  test('changing the email destroys the client and builds a new one for the new user', async () => {
    const renderer = await render({ ...DEV, trustedLoginEmail: EMAIL });
    await act(async () => {
      renderer.update(<Harness {...DEV} trustedLoginEmail="other@moonpay.com" />);
    });
    expect(clients).toHaveLength(2);
    expect(clients[0].destroy).toHaveBeenCalled();
    expect(mintMock).toHaveBeenLastCalledWith(expect.any(String), 'tok-dev', 'other@moonpay.com');
    expect(latest.client).toBe(clients[1]);
  });

  test('the session-expiry re-mint sends the same email and returns only credentials', async () => {
    await render({ ...DEV, trustedLoginEmail: EMAIL });
    mintMock.mockResolvedValueOnce({ ...session('s2'), trustedLogin: 'unavailable' });
    let renewed: unknown;
    await act(async () => {
      renewed = await onSessionExpired(0)();
    });
    expect(mintMock).toHaveBeenCalledTimes(2);
    expect(mintMock).toHaveBeenLastCalledWith(expect.any(String), 'tok-dev', EMAIL);
    expect(renewed).toEqual(session('s2'));
    expect(latest.trustedLogin).toBe('unavailable');
  });

  test('a mint rejected for the email surfaces as an init error', async () => {
    mintMock.mockRejectedValueOnce(new Error('create-session 400: {"error":"email_not_allowed"}'));
    await render({ ...DEV, trustedLoginEmail: 'someone@example.com' });
    expect(latest.status).toBe('error');
    expect(latest.initError).toContain('email_not_allowed');
    expect(latest.trustedLogin).toBeNull();
  });
});
