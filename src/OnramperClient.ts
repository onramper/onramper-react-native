import { type ReactElement, createElement } from 'react';

import { CheckoutButton } from './CheckoutButton';
import { createOnramperNative } from './OnramperNative';
import { OnramperError } from './errors';
import type { CheckoutEvent, EventName, EventPayload } from './events';
import type {
  CheckoutButtonStyle,
  CheckoutRequest,
  OnramperConfiguration,
  OnramperLogRecord,
  OnramperState,
  OnramperUserPrefill,
  QuoteResponse,
  SessionCredentials,
} from './types';

export interface GetCheckoutRequirementsResult {
  /** A native checkout button element to render. Tapping it drives login, finalize, and the payment webview internally. */
  button: ReactElement;
  /** The quote (rate, fees, payout) returned with the checkout intent. */
  quote: QuoteResponse;
}

/**
 * Typed, public entry point to the Onramper SDK. Wraps the native Nitro hybrid
 * object: state and checkout events arrive as JSON strings over single native
 * callbacks and are parsed here into the typed `OnramperState` / `CheckoutEvent`
 * unions, then fanned out to any number of listeners.
 */
export class OnramperClient {
  /**
   * Version of the native Onramper iOS SDK loaded by this app (not the RN
   * package version). No client configuration or session is required. iOS only.
   */
  static get sdkVersion(): string {
    const native = createOnramperNative();
    try {
      return native.sdkVersion;
    } finally {
      native.dispose();
    }
  }

  state: OnramperState = { kind: 'idle' };
  lastError: OnramperError | null = null;
  currentTransactionId: string | null = null;

  // Each client owns its own native instance (and thus its own SDK client).
  private readonly native = createOnramperNative();

  private readonly stateListeners = new Set<(state: OnramperState) => void>();
  private readonly eventListeners = new Set<(event: CheckoutEvent) => void>();
  private readonly transactionIdListeners = new Set<(transactionId: string | null) => void>();

  // Resolved when the constructor-issued configure() completes. Public methods
  // that need the native client await this first.
  private readonly configured: Promise<void>;
  private destroyed = false;

  constructor(config: OnramperConfiguration) {
    if (config.logHandler) {
      const handler = config.logHandler;
      this.native.setLogListener((json) => {
        if (this.destroyed) return;
        try {
          handler(JSON.parse(json) as OnramperLogRecord);
        } catch {
          // Diagnostics must never interrupt checkout; do not log callback data.
          console.warn('Onramper logHandler failed.');
        }
      });
    }
    // Single native state callback → update the mirror + fan out to listeners.
    this.native.setStateListener((json) => {
      if (this.destroyed) return;
      const s = JSON.parse(json) as OnramperState;
      this.state = s;
      if (s.kind === 'failed') this.lastError = OnramperError.from(s.error);
      for (const fn of this.stateListeners) fn(s);
    });

    // Single native checkout-event callback → keep the transaction ID mirror
    // synchronized at finalization, then fan out to checkout listeners.
    this.native.setEventListener((json) => {
      if (this.destroyed) return;
      const e = JSON.parse(json) as CheckoutEvent;
      if (e.type === 'checkoutFinalized') {
        this.updateCurrentTransactionId(e.response.onramperTransactionId);
      }
      for (const fn of this.eventListeners) fn(e);
    });

    this.native.setTransactionIdListener((transactionId) => {
      if (this.destroyed) return;
      // The SDK transiently publishes nil while re-preparing after the payment
      // sheet is dismissed. The finalized transaction ID remains durable across
      // that attempt change; only explicit reset()/signOut() clear the JS mirror.
      if (transactionId !== undefined) this.updateCurrentTransactionId(transactionId);
    });

    // The SDK calls this when its session expires; return fresh credentials.
    // Nitro stores the async callback natively and awaits it directly — no
    // event round-trip needed.
    this.native.setSessionExpirationHandler(async () => {
      this.assertActive();
      const creds = await config.onSessionExpired();
      this.assertActive();
      return { sessionId: creds.sessionId, sessionToken: creds.sessionToken };
    });

    this.configured = this.native
      .configure({
        apiKey: config.apiKey,
        clientId: config.clientId,
        environment: config.environment,
        theme: config.theme ?? 'system',
        logLevel: config.logLevel ?? 'off',
        isEventLoggingEnabled: config.isEventLoggingEnabled ?? false,
        isEventConsoleLoggingEnabled: config.isEventConsoleLoggingEnabled ?? false,
      })
      .catch((e: unknown) => {
        const err = OnramperError.from(e);
        if (!this.destroyed) this.lastError = err;
        throw err;
      });
    // Swallow the unhandled-rejection warning when no one awaits .configured
    // before calling initialize(). The error still surfaces via initialize().
    this.configured.catch(() => undefined);
  }

  private assertActive(): void {
    if (this.destroyed) {
      throw new OnramperError({
        code: 'clientDestroyed',
        message: 'This OnramperClient has been destroyed. Create a new client before making SDK calls.',
        userMessage: 'This checkout session has ended. Please reopen checkout.',
      });
    }
  }

  private updateCurrentTransactionId(next: string | null): void {
    if (this.destroyed) return;
    if (next === this.currentTransactionId) return;

    this.currentTransactionId = next;
    for (const fn of [...this.transactionIdListeners]) {
      if (this.destroyed) break;
      try {
        fn(next);
      } catch (error: unknown) {
        console.error('Onramper transaction ID listener threw:', error);
      }
    }
  }

  async initialize(creds: SessionCredentials): Promise<void> {
    try {
      this.assertActive();
      await this.configured;
      this.assertActive();
      await this.native.initialize(creds.sessionId, creds.sessionToken);
      this.assertActive();
    } catch (e: unknown) {
      this.assertActive();
      throw OnramperError.from(e);
    }
  }

  async reset(): Promise<void> {
    try {
      this.assertActive();
      await this.configured;
      this.assertActive();
      await this.native.reset();
      this.assertActive();
      this.updateCurrentTransactionId(null);
    } catch (e: unknown) {
      this.assertActive();
      throw OnramperError.from(e);
    }
  }

  /**
   * Signs the OnramperID user out by clearing stored OIDC tokens. The next
   * checkout that requires user_info will re-trigger the login flow. Also
   * resets in-flight checkout state. Does NOT clear the partner-scoped SDK
   * session — re-calling `initialize` is only needed if that session expired.
   */
  async signOut(): Promise<void> {
    try {
      this.assertActive();
      await this.configured;
      this.assertActive();
      await this.native.signOut();
      this.assertActive();
      this.updateCurrentTransactionId(null);
    } catch (e: unknown) {
      this.assertActive();
      throw OnramperError.from(e);
    }
  }

  /**
   * Fetches checkout requirements + quote and returns a native checkout button
   * to render plus the quote. The button handles login / finalize / webview
   * internally; outcomes surface via the event stream (`addEventListener`).
   * A newer preparation, reset, or sign-out invalidates older unmounted buttons
   * and rejects obsolete in-flight preparations with `intentInvalidated`.
   *
   * Pass `prefill` to pre-populate the OnramperID sign-in and additional-info
   * screens with values you already know about the user. It is best-effort and
   * never blocks sign-in — there is no error to handle. Note the caveat on
   * `OnramperUserPrefill.email` before supplying it.
   *
   * `prefill` trails `buttonStyle` here, unlike the Swift
   * `getCheckoutRequirements(_:prefill:buttonStyle:)` where argument labels make
   * the middle position free: appending it keeps every existing JS call site
   * working unchanged.
   */
  async getCheckoutRequirements(
    request: CheckoutRequest,
    buttonStyle: CheckoutButtonStyle = {},
    prefill: OnramperUserPrefill = {},
  ): Promise<GetCheckoutRequirementsResult> {
    try {
      this.assertActive();
      await this.configured;
      this.assertActive();
      const result = await this.native.getCheckoutRequirements(
        JSON.stringify(request),
        JSON.stringify(prefill),
        JSON.stringify(buttonStyle),
      );
      this.assertActive();
      const quote = JSON.parse(result.quoteJson) as QuoteResponse;
      const button = createElement(CheckoutButton, { intentHandle: result.intentHandle });
      return { button, quote };
    } catch (e: unknown) {
      this.assertActive();
      throw OnramperError.from(e);
    }
  }

  /** Discards a prepared intent (e.g. if the user navigates away before checkout). */
  async cancelPreparedIntent(intentHandle: string): Promise<void> {
    try {
      this.assertActive();
      await this.native.cancelPreparedIntent(intentHandle);
      this.assertActive();
    } catch (e: unknown) {
      this.assertActive();
      throw OnramperError.from(e);
    }
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  addStateListener(fn: (state: OnramperState) => void): () => void {
    this.assertActive();
    this.stateListeners.add(fn);
    return () => {
      this.stateListeners.delete(fn);
    };
  }

  /** Subscribe to the durable Onramper transaction ID. Successful reset/signOut publish null. */
  addTransactionIdListener(fn: (transactionId: string | null) => void): () => void {
    this.assertActive();
    this.transactionIdListeners.add(fn);
    return () => {
      this.transactionIdListeners.delete(fn);
    };
  }

  /** Subscribe to a specific checkout event. Returns an unsubscribe function. */
  addEventListener<K extends EventName>(name: K, fn: (e: EventPayload<K>) => void): () => void {
    this.assertActive();
    const wrapper = (e: CheckoutEvent) => {
      if (e.type === name) fn(e as EventPayload<K>);
    };
    this.eventListeners.add(wrapper);
    return () => {
      this.eventListeners.delete(wrapper);
    };
  }

  /** Idempotent teardown. Further operations reject with `clientDestroyed`; create a new client to restart. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stateListeners.clear();
    this.eventListeners.clear();
    this.transactionIdListeners.clear();
    this.native.dispose();
  }
}
