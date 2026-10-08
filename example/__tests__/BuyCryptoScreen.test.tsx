/**
 * @format
 */

import React from 'react';
import { Switch, Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { OnramperClient } from '@onramper/onramper-react-native';

jest.mock('@onramper/onramper-react-native', () => ({
  OnramperClient: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { BuyCryptoScreen } from '../screens/BuyCryptoScreen';
import { PALETTES, ThemeContext } from '../theme';
import type { OnramperHandle } from '../hooks/useOnramper';

const quote = {
  quoteId: 'q',
  ramp: 'moonpay',
  rate: 150,
  payout: 1,
  paymentMethod: 'applepay',
  networkFee: 0.1,
  transactionFee: 1,
};

function setup() {
  const client = {
    getCheckoutRequirements: jest.fn(() =>
      Promise.resolve({ quote, button: <></> }),
    ),
  };
  const onramper = {
    client: client as unknown as OnramperClient,
    status: 'ready',
    initError: null,
    sdkState: 'ready',
    transactionId: null,
    completedCheckoutId: null,
    lastFailure: null,
    log: [],
    appendLog: jest.fn(),
    clearLog: jest.fn(),
    clearOutcome: jest.fn(),
    retry: jest.fn(),
  } as unknown as OnramperHandle;
  return { client, onramper };
}

async function render(onramper: OnramperHandle) {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(
      <ThemeContext.Provider value={PALETTES.dark}>
        <BuyCryptoScreen
          onramper={onramper}
          environment="development"
          onOpenSettings={() => {}}
        />
      </ThemeContext.Provider>,
    );
  });
  await act(async () =>
    r.root.findByProps({ accessibilityLabel: 'Prefill' }).props.onPress(),
  );
  return r;
}

const lastPrefill = (client: ReturnType<typeof setup>['client']) =>
  (
    client.getCheckoutRequirements.mock.calls.at(-1) as unknown[] | undefined
  )?.[2];

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// Switches in order: country override, Send prefill, Send email.
const enablePrefill = (r: ReactTestRenderer.ReactTestRenderer) =>
  act(async () => r.root.findAllByType(Switch)[1].props.onValueChange(true));

test('prefill is off by default; turning it on re-quotes immediately with the names', async () => {
  const { client, onramper } = setup();
  const r = await render(onramper);
  const before = client.getCheckoutRequirements.mock.calls.length;
  expect(lastPrefill(client)).toEqual({});

  await enablePrefill(r);

  expect(client.getCheckoutRequirements.mock.calls.length).toBe(before + 1);
  expect(lastPrefill(client)).toEqual({
    firstName: 'Ada',
    lastName: 'Lovelace',
  });
});

test('editing a prefill text field re-quotes only after the typing debounce', async () => {
  const { client, onramper } = setup();
  const r = await render(onramper);
  await enablePrefill(r);
  const before = client.getCheckoutRequirements.mock.calls.length;

  const first = r.root
    .findAllByType(TextInput)
    .find(i => i.props.value === 'Ada')!;
  await act(async () => first.props.onChangeText('Grace'));
  await act(async () => {
    jest.advanceTimersByTime(399);
  });
  expect(client.getCheckoutRequirements.mock.calls.length).toBe(before);

  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(client.getCheckoutRequirements.mock.calls.length).toBe(before + 1);
  expect(lastPrefill(client)).toEqual({
    firstName: 'Grace',
    lastName: 'Lovelace',
  });
});

test('Reset clears the outcome after a successful action', async () => {
  const { client, onramper } = setup();
  const reset = jest.fn(() => Promise.resolve());
  Object.assign(client, { reset });
  const handle = { ...onramper, completedCheckoutId: 'co_1' } as OnramperHandle;
  (handle.clearOutcome as jest.Mock).mockImplementation(() => {
    rerender({ ...handle, completedCheckoutId: null } as OnramperHandle);
  });
  const r = await render(handle);
  const rerender = (next: OnramperHandle) =>
    r.update(
      <ThemeContext.Provider value={PALETTES.dark}>
        <BuyCryptoScreen
          onramper={next}
          environment="development"
          onOpenSettings={() => {}}
        />
      </ThemeContext.Provider>,
    );
  const has = () =>
    r.root.findAll(n => n.props.title === 'Transaction complete').length > 0;
  expect(has()).toBe(true);

  const resetButton = r.root.find(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.findAllByType(Text).some(x => x.props.children === 'Reset'),
  );
  await act(async () => resetButton.props.onPress());

  expect(reset).toHaveBeenCalled();
  expect(handle.clearOutcome).toHaveBeenCalled();
  expect(has()).toBe(false);
});

test('the onramp dropdown filters quotes by provider', async () => {
  const { client, onramper } = setup();
  const r = await render(onramper);
  const lastRequest = () =>
    (
      client.getCheckoutRequirements.mock.calls.at(-1) as unknown[] | undefined
    )?.[0] as { onlyOnramps?: string[] };
  expect(lastRequest().onlyOnramps).toBeUndefined();

  await act(async () =>
    r.root.findByProps({ accessibilityLabel: 'Onramp' }).props.onPress(),
  );
  await act(async () =>
    r.root.findByProps({ accessibilityLabel: 'Paybis' }).props.onPress(),
  );

  expect(lastRequest().onlyOnramps).toEqual(['paybis']);
  expect(r.root.findAllByProps({ accessibilityLabel: 'MoonPay' })).toHaveLength(
    0,
  );
});

test('the amount input is named for VoiceOver with the selected fiat', async () => {
  const { onramper } = setup();
  const r = await render(onramper);
  const labels = r.root
    .findAllByType(TextInput)
    .map(i => i.props.accessibilityLabel);
  expect(labels).toContain('Amount in USD');
});
