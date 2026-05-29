import type { HybridObject } from 'react-native-nitro-modules';

// Plain config passed to configure(). String unions are validated on the Swift
// side against the SDK's Environment/Theme/LogLevel enums.
export interface OnramperNitroConfig {
  apiKey: string;
  clientId: string;
  environment: string; // 'development' | 'production'
  theme: string; // 'system' | 'light' | 'dark'
  logLevel: string; // 'off' | 'error' | 'info' | 'debug'
}

// Mirrors OnramperSDK.SessionCredentials. Named with a Nitro prefix to avoid a
// Swift type clash with the SDK's own `SessionCredentials`.
export interface NitroSessionCredentials {
  sessionId: string;
  sessionToken: string;
}

/**
 * Native bridge to OnramperSDK's `OnramperClient`. The public, typed JS API
 * (`OnramperClient`) wraps this.
 *
 * State and checkout events are delivered as JSON strings (the SDK's
 * `OnramperState`/`CheckoutEvent` are non-Codable Swift enums; the Swift side
 * hand-maps each case to a dict and JSON-encodes it). The JS wrapper parses
 * them back into the fully-typed `OnramperState`/`CheckoutEvent` unions.
 */
export interface OnramperNitro extends HybridObject<{ ios: 'swift' }> {
  configure(config: OnramperNitroConfig): Promise<void>;
  initialize(sessionId: string, sessionToken: string): Promise<void>;
  reset(): Promise<void>;
  signOut(): Promise<void>;

  // Single native callback per stream; the JS wrapper fans out to multiple listeners.
  setStateListener(onState: (stateJson: string) => void): void;
  setEventListener(onEvent: (eventJson: string) => void): void;

  // The SDK's sessionExpirationHandler, as a stored async callback that returns
  // fresh credentials. Replaces the Expo-era onSessionExpired/provide/fail dance.
  setSessionExpirationHandler(handler: () => Promise<NitroSessionCredentials>): void;

  // NOTE: every HybridObject has a built-in `dispose()`; we override it natively
  // (in HybridOnramperNitro.swift) to release stored callbacks + the SDK client.
  // It must NOT be declared here — nitrogen rejects re-declaring dispose().
}
