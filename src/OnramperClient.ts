import React from 'react';

import { OnramperCheckoutButtonView } from './OnramperCheckoutButtonView';
import { type EventSubscription, OnramperNative } from './OnramperNative';
import { OnramperError } from './errors';
import type { CheckoutEvent, EventName, EventPayload } from './events';
import type {
  CheckoutButtonStyle,
  CheckoutRequest,
  OnramperConfiguration,
  OnramperState,
  QuoteResponse,
  SessionCredentials,
} from './types';

export interface GetCheckoutRequirementsResult {
  button: React.ReactElement;
  quote: QuoteResponse;
}

export class OnramperClient {
  state: OnramperState = { kind: 'idle' };
  lastError: OnramperError | null = null;

  private stateSub: EventSubscription | null = null;
  private sessionExpiredSub: EventSubscription | null = null;

  constructor(private readonly config: OnramperConfiguration) {
    this.stateSub = OnramperNative.addListener('onStateChanged', (s: OnramperState) => {
      this.state = s;
      if (s.kind === 'failed') this.lastError = OnramperError.from(s.error);
    });

    // Native asks for fresh credentials by emitting `onSessionExpired` with a
    // token; we resolve it via `provideSessionCredentials` (or reject with
    // `failSessionRefresh`). This is an event-based round-trip, not a JS
    // callback — necessary because expo-modules-core ≥ SDK 56's
    // `JavaScriptFunction` is `~Copyable` and cannot be stored on the native
    // side. Async callbacks Just Work here.
    this.sessionExpiredSub = OnramperNative.addListener('onSessionExpired', async ({ token }) => {
      try {
        const creds = await config.onSessionExpired();
        await OnramperNative.provideSessionCredentials(token, {
          sessionId: creds.sessionId,
          sessionToken: creds.sessionToken,
        });
      } catch (e: unknown) {
        const err = OnramperError.from(e);
        await OnramperNative.failSessionRefresh(token, err.message).catch(() => undefined);
      }
    });

    void OnramperNative.configure({
      apiKey: config.apiKey,
      clientId: config.clientId,
      environment: config.environment,
      theme: config.theme ?? 'system',
      logLevel: config.logLevel ?? 'off',
    }).catch((e: unknown) => {
      this.lastError = OnramperError.from(e);
      // Throwing here would be unhandled; we surface via lastError + state.
    });
  }

  async initialize(creds: SessionCredentials): Promise<void> {
    try {
      await OnramperNative.initialize(creds.sessionId, creds.sessionToken);
    } catch (e: unknown) {
      throw OnramperError.from(e);
    }
  }

  async getCheckoutRequirements(
    request: CheckoutRequest,
    buttonStyle: CheckoutButtonStyle = {},
  ): Promise<GetCheckoutRequirementsResult> {
    try {
      const result = await OnramperNative.getCheckoutRequirements(
        request as unknown as Record<string, unknown>,
        buttonStyle as unknown as Record<string, unknown>,
      );
      const button = React.createElement(OnramperCheckoutButtonView, {
        intentHandle: result.intentHandle,
        style: { width: '100%', minHeight: 56 },
      });
      return {
        button,
        quote: result.quote as unknown as QuoteResponse,
      };
    } catch (e: unknown) {
      throw OnramperError.from(e);
    }
  }

  cancelPreparedIntent(intentHandle: string): Promise<void> {
    return OnramperNative.cancelPreparedIntent(intentHandle);
  }

  async reset(): Promise<void> {
    try {
      await OnramperNative.reset();
    } catch (e: unknown) {
      throw OnramperError.from(e);
    }
  }

  addStateListener(fn: (state: OnramperState) => void): () => void {
    const sub = OnramperNative.addListener('onStateChanged', fn);
    return () => sub.remove();
  }

  addEventListener<K extends EventName>(name: K, fn: (e: EventPayload<K>) => void): () => void {
    const sub = OnramperNative.addListener('onCheckoutEvent', (e: CheckoutEvent) => {
      if (e.type === name) fn(e as EventPayload<K>);
    });
    return () => sub.remove();
  }

  destroy(): void {
    this.stateSub?.remove();
    this.stateSub = null;
    this.sessionExpiredSub?.remove();
    this.sessionExpiredSub = null;
  }
}
