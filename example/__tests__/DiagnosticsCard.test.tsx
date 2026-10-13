import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { DiagnosticsCard } from '../components/DiagnosticsCard';
import { diagnosticStore } from '../utils/diagnostics';

jest.mock('../utils/diagnostics', () => ({
  diagnosticStore: {
    getEnabled: jest.fn().mockResolvedValue(true),
    setEnabled: jest.fn().mockResolvedValue(undefined),
    shareLogs: jest.fn().mockResolvedValue(undefined),
    clearLogs: jest.fn().mockResolvedValue(undefined),
  },
}));

const store = diagnosticStore as jest.Mocked<NonNullable<typeof diagnosticStore>>;

beforeEach(() => {
  jest.clearAllMocks();
  store.getEnabled.mockResolvedValue(true);
});

async function render() {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { r = ReactTestRenderer.create(<DiagnosticsCard />); });
  return r;
}

test('reflects default-on recording and lets the tester turn it off', async () => {
  const r = await render();
  const toggle = () => r.root.findByProps({ accessibilityLabel: 'Save SDK logs' });
  expect(toggle().props.value).toBe(true);
  expect(store.setEnabled).not.toHaveBeenCalled();
  await act(async () => toggle().props.onValueChange(false));
  expect(store.setEnabled).toHaveBeenCalledWith(false);
  expect(toggle().props.value).toBe(false);
});

test('failed enable keeps recording off and shows the error', async () => {
  store.getEnabled.mockResolvedValueOnce(false);
  store.setEnabled.mockRejectedValueOnce(new Error('Could not save setting.'));
  const r = await render();
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Save SDK logs' }).props.onValueChange(true));
  expect(r.root.findByProps({ accessibilityLabel: 'Save SDK logs' }).props.value).toBe(false);
  expect(JSON.stringify(r.toJSON())).toContain('Could not save setting.');
});

test('share surfaces no-log guidance without turning recording on', async () => {
  store.shareLogs.mockRejectedValueOnce(new Error('Enable diagnostic logging and reproduce the issue first.'));
  const r = await render();
  await act(async () => r.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(store.shareLogs).toHaveBeenCalledTimes(1);
  expect(store.setEnabled).not.toHaveBeenCalled();
  expect(JSON.stringify(r.toJSON())).toContain('reproduce the issue first');
});

test('delete clears stored logs without changing the preference', async () => {
  const r = await render();
  await act(async () => r.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[1].props.onPress());
  expect(store.clearLogs).toHaveBeenCalledTimes(1);
  expect(store.setEnabled).not.toHaveBeenCalled();
});

test('preserves a previously saved off preference', async () => {
  store.getEnabled.mockResolvedValueOnce(false);
  const r = await render();
  expect(r.root.findByProps({ accessibilityLabel: 'Save SDK logs' }).props.value).toBe(false);
  expect(store.setEnabled).not.toHaveBeenCalled();
});
