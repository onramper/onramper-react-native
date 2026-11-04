/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { OnramperClient, type OnramperErrorPayload } from '@onramper/onramper-react-native';

jest.mock('expo-application', () => ({
  applicationId: null,
  nativeApplicationVersion: null,
  nativeBuildVersion: null,
}));

jest.mock('../env.local', () => ({
  ENV: { apiKey: '', clientId: '', demoToken: '' },
}), { virtual: true });

jest.mock('@onramper/onramper-react-native', () => ({
  OnramperClient: Object.assign(jest.fn(), { sdkVersion: '9.8.7' }),
  OnramperError: jest.requireActual('../../src/errors').OnramperError,
}));

jest.mock('../createDemoSession', () => ({
  createDemoSession: jest.fn().mockResolvedValue({ sessionId: 'test-session', sessionToken: 'test-token' }),
}));

import { createDemoSession } from '../createDemoSession';
import App from '../App';

test('renders an empty Onramper transaction ID before finalization', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('9.8.7');
  expect(JSON.stringify(renderer.toJSON())).toContain('Onramper transaction ID');
  expect(JSON.stringify(renderer.toJSON())).toContain('—');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test.each<OnramperErrorPayload>([
  { code: 'webviewLoadFailed', message: 'internal provider detail' },
  { code: 'applePayNotConfigured', message: 'internal provider detail', userMessage: 'Set up Apple Pay to continue.', supportCode: 'APPLE_PAY_SETUP' },
])('failed events provide safe copy for $code', async payload => {
  let onFailed!: (event: { error: OnramperErrorPayload }) => void;
  const nativeClient = {
    addTransactionIdListener: jest.fn(),
    addStateListener: jest.fn(),
    addEventListener: jest.fn((name, listener) => {
      if (name === 'failed') onFailed = listener;
    }),
    enableStripeCheckout: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
  };
  jest.mocked(OnramperClient).mockImplementation(() => nativeClient as unknown as OnramperClient);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(async () => {
    await renderer.root.findByProps({ title: 'Configure + Initialize' }).props.onPress();
  });
  await ReactTestRenderer.act(async () => onFailed({ error: payload }));
  const screen = JSON.stringify(renderer.toJSON());
  expect(screen).toContain(payload.userMessage ?? 'Something went wrong. Please try again.');
  expect(screen).toContain(payload.supportCode ?? payload.code);
  expect(screen).not.toContain('undefined');
  expect(screen).not.toContain('internal provider detail');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

describe('trusted partner login', () => {
  const EMAIL = 'tester@onramper.com';
  type Config = ConstructorParameters<typeof OnramperClient>[0];
  let clients: { signOut: jest.Mock; destroy: jest.Mock; initialize: jest.Mock; config: Config }[];

  beforeEach(() => {
    clients = [];
    jest.mocked(createDemoSession).mockClear();
    jest.mocked(OnramperClient).mockImplementation((config: Config) => {
      const c = {
        config,
        addTransactionIdListener: jest.fn(),
        addStateListener: jest.fn(),
        addEventListener: jest.fn(),
        enableStripeCheckout: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        signOut: jest.fn().mockResolvedValue(undefined),
        destroy: jest.fn(),
      };
      clients.push(c);
      return c as unknown as OnramperClient;
    });
  });

  async function setup() {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    const typeEmail = (v: string) =>
      ReactTestRenderer.act(async () =>
        renderer.root.findByProps({ placeholder: '(blank — normal OTP sign-in)' }).props.onChangeText(v),
      );
    const initialize = () =>
      ReactTestRenderer.act(async () => {
        await renderer.root.findByProps({ title: 'Configure + Initialize' }).props.onPress();
      });
    return { renderer, typeEmail, initialize };
  }

  test('sends the email on the mint and the expiry re-mint, and shows the outcome without logging the address', async () => {
    jest.mocked(createDemoSession).mockResolvedValue({ sessionId: 's', sessionToken: 't', trustedLogin: 'bound' });
    const { renderer, typeEmail, initialize } = await setup();
    await typeEmail(EMAIL);
    await initialize();
    expect(createDemoSession).toHaveBeenLastCalledWith('', EMAIL);
    expect(clients[0].initialize).toHaveBeenCalledWith({ sessionId: 's', sessionToken: 't' });

    let renewed: unknown;
    await ReactTestRenderer.act(async () => {
      renewed = await clients[0].config.onSessionExpired?.();
    });
    expect(createDemoSession).toHaveBeenCalledTimes(2);
    expect(createDemoSession).toHaveBeenLastCalledWith('', EMAIL);
    expect(renewed).toEqual({ sessionId: 's', sessionToken: 't' });

    const screen = JSON.stringify(renderer.toJSON());
    expect(screen).toContain('trusted login: bound');
    // Only the input itself holds the address.
    expect(screen.split(EMAIL)).toHaveLength(2);
    await ReactTestRenderer.act(async () => renderer.unmount());
  });

  test('changing the email signs out the old client before building a new one', async () => {
    jest.mocked(createDemoSession).mockResolvedValue({ sessionId: 's', sessionToken: 't' });
    const { renderer, typeEmail, initialize } = await setup();
    await initialize();
    expect(createDemoSession).toHaveBeenLastCalledWith('', '');

    await initialize();
    expect(clients[0].signOut).not.toHaveBeenCalled();

    await typeEmail(EMAIL);
    await initialize();
    expect(clients[1].signOut).toHaveBeenCalled();
    expect(clients[1].destroy).toHaveBeenCalled();
    expect(clients).toHaveLength(3);
    expect(createDemoSession).toHaveBeenLastCalledWith('', EMAIL);
    await ReactTestRenderer.act(async () => renderer.unmount());
  });
});

describe('ramp selector', () => {
  let client: {
    enableStripeCheckout: jest.Mock;
    initialize: jest.Mock;
    getCheckoutRequirements: jest.Mock;
  };

  beforeEach(() => {
    jest.mocked(createDemoSession).mockResolvedValue({ sessionId: 's', sessionToken: 't' });
    jest.mocked(OnramperClient).mockImplementation(() => {
      client = {
        enableStripeCheckout: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        getCheckoutRequirements: jest.fn().mockResolvedValue({
          quote: { ramp: 'stripe', rate: 1, payout: 24, networkFee: 0, transactionFee: 1 },
          button: null,
        }),
      };
      return Object.assign(client, {
        addTransactionIdListener: jest.fn(),
        addStateListener: jest.fn(),
        addEventListener: jest.fn(),
        destroy: jest.fn(),
      }) as unknown as OnramperClient;
    });
  });

  async function setup() {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await ReactTestRenderer.act(async () => {
      await renderer.root.findByProps({ title: 'Configure + Initialize' }).props.onPress();
    });
    const pick = (label: string) =>
      ReactTestRenderer.act(async () => renderer.root.findByProps({ accessibilityLabel: `ramp ${label}` }).props.onPress());
    const request = async () => {
      await ReactTestRenderer.act(async () => {
        await renderer.root.findByProps({ title: 'Get checkout requirements' }).props.onPress();
      });
      return client.getCheckoutRequirements.mock.calls.at(-1)?.[0];
    };
    return { renderer, pick, request };
  }

  test('initialize turns the Stripe checkout on with the demo merchant ID', async () => {
    const { renderer } = await setup();
    expect(client.enableStripeCheckout).toHaveBeenCalledWith({ merchantIdentifier: 'merchant.com.onramper.stripe' });
    await ReactTestRenderer.act(async () => renderer.unmount());
  });

  test('a build without the Stripe provider still initializes', async () => {
    jest.mocked(OnramperClient).mockImplementationOnce(() => {
      client = {
        enableStripeCheckout: jest.fn().mockRejectedValue({ code: 'configurationError', message: 'not installed' }),
        initialize: jest.fn().mockResolvedValue(undefined),
        getCheckoutRequirements: jest.fn(),
      };
      return Object.assign(client, {
        addTransactionIdListener: jest.fn(),
        addStateListener: jest.fn(),
        addEventListener: jest.fn(),
        destroy: jest.fn(),
      }) as unknown as OnramperClient;
    });
    const { renderer } = await setup();
    expect(client.initialize).toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain('initialized OK');
    await ReactTestRenderer.act(async () => renderer.unmount());
  });

  test('Any sends no onlyOnramps', async () => {
    const { renderer, request } = await setup();
    expect((await request()).onlyOnramps).toBeUndefined();
    await ReactTestRenderer.act(async () => renderer.unmount());
  });

  test('picking a ramp sends only that ramp', async () => {
    const { renderer, pick, request } = await setup();
    await pick('MoonPay');
    expect((await request()).onlyOnramps).toEqual(['moonpay']);
    await ReactTestRenderer.act(async () => renderer.unmount());
  });

  test('picking Stripe fills in a request the Stripe checkout accepts', async () => {
    const { renderer, pick, request } = await setup();
    await pick('Stripe');
    expect(await request()).toMatchObject({
      source: 'usd',
      destination: 'usdc_solana',
      amount: 25,
      country: 'us',
      subdivision: 'us-ca',
      paymentMethod: 'applepay',
      wallet: { network: 'solana' },
      onlyOnramps: ['stripe'],
    });
    await ReactTestRenderer.act(async () => renderer.unmount());
  });
});
