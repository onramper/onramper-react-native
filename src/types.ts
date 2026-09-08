// Mirrors Swift Codable structs in OnramperSDK. Source of truth is the Swift SDK
// at the bundled version. Do not add fields that don't exist there.

import type { OnramperErrorPayload } from './errors';

export type OnramperEnvironment = 'development' | 'production';
export type OnramperLogLevel = 'off' | 'error' | 'info' | 'debug';
export type OnramperTheme = 'system' | 'light' | 'dark';

export type TransactionType = 'buy' | 'sell';

export interface SessionCredentials {
  sessionId: string;
  sessionToken: string;
}

export interface OnramperConfiguration {
  apiKey: string;
  clientId: string;
  environment: OnramperEnvironment;
  theme?: OnramperTheme;
  logLevel?: OnramperLogLevel;
  /**
   * Called by the SDK when the session token expires and needs to be re-issued.
   *
   * May be synchronous or async — under the hood the bridge uses an event
   * round-trip (`onSessionExpired` → `provideSessionCredentials`) so Promises
   * are awaited normally. Throw or reject to signal that no fresh credentials
   * are available; the SDK will surface `userTokenRefreshFailed`.
   */
  onSessionExpired: () => SessionCredentials | Promise<SessionCredentials>;
}

export interface WalletInfo {
  network: string;
  address: string;
  memo?: string;
}

// Flattened from the Swift nesting (CheckoutIntentRequest → OnramperTransactionData).
// The bridge re-nests before handing to the SDK. ISO codes (`source`, `destination`,
// `country`, `subdivision`) are lowercased by the SDK; pass either case.
export interface CheckoutRequest {
  source: string;
  destination: string;
  amount: number;
  type: TransactionType;
  country?: string;
  subdivision?: string;
  paymentMethod: string;
  wallet: WalletInfo;
  onlyOnramps?: string[];
}

// Mirrors Swift `QuoteResponse`. The Onramper backend only returns a
// *successful* quote: a request that can't be priced fails with an
// `OnramperError` (e.g. `quoteUnavailable`) rather than a partial quote. So the
// core pricing fields are always present — integrators don't null-check them.
// `networkFee` and `transactionFee` are present too; `recommendations` is
// optional metadata.
export interface QuoteResponse {
  quoteId: string;
  ramp: string;
  rate: number;
  payout: number;
  paymentMethod: string;
  networkFee: number;
  transactionFee: number;
  recommendations?: string[];
}

// Mirrors Swift `OnramperUserPrefill`. Values you already know about the user,
// used to pre-populate the OnramperID sign-in and additional-info screens.
// Every field is optional — supply only what you know.
//
// Prefill is **best-effort and never blocks sign-in**: if it can't be applied,
// the login flow opens without it. Nothing surfaces to your app, and there is
// no error to handle.
//
// `email` is the *binding identity*, not merely another prefilled value. When
// it matches the account that signs in, the remaining values may be applied
// automatically; when it does not match, the whole prefill is dropped — which
// is strictly worse than omitting `email`, where the values are still offered
// to the user for confirmation. Supply it only when you're confident it's the
// address the user will sign in with.
//
// Prefill is enabled per integration — talk to your Onramper representative
// before relying on it.
export interface OnramperUserPrefill {
  email?: string;
  firstName?: string;
  lastName?: string;
  /** E.164 format, e.g. `+3712345678`. Always a candidate — the user still verifies it. */
  phoneNumber?: string;
}

export interface CheckoutButtonStyle {
  backgroundColor?: string; // hex #RRGGBB or #RRGGBBAA
  foregroundColor?: string;
  borderRadius?: number;
}

// Mirrors Swift `RenderType` raw values from Models/SharedTypes.swift.
export type RenderType = 'webview' | 'deeplink';
// Mirrors Swift `CheckoutPaymentType` raw values from Models/SharedTypes.swift.
export type CheckoutPaymentType = 'applepay' | 'revolutpay';

// Mirrors Swift `CheckoutFinalizeResponse` / `HeadlessCheckoutData`
// (Sources/OnramperSDK/Models/CheckoutFinalizeResponse.swift).
export interface HeadlessCheckoutData {
  checkoutPaymentType: CheckoutPaymentType;
  url: string;
  renderType: RenderType;
}

export interface CheckoutFinalizeResponse {
  headlessCheckoutId: string;
  /** Durable Onramper transaction identifier for support, reconciliation, and status lookups. */
  onramperTransactionId: string;
  headlessCheckoutData: HeadlessCheckoutData;
}

// Checkout requirements surfaced by the Onramper backend and bridged through JSON.
// Shape mirrors Sources/OnramperSDK/Models/CheckoutIntentResponse.swift. The
// native bridge flattens each requirement to `{ type, ...fields }` (the Swift
// wire shape is `{ type, requirement: {...} }`).
export type CheckoutRequirement =
  | { type: 'tos'; providerId: string; items: ToSItem[] }
  | {
      type: 'amount_limit';
      providerId: string;
      minAmountLimit?: number;
      maxAmountLimit?: number;
      amountLimitSatisfied: boolean;
    }
  | { type: 'user_info'; providerId: string; fields: UserInfoField[] }
  | {
      type: 'reverification';
      providerId: string;
      field: ReverificationField;
      requiredRecencyDays: number;
      lastVerifiedAt?: string;
    };

export interface ToSItem {
  type: 'tos' | 'privacy_policy' | 'user_agreement';
  required: boolean;
  satisfied: boolean;
  url?: string;
  content?: string;
}

// Mirrors Swift `UserInfoFieldType` raw values.
export type UserInfoFieldType =
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'email_verification'
  | 'phone_number'
  | 'phone_verification'
  | 'ssn_last_four'
  | 'address';

export interface UserInfoField {
  type: UserInfoFieldType;
  required: boolean;
  satisfied: boolean;
}

// Mirrors Swift `ReverificationField`. The SDK only drives a client flow for
// `phone` today; `email` is decoded but has no re-verify UI.
export type ReverificationField = 'email' | 'phone';

export type OnramperState =
  | { kind: 'idle' }
  | { kind: 'initializing' }
  | { kind: 'ready' }
  | { kind: 'checkoutPreparing' }
  | { kind: 'requireLogin'; requirements: CheckoutRequirement[] }
  | { kind: 'authenticating' }
  | { kind: 'readyToCheckout' }
  | { kind: 'finalizing' }
  | { kind: 'rendering'; url: string; renderType: RenderType; paymentType: CheckoutPaymentType }
  | { kind: 'completed' }
  | { kind: 'failed'; error: OnramperErrorPayload };

export type { OnramperErrorPayload };
