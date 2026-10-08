import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SettingsSheet, type SettingsSheetProps } from '../screens/SettingsSheet';

jest.mock('../env.local', () => ({ ENV: {} }), { virtual: true });

function props(overrides: Partial<SettingsSheetProps> = {}): SettingsSheetProps {
  return {
    visible: true,
    onClose: jest.fn(),
    environment: 'development',
    onChangeEnvironment: jest.fn(),
    switching: false,
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
  for (const s of ['Environment', 'Clear local sessions', 'Dark mode', 'SDK events', 'Library', 'OnramperSDK']) {
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
