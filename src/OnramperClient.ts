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

  // Every listener attached to the global OnramperNative emitter — both the
  // two internal ones (state mirror + session refresh) and any added by the
  // host app via addStateListener / addEventListener. destroy() removes them
  // all so re-constructing the client doesn't leave stale handlers firing.
  private subs: EventSubscription[] = [];

  // Resolved when the constructor-issued configure() round-trip completes.
  // All public methods that need the native client (initialize / reset /
  // getCheckoutRequirements) must await this first — otherwise the native
  // side throws `notInitialized` because configure() hasn't yet set the
  // client field.
  private readonly configured: Promise<void>;

  constructor(private readonly config: OnramperConfiguration) {
    this.subs.push(
      OnramperNative.addListener('onStateChanged', (s: OnramperState) => {
        this.state = s;
        if (s.kind === 'failed') this.lastError = OnramperError.from(s.error);
      }),
    );

    // Native asks for fresh credentials by emitting `onSessionExpired` with a
    // token; we resolve it via `provideSessionCredentials` (or reject with
    // `failSessionRefresh`). This is an event-based round-trip, not a JS
    // callback — necessary because expo-modules-core ≥ SDK 56's
    // `JavaScriptFunction` is `~Copyable` and cannot be stored on the native
    // side. Async callbacks Just Work here.
    this.subs.push(
      OnramperNative.addListener('onSessionExpired', async ({ token }) => {
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
      }),
    );

    this.configured = OnramperNative.configure({
      apiKey: config.apiKey,
      clientId: config.clientId,
      environment: config.environment,
      theme: config.theme ?? 'system',
      logLevel: config.logLevel ?? 'off',
    }).catch((e: unknown) => {
      const err = OnramperError.from(e);
      this.lastError = err;
      throw err;
    });
    // Swallow the unhandled-rejection warning when no one awaits .configured
    // before calling initialize(). The error still surfaces via initialize().
    this.configured.catch(() => undefined);
  }

  async initialize(creds: SessionCredentials): Promise<void> {
    try {
      await this.configured;
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
      await this.configured;
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
      await this.configured;
      await OnramperNative.reset();
    } catch (e: unknown) {
      throw OnramperError.from(e);
    }
  }

  /**
   * Signs the OnramperID user out by clearing stored OIDC tokens. The next
   * checkout that requires user_info will trigger the OnramperID login sheet
   * again. Also resets any in-flight checkout state.
   *
   * Does NOT clear the partner-scoped SDK session — re-calling `initialize`
   * is only required if that session itself has expired.
   */
  async signOut(): Promise<void> {
    try {
      await this.configured;
      await OnramperNative.signOut();
    } catch (e: unknown) {
      throw OnramperError.from(e);
    }
  }

  addStateListener(fn: (state: OnramperState) => void): () => void {
    return this.track(OnramperNative.addListener('onStateChanged', fn));
  }

  addEventListener<K extends EventName>(name: K, fn: (e: EventPayload<K>) => void): () => void {
    return this.track(
      OnramperNative.addListener('onCheckoutEvent', (e: CheckoutEvent) => {
        if (e.type === name) fn(e as EventPayload<K>);
      }),
    );
  }

  destroy(): void {
    for (const sub of this.subs) sub.remove();
    this.subs = [];
  }

  /** Add `sub` to the per-client registry and return an unsubscribe that
   *  also removes it from the registry — so caller-side cleanup and
   *  destroy()-driven cleanup don't double-fire. */
  private track(sub: EventSubscription): () => void {
    this.subs.push(sub);
    return () => {
      sub.remove();
      this.subs = this.subs.filter((s) => s !== sub);
    };
  }
}
