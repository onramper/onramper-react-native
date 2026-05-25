import { type EventSubscription, requireNativeModule } from 'expo-modules-core';

import type { CheckoutEvent } from './events';
import type { OnramperState } from './types';

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
  signOut(): Promise<void>;
  // Session refresh round-trip. Native emits `onSessionExpired` with a token;
  // JS responds with one of these two. See OnramperClient for the wiring.
  provideSessionCredentials(token: string, credentials: { sessionId: string; sessionToken: string }): Promise<void>;
  failSessionRefresh(token: string, message: string): Promise<void>;
  // Event subscriptions are accessed via the inherited EventEmitter API; the
  // OnramperClient class wraps these with typed listeners.
  addListener<K extends keyof OnramperEventsMap>(name: K, listener: OnramperEventsMap[K]): EventSubscription;
}

export type OnramperEventsMap = {
  onStateChanged: (state: OnramperState) => void;
  onCheckoutEvent: (event: CheckoutEvent) => void;
  onSessionExpired: (payload: { token: string }) => void;
};

export const OnramperNative = requireNativeModule<OnramperNativeModule>('OnramperReactNative');
export type { EventSubscription };
