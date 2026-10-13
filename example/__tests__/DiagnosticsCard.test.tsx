import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { DiagnosticsCard } from '../components/DiagnosticsCard';
import * as diagnostics from '../utils/diagnostics';

jest.mock('../utils/diagnostics', () => ({
  __esModule: true,
  diagnosticStore: {
    getEnabled: jest.fn(),
    setEnabled: jest.fn(),
    listFiles: jest.fn(),
    readFile: jest.fn(),
    shareFile: jest.fn(),
    clearLogs: jest.fn(),
  },
}));

const store = diagnostics.diagnosticStore as jest.Mocked<NonNullable<typeof diagnostics.diagnosticStore>>;
const file = { name: 'onramper-sdk-2026-10-13.log', sizeBytes: 2048, modifiedAt: 1791849600000 };

beforeEach(() => {
  jest.resetAllMocks();
  store.getEnabled.mockResolvedValue(true);
  store.setEnabled.mockResolvedValue(undefined);
  store.listFiles.mockResolvedValue([file]);
  store.readFile.mockResolvedValue('2026-10-13T12:00:00Z INFO Client client.configured');
  store.shareFile.mockResolvedValue(undefined);
  store.clearLogs.mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

async function render() {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { r = ReactTestRenderer.create(<DiagnosticsCard />); });
  return r;
}

async function press(r: ReactTestRenderer.ReactTestRenderer, label: string) {
  await act(async () => r.root.findByProps({ accessibilityLabel: label }).props.onPress());
}

test('loads default-on recording with dated files and sizes', async () => {
  const r = await render();
  expect(r.root.findByProps({ accessibilityLabel: 'Save SDK logs' }).props.value).toBe(true);
  expect(JSON.stringify(r.toJSON())).toContain(file.name);
  expect(JSON.stringify(r.toJSON())).toContain('2 KB');
  expect(store.setEnabled).not.toHaveBeenCalled();
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Save SDK logs' }).props.onValueChange(false));
  expect(store.setEnabled).toHaveBeenCalledWith(false);
  expect(r.root.findByProps({ accessibilityLabel: 'Save SDK logs' }).props.value).toBe(false);
});

test('an unavailable native store shows an explanation without spinning or enabling controls', async () => {
  jest.replaceProperty(diagnostics, 'diagnosticStore', undefined);
  const r = await render();
  expect(JSON.stringify(r.toJSON())).toContain('Diagnostic logging requires the native demo build.');
  expect(r.root.findAllByProps({ accessibilityLabel: 'Loading logs' })).toHaveLength(0);
  expect(r.root.findByProps({ accessibilityLabel: 'Save SDK logs' }).props.disabled).toBe(true);
  expect(r.root.findByProps({ accessibilityLabel: 'Refresh log files' }).props.disabled).toBe(true);
  expect(store.getEnabled).not.toHaveBeenCalled();
  expect(store.listFiles).not.toHaveBeenCalled();
  await act(async () => r.unmount());
});

test('preserves a saved off preference and a failed enable', async () => {
  store.getEnabled.mockResolvedValueOnce(false);
  store.setEnabled.mockRejectedValueOnce(new Error('Could not save setting.'));
  const r = await render();
  expect(store.setEnabled).not.toHaveBeenCalled();
  await act(async () => r.root.findByProps({ accessibilityLabel: 'Save SDK logs' }).props.onValueChange(true));
  expect(r.root.findByProps({ accessibilityLabel: 'Save SDK logs' }).props.value).toBe(false);
  expect(JSON.stringify(r.toJSON())).toContain('Could not save setting.');
});

test('opens a readable preview and shares only the selected file', async () => {
  const r = await render();
  await press(r, `Open ${file.name}`);
  expect(store.readFile).toHaveBeenCalledWith(file.name);
  expect(JSON.stringify(r.toJSON())).toContain('client.configured');
  await press(r, 'Share open log file');
  expect(store.shareFile).toHaveBeenCalledWith(file.name);
});

test('shares a listed file and surfaces a missing-file error', async () => {
  store.shareFile.mockRejectedValueOnce(new Error('Refresh the list and try again.'));
  const r = await render();
  await press(r, `Share ${file.name}`);
  expect(store.shareFile).toHaveBeenCalledWith(file.name);
  expect(JSON.stringify(r.toJSON())).toContain('Refresh the list and try again.');
});

test('shows a preview read failure instead of stale content', async () => {
  store.readFile.mockRejectedValueOnce(new Error('Could not read this log file.'));
  const r = await render();
  await press(r, `Open ${file.name}`);
  expect(JSON.stringify(r.toJSON())).toContain('Could not read this log file.');
  expect(JSON.stringify(r.toJSON())).not.toContain('client.configured');
});

test('refresh discovers a new daily file', async () => {
  const r = await render();
  const next = { ...file, name: 'onramper-sdk-2026-10-14.log' };
  store.listFiles.mockResolvedValueOnce([next, file]);
  await press(r, 'Refresh log files');
  expect(JSON.stringify(r.toJSON())).toContain(next.name);
  expect(store.setEnabled).not.toHaveBeenCalled();
});

test('delete asks for confirmation and cancellation preserves the files', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const r = await render();
  await press(r, 'Delete all logs');
  const buttons = alert.mock.calls[0][2]!;
  expect(buttons.find(button => button.style === 'cancel')).toBeDefined();
  expect(store.clearLogs).not.toHaveBeenCalled();
  expect(JSON.stringify(r.toJSON())).toContain(file.name);
});

test('confirmed delete refreshes the list without changing recording', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const r = await render();
  await press(r, 'Delete all logs');
  store.listFiles.mockResolvedValueOnce([]);
  const confirm = alert.mock.calls[0][2]!.find(button => button.style === 'destructive')!;
  await act(async () => confirm.onPress?.());
  expect(store.clearLogs).toHaveBeenCalledTimes(1);
  expect(store.setEnabled).not.toHaveBeenCalled();
  expect(JSON.stringify(r.toJSON())).toContain('No log files yet.');
  expect(r.root.findByProps({ accessibilityLabel: 'Delete all logs' }).props.disabled).toBe(true);
});
