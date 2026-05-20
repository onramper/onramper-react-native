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
   * v1 limitation: the native bridge currently invokes this callback synchronously
   * (`expo-modules-core`'s `JavaScriptFunction.call()` is sync-throws). Return a
   * `SessionCredentials` object directly. Returning a `Promise` will throw
   * `sessionExpirationHandlerFailed`. To handle async refresh, pre-stage the
   * credentials and have this callback return the closed-over value.
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
  onramp: string;
  source: string;
  destination?: string;
  amount: number;
  type: TransactionType;
  country?: string;
  subdivision?: string;
  paymentMethod: string;
  wallet: WalletInfo;
  onlyOnramps?: string[];
}

// Mirrors Swift QuoteResponse exactly — all fields optional because the BFF
// can return a partial quote with `errors` populated when the onramp can't
// honor the request. Integrators must handle nulls.
export interface QuoteResponse {
  quoteId?: string;
  ramp?: string;
  rate?: number;
  networkFee?: number;
  transactionFee?: number;
  payout?: number;
  paymentMethod?: string;
  recommendations?: string[];
  errors?: QuoteError[];
}

export interface QuoteError {
  type: string;
  message: string;
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

// Checkout requirements surfaced by the BFF and bridged through JSON.
// Shape mirrors Sources/OnramperSDK/Models/CheckoutIntentResponse.swift.
export type CheckoutRequirement =
  | { type: 'tos'; providerId: string; items: ToSItem[] }
  | { type: 'amount_limit'; providerId: string; minAmountLimit?: number; maxAmountLimit?: number }
  | { type: 'user_info'; providerId: string; fields: UserInfoField[] };

export interface ToSItem {
  type: 'tos' | 'privacy_policy' | 'user_agreement';
  required: boolean;
  satisfied: boolean;
  url?: string;
  content?: string;
}

export interface UserInfoField {
  type: string; // backend can extend; safer to leave open
  required: boolean;
  // other fields omitted for v1 — extend later if needed
}

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
