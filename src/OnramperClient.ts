import React from 'react';

import { OnramperCheckoutButtonView } from './OnramperCheckoutButtonView';
import { OnramperEmitter, OnramperNative } from './OnramperNative';
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

  private stateSub: { remove: () => void } | null = null;

  constructor(private readonly config: OnramperConfiguration) {
    this.stateSub = OnramperEmitter.addListener('onStateChanged', (s: OnramperState) => {
      this.state = s;
      if (s.kind === 'failed') this.lastError = OnramperError.from(s.error);
    });

    // Native expects a synchronous callback (JavaScriptFunction.call() is sync-throws
    // in expo-modules-core). We adapt to that contract by requiring
    // `onSessionExpired` to be sync-resolvable. If the integrator returned a
    // Promise we throw — they need to pre-stage credentials.
    void OnramperNative.configure(
      {
        apiKey: config.apiKey,
        clientId: config.clientId,
        environment: config.environment,
        theme: config.theme ?? 'system',
        logLevel: config.logLevel ?? 'off',
      },
      (): SessionCredentials => {
        const result = config.onSessionExpired();
        if (result && typeof (result as Promise<SessionCredentials>).then === 'function') {
          throw new OnramperError({
            code: 'sessionExpirationHandlerFailed',
            message:
              'onSessionExpired returned a Promise but the native bridge requires a synchronous result. ' +
              'Pre-stage credentials and return them synchronously, or implement a separate setSessionCredentials flow.',
          });
        }
        return result as SessionCredentials;
      },
    ).catch((e: unknown) => {
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
    const sub = OnramperEmitter.addListener('onStateChanged', fn);
    return () => sub.remove();
  }

  addEventListener<K extends EventName>(name: K, fn: (e: EventPayload<K>) => void): () => void {
    const sub = OnramperEmitter.addListener('onCheckoutEvent', (e: CheckoutEvent) => {
      if (e.type === name) fn(e as EventPayload<K>);
    });
    return () => sub.remove();
  }

  destroy(): void {
    this.stateSub?.remove();
    this.stateSub = null;
  }
}
