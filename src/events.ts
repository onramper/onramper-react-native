import type { OnramperErrorPayload } from './errors';
import type { CheckoutRequirement, OnramperState, RenderType } from './types';

export type CheckoutEvent =
  | { type: 'stateChanged'; state: OnramperState }
  | { type: 'checkoutStarted'; intentId: string }
  | { type: 'loginRequired'; requirements: CheckoutRequirement[] }
  | { type: 'readyToCheckout' }
  | { type: 'requirementSatisfied'; requirementType: string }
  // `response` mirrors Swift `CheckoutFinalizeResponse` (Codable). Left as
  // `unknown` to avoid over-specifying a large struct in v1.
  | { type: 'checkoutFinalized'; response: unknown }
  | { type: 'renderingStarted'; url: string; renderType: RenderType }
  | { type: 'completed'; checkoutId: string }
  | { type: 'failed'; error: OnramperErrorPayload };

export type EventName = CheckoutEvent['type'];
export type EventPayload<K extends EventName> = Extract<CheckoutEvent, { type: K }>;
