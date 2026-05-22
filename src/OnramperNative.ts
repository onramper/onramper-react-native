import { EventEmitter, type Subscription, requireNativeModule } from 'expo-modules-core';

// Mirrors the AsyncFunctions exposed by the native module in
// `ios/OnramperReactNativeModule.swift`. Records (configure's config + button
// style) are passed as plain JS objects; expo-modules-core does the Codable
// conversion on the Swift side.
interface OnramperNativeModule {
  configure(config: {
    apiKey: string;
    clientId: string;
    environment: string;
    theme: string;
    logLevel: string;
  }): Promise<void>;
  initialize(sessionId: string, sessionToken: string): Promise<void>;
  getCheckoutRequirements(
    request: Record<string, unknown>,
    buttonStyle: Record<string, unknown>,
  ): Promise<{ intentHandle: string; quote: Record<string, unknown> }>;
  cancelPreparedIntent(intentHandle: string): Promise<void>;
  reset(): Promise<void>;
  // Session refresh round-trip. Native emits `onSessionExpired` with a token;
  // JS responds with one of these two. See OnramperClient for the wiring.
  provideSessionCredentials(token: string, credentials: { sessionId: string; sessionToken: string }): Promise<void>;
  failSessionRefresh(token: string, message: string): Promise<void>;
}

export const OnramperNative = requireNativeModule<OnramperNativeModule>('OnramperReactNative');
export const OnramperEmitter = new EventEmitter(OnramperNative as unknown as object);
export type { Subscription };
