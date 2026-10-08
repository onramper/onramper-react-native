/**
 * @format
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { OnramperHandle, UseOnramperOptions } from '../hooks/useOnramper';

jest.mock('../env.local', () => ({ ENV: {} }), { virtual: true });
jest.mock('@onramper/onramper-react-native', () => ({
  OnramperClient: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// The hook as it behaves when a failed run is followed by another run that
// fails before any network call: React can batch its 'initializing' and
// 'error' updates, so `status` stays 'error' throughout. Each environment's run
// "settles" as soon as it is requested.
jest.mock('../hooks/useOnramper', () => ({
  useOnramper: ({ environment }: UseOnramperOptions): Partial<OnramperHandle> => ({
    client: null,
    status: 'error',
    initError: `unknown — env.local.ts is missing ${environment}.apiKey`,
    sdkState: 'idle',
    transactionId: null,
    completedCheckoutId: null,
    lastFailure: null,
    settledEnvironment: environment,
    log: [],
    appendLog: () => {},
    clearLog: () => {},
    clearOutcome: () => {},
    retry: () => {},
  }),
}));

import App from '../App';

test('an environment switch unlocks once the target settles, even if status never leaves error', async () => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(<App />);
  });
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Settings' }).props.onPress());

  await act(async () => r.root.findByProps({ accessibilityLabel: 'Production' }).props.onPress());

  expect(JSON.stringify(r.toJSON())).not.toContain('Switching environment…');
  expect(r.root.findByProps({ accessibilityLabel: 'Development' }).props.disabled).toBe(false);
});
