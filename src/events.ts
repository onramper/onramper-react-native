import type { OnramperErrorPayload } from './errors';
import type { RenderType } from './types';

export type CheckoutEvent =
  | { type: 'checkoutStarted'; intentId: string }
  | { type: 'loginRequired' }
  | { type: 'readyToCheckout' }
  | { type: 'requirementSatisfied'; requirementType: string }
  | { type: 'checkoutFinalized' }
  | { type: 'renderingStarted'; url: string; renderType: RenderType }
  | { type: 'completed'; checkoutId: string }
  | { type: 'failed'; error: OnramperErrorPayload }
  | { type: 'cancelled' };

export type EventName = CheckoutEvent['type'];
export type EventPayload<K extends EventName> = Extract<CheckoutEvent, { type: K }>;
