import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SettingsSheet, type SettingsSheetProps } from '../screens/SettingsSheet';

jest.mock('../env.local', () => ({ ENV: {} }), { virtual: true });
jest.mock('@onramper/onramper-react-native', () => ({
  OnramperClient: { sdkVersion: '9.8.7' },
}));

function props(overrides: Partial<SettingsSheetProps> = {}): SettingsSheetProps {
  return {
    visible: true,
    onClose: jest.fn(),
    environment: 'development',
    onChangeEnvironment: jest.fn(),
    switching: false,
    trustedLoginEmail: '',
    trustedLogin: null,
    onApplyTrustedLoginEmail: jest.fn().mockResolvedValue(undefined),
    isDark: true,
    onChangeDark: jest.fn(),
    onClearSessions: jest.fn().mockResolvedValue(undefined),
    log: [],
    onClearLog: jest.fn(),
    ...overrides,
  };
}

async function render(p: SettingsSheetProps) {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(<SettingsSheet {...p} />);
  });
  return r;
}

test('renders every section with versions', async () => {
  const r = await render(props());
  const out = JSON.stringify(r.toJSON());
  expect(out).toContain('9.8.7');
  for (const s of ['Environment', 'Trusted partner login', 'Clear local sessions', 'Dark mode', 'SDK events', 'Library', 'OnramperSDK']) {
    expect(out).toContain(s);
  }
});

test('picking Production asks to switch environment', async () => {
  const p = props();
  const r = await render(p);
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Production' }).props.onPress());
  expect(p.onChangeEnvironment).toHaveBeenCalledWith('production');
});

test('shows switching state and disables the picker', async () => {
  const r = await render(props({ switching: true }));
  expect(JSON.stringify(r.toJSON())).toContain('Switching environment…');
  expect(r.root.findByProps({ accessibilityLabel: 'Production' }).props.disabled).toBe(true);
});

test('clearing sessions closes the sheet on success', async () => {
  const p = props();
  const r = await render(p);
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Clear local sessions' }).props.onPress());
  expect(p.onClearSessions).toHaveBeenCalled();
  expect(p.onClose).toHaveBeenCalled();
});

test('a clearing failure stays open and shows the error', async () => {
  const p = props({ onClearSessions: jest.fn().mockRejectedValue({ code: 'invalidState', message: 'busy' }) });
  const r = await render(p);
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Clear local sessions' }).props.onPress());
  expect(p.onClose).not.toHaveBeenCalled();
  expect(JSON.stringify(r.toJSON())).toContain('invalidState — busy');
});

const applyButton = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findByProps({ accessibilityLabel: 'Apply & restart session' });
const emailInput = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findByProps({ accessibilityLabel: 'Email', keyboardType: 'email-address' });

describe('trusted partner login', () => {
  test('the email field is set up for addresses', async () => {
    const input = emailInput(await render(props())).props;
    expect(input.autoCapitalize).toBe('none');
    expect(input.autoCorrect).toBe(false);
  });

  test('apply is disabled until the email changes', async () => {
    const r = await render(props({ trustedLoginEmail: 'a@onramper.com' }));
    expect(applyButton(r).props.disabled).toBe(true);
    await act(async () => emailInput(r).props.onChangeText('  a@onramper.com  '));
    expect(applyButton(r).props.disabled).toBe(true);
    await act(async () => emailInput(r).props.onChangeText('b@moonpay.com'));
    expect(applyButton(r).props.disabled).toBe(false);
  });

  test('apply is disabled while an environment switch is in flight', async () => {
    const r = await render(props({ switching: true }));
    await act(async () => emailInput(r).props.onChangeText('b@moonpay.com'));
    expect(applyButton(r).props.disabled).toBe(true);
  });

  test('applying sends the trimmed email', async () => {
    const p = props();
    const r = await render(p);
    await act(async () => emailInput(r).props.onChangeText(' b@moonpay.com '));
    await act(async () => applyButton(r).props.onPress());
    expect(p.onApplyTrustedLoginEmail).toHaveBeenCalledWith('b@moonpay.com');
  });

  test('clearing the email turns trusted login off', async () => {
    const p = props({ trustedLoginEmail: 'a@onramper.com', trustedLogin: 'bound' });
    const r = await render(p);
    await act(async () => emailInput(r).props.onChangeText(''));
    await act(async () => applyButton(r).props.onPress());
    expect(p.onApplyTrustedLoginEmail).toHaveBeenCalledWith('');
  });

  test.each([
    ['', null, 'Off'],
    ['a@onramper.com', 'bound', 'Bound'],
    ['a@onramper.com', 'unavailable', 'Unavailable'],
    ['a@onramper.com', null, '—'],
  ] as const)('email %j with result %j shows %s', async (trustedLoginEmail, trustedLogin, label) => {
    const r = await render(props({ trustedLoginEmail, trustedLogin }));
    expect(r.root.findByProps({ testID: 'trusted-login-status' }).props.children).toBe(label);
  });
});
