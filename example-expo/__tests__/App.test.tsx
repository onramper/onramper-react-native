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
