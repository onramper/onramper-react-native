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

function Harness(props: UseOnramperOptions) {
  latest = useOnramper(props);
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

const DEV = { environment: 'development', theme: 'dark', generation: 0 } as const;
const session = (id: string) => ({ sessionId: id, sessionToken: `${id}-token` });

beforeEach(() => {
  clients = [];
  ClientMock.mockReset();
  ClientMock.mockImplementation((config: FakeClient['config']) => {
    const client: FakeClient = {
      config,
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

async function render(props: UseOnramperOptions) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<Harness {...props} />);
  });
  return renderer;
}

test('initializes automatically on mount for the selected environment', async () => {
  await render(DEV);
  expect(mintMock).toHaveBeenCalledWith('https://demo-stg.onramper.dev/demo/create-session', 'tok-dev');
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
  expect(mintMock).toHaveBeenLastCalledWith('https://demo-prod.onramper.com/demo/create-session', 'tok-prod');
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
