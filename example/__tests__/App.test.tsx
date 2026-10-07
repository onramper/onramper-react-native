/**
 * @format
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { createDemoSession } from '../createDemoSession';

jest.mock(
  '../env.local',
  () => ({
    ENV: {
      development: { apiKey: 'pk_test_x', clientId: 'cid', demoToken: 'tok' },
      production: { apiKey: 'pk_prod_x', clientId: 'cid', demoToken: 'tok' },
    },
  }),
  { virtual: true },
);
jest.mock('@onramper/onramper-react-native', () => ({ OnramperClient: jest.fn() }));
// Never resolves: the app stays in its initializing state for these render tests.
jest.mock('../createDemoSession', () => ({ createDemoSession: jest.fn(() => new Promise(() => {})) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import App from '../App';

async function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  return renderer;
}

test('starts SDK initialization on launch without any button tap', async () => {
  await render();
  expect(createDemoSession).toHaveBeenCalledWith('https://demo-stg.onramper.dev/demo/create-session', 'tok');
});

test('renders the Buy Crypto form', async () => {
  const out = JSON.stringify((await render()).toJSON());
  for (const s of ['Buy Crypto', 'BTC', 'ETH', 'SOL', 'Apple Pay', 'Revolut Pay', 'USD', 'Onramp', 'Prefill']) {
    expect(out).toContain(s);
  }
  expect(out).not.toContain('Configure + Initialize');
});

test('the gear opens the settings sheet', async () => {
  const r = await render();
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Settings' }).props.onPress());
  expect(JSON.stringify(r.toJSON())).toContain('Clear local sessions');
});
