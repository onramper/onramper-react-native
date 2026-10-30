/**
 * @format
 */

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { createDemoSession } from '../createDemoSession';

// No secrets for either environment: every init run fails inside
// resolveEnvironment, before any network call.
jest.mock('../env.local', () => ({ ENV: {} }), { virtual: true });
jest.mock('@onramper/onramper-react-native', () => ({
  OnramperClient: Object.assign(jest.fn(), { sdkVersion: '9.8.7' }),
}));
jest.mock('../createDemoSession', () => ({ createDemoSession: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import App from '../App';

async function renderWithSettingsOpen() {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(<App />);
  });
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Settings' }).props.onPress());
  return r;
}

const text = (r: ReactTestRenderer.ReactTestRenderer) => JSON.stringify(r.toJSON());

test('clearing sessions without an initialized SDK reports an error instead of success', async () => {
  const r = await renderWithSettingsOpen();

  await act(async () => r.root.findByProps({ accessibilityLabel: 'Clear local sessions' }).props.onPress());

  expect(text(r)).toContain("The SDK isn't initialized, so there are no sessions to clear");
  expect(text(r)).not.toContain('local sessions cleared');
  expect(createDemoSession).not.toHaveBeenCalled();
});

test('applying a trusted login email restarts the session and logs without the address', async () => {
  const r = await renderWithSettingsOpen();
  const email = r.root.findByProps({ accessibilityLabel: 'Email', keyboardType: 'email-address' });

  await act(async () => email.props.onChangeText('tester@onramper.com'));
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Apply & restart session' }).props.onPress());

  // Expand the (collapsed) event logs to read the lines.
  for (const toggle of r.root.findAllByProps({ accessibilityLabel: 'SDK events' })) {
    if (typeof toggle.props.onPress === 'function') {
      await act(async () => toggle.props.onPress());
    }
  }
  expect(text(r)).toContain('trusted login email changed — restarting session');
  expect(r.root.findByProps({ testID: 'trusted-login-status' }).props.children).toBe('—');
  expect(r.root.findByProps({ accessibilityLabel: 'Apply & restart session' }).props.disabled).toBe(true);
  // The only place the address may appear is the input itself.
  expect(text(r).split('tester@onramper.com')).toHaveLength(2);
});
