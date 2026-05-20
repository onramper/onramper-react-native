// Mirrors Swift Codable structs in OnramperSDK. Source of truth is the Swift SDK
// at the bundled version. Do not add fields that don't exist there.

import type { OnramperErrorPayload } from './errors';

export type OnramperEnvironment = 'production' | 'staging';
export type OnramperLogLevel = 'silent' | 'info' | 'debug';

export type TransactionType = 'buy' | 'sell';

export interface SessionCredentials {
  sessionId: string;
  sessionToken: string;
}

export interface OnramperConfiguration {
  apiKey: string;
  clientId: string;
  environment: OnramperEnvironment;
  logLevel?: OnramperLogLevel;
  onSessionExpired: () => Promise<SessionCredentials>;
}

export interface CheckoutRequest {
  transactionType: TransactionType;
  sourceCurrency: string;
  destinationCurrency: string;
  amount: number;
  walletAddress: string;
  country?: string;
  paymentMethod?: string;
  partnerCustomerId?: string;
  partnerContext?: string;
}

export interface QuoteResponse {
  rate: number;
  fees: { network?: number; partner?: number; total: number };
  payout: number;
  expiresAt: string; // ISO 8601
  recommendations?: Recommendation[];
}

export interface Recommendation {
  paymentMethod: string;
  reason: string;
}

export interface AmountLimit {
  min: number;
  max: number;
}

export interface CheckoutButtonStyle {
  backgroundColor?: string; // hex #RRGGBB or #RRGGBBAA
  foregroundColor?: string;
  borderRadius?: number;
}

export type RenderType = 'webview' | 'iframe';
export type CheckoutPaymentType = 'card' | 'applePay' | 'bankTransfer' | 'other';

export type OnramperState =
  | { kind: 'idle' }
  | { kind: 'initializing' }
  | { kind: 'ready' }
  | { kind: 'checkoutPreparing' }
  | { kind: 'requireLogin' }
  | { kind: 'authenticating' }
  | { kind: 'readyToCheckout' }
  | { kind: 'finalizing' }
  | { kind: 'rendering'; url: string; renderType: RenderType; paymentType: CheckoutPaymentType }
  | { kind: 'completed' }
  | { kind: 'failed'; error: OnramperErrorPayload };

export type { OnramperErrorPayload };
