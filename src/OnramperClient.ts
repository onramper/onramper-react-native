import { type ReactElement, createElement } from 'react';

import { OnramperCheckoutButtonView } from './OnramperCheckoutButtonView';
import { createOnramperNative } from './OnramperNative';
import { OnramperError } from './errors';
import type { CheckoutEvent, EventName, EventPayload } from './events';
import type {
  CheckoutButtonStyle,
  CheckoutRequest,
  OnramperConfiguration,
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

  constructor(config: OnramperConfiguration) {
    // Single native state callback → update the mirror + fan out to listeners.
    this.native.setStateListener((json) => {
      const s = JSON.parse(json) as OnramperState;
      this.state = s;
      if (s.kind === 'failed') this.lastError = OnramperError.from(s.error);
      for (const fn of this.stateListeners) fn(s);
    });

    // Single native checkout-event callback → keep the transaction ID mirror
    // synchronized at finalization, then fan out to checkout listeners.
    this.native.setEventListener((json) => {
      const e = JSON.parse(json) as CheckoutEvent;
      if (e.type === 'checkoutFinalized') {
        this.updateCurrentTransactionId(e.response.onramperTransactionId);
      }
      for (const fn of this.eventListeners) fn(e);
    });

    this.native.setTransactionIdListener((transactionId) => {
      this.updateCurrentTransactionId(transactionId);
    });

    // The SDK calls this when its session expires; return fresh credentials.
    // Nitro stores the async callback natively and awaits it directly — no
    // event round-trip needed.
    this.native.setSessionExpirationHandler(async () => {
      const creds = await config.onSessionExpired();
      return { sessionId: creds.sessionId, sessionToken: creds.sessionToken };
    });

    this.configured = this.native
      .configure({
        apiKey: config.apiKey,
        clientId: config.clientId,
        environment: config.environment,
        theme: config.theme ?? 'system',
        logLevel: config.logLevel ?? 'off',
      })
      .catch((e: unknown) => {
        const err = OnramperError.from(e);
        this.lastError = err;
        throw err;
      });
    // Swallow the unhandled-rejection warning when no one awaits .configured
    // before calling initialize(). The error still surfaces via initialize().
    this.configured.catch(() => undefined);
  }

  private updateCurrentTransactionId(transactionId: string | null | undefined): void {
    const next = transactionId ?? null;
    if (next === this.currentTransactionId) return;

    this.currentTransactionId = next;
    for (const fn of this.transactionIdListeners) fn(next);
  }

  async initialize(creds: SessionCredentials): Promise<void> {
    try {
      await this.configured;
      await this.native.initialize(creds.sessionId, creds.sessionToken);
    } catch (e: unknown) {
      throw OnramperError.from(e);
    }
  }

  async reset(): Promise<void> {
    try {
      await this.configured;
      await this.native.reset();
      this.updateCurrentTransactionId(null);
    } catch (e: unknown) {
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
      await this.configured;
      await this.native.signOut();
      this.updateCurrentTransactionId(null);
    } catch (e: unknown) {
      throw OnramperError.from(e);
    }
  }

  /**
   * Fetches checkout requirements + quote and returns a native checkout button
   * to render plus the quote. The button handles login / finalize / webview
   * internally; outcomes surface via the event stream (`addEventListener`).
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
      await this.configured;
      const result = await this.native.getCheckoutRequirements(
        JSON.stringify(request),
        JSON.stringify(prefill),
        JSON.stringify(buttonStyle),
      );
      const quote = JSON.parse(result.quoteJson) as QuoteResponse;
      const button = createElement(OnramperCheckoutButtonView, {
        intentHandle: result.intentHandle,
        style: { width: '100%', minHeight: 56 },
      });
      return { button, quote };
    } catch (e: unknown) {
      throw OnramperError.from(e);
    }
  }

  /** Discards a prepared intent (e.g. if the user navigates away before checkout). */
  cancelPreparedIntent(intentHandle: string): Promise<void> {
    return this.native.cancelPreparedIntent(intentHandle);
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  addStateListener(fn: (state: OnramperState) => void): () => void {
    this.stateListeners.add(fn);
    return () => {
      this.stateListeners.delete(fn);
    };
  }

  /** Subscribe to the durable Onramper transaction ID. Successful reset/signOut publish null. */
  addTransactionIdListener(fn: (transactionId: string | null) => void): () => void {
    this.transactionIdListeners.add(fn);
    return () => {
      this.transactionIdListeners.delete(fn);
    };
  }

  /** Subscribe to a specific checkout event. Returns an unsubscribe function. */
  addEventListener<K extends EventName>(name: K, fn: (e: EventPayload<K>) => void): () => void {
    const wrapper = (e: CheckoutEvent) => {
      if (e.type === name) fn(e as EventPayload<K>);
    };
    this.eventListeners.add(wrapper);
    return () => {
      this.eventListeners.delete(wrapper);
    };
  }

  /** Tear down: clears JS listeners and releases the native callbacks + SDK client. */
  destroy(): void {
    this.stateListeners.clear();
    this.eventListeners.clear();
    this.transactionIdListeners.clear();
    this.native.dispose();
  }
}
