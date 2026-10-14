import { Platform } from 'react-native';
import { OnramperClient } from '../src/OnramperClient';
import { __lastNative, makeNative, NitroModules } from './__mocks__/react-native-nitro-modules';

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test('reports the native version without configuring a client or session', () => {
  const native = makeNative();
  native.sdkVersion = '9.8.7';
  NitroModules.createHybridObject.mockReturnValueOnce(native);

  expect(OnramperClient.sdkVersion).toBe('9.8.7');
  expect(native.configure).not.toHaveBeenCalled();
  expect(native.initialize).not.toHaveBeenCalled();
  expect(native.setStateListener).not.toHaveBeenCalled();
  expect(native.setEventListener).not.toHaveBeenCalled();
  expect(native.setSessionExpirationHandler).not.toHaveBeenCalled();
  expect(native.dispose).toHaveBeenCalledTimes(1);
});

test('cleans up the temporary bridge if reading the native property fails', () => {
  const native = makeNative();
  const error = new Error('native version read failed');
  Object.defineProperty(native, 'sdkVersion', { get: () => { throw error; } });
  NitroModules.createHybridObject.mockReturnValueOnce(native);

  expect(() => OnramperClient.sdkVersion).toThrow(error);
  expect(native.dispose).toHaveBeenCalledTimes(1);
});

test('reading metadata does not dispose or reconfigure an active client', async () => {
  const client = new OnramperClient({
    apiKey: 'test', clientId: 'test', environment: 'development',
    onSessionExpired: jest.fn(),
  });
  const active = __lastNative();
  const version = makeNative();
  version.sdkVersion = '9.8.7';
  NitroModules.createHybridObject.mockReturnValueOnce(version);

  expect(OnramperClient.sdkVersion).toBe('9.8.7');
  expect(active.dispose).not.toHaveBeenCalled();
  expect(active.configure).toHaveBeenCalledTimes(1);
  await client.initialize({ sessionId: 'test', sessionToken: 'test' });
  expect(active.initialize).toHaveBeenCalledTimes(1);
  expect(version.dispose).toHaveBeenCalledTimes(1);
  client.destroy();
});

test.each(['android', 'web'] as const)('fails clearly on %s before allocating a bridge', os => {
  jest.replaceProperty(Platform, 'OS', os);
  expect(() => OnramperClient.sdkVersion).toThrow(`it is not supported on ${os}`);
  expect(NitroModules.createHybridObject).not.toHaveBeenCalled();
});
