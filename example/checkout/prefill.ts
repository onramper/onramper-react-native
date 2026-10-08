import type { OnramperUserPrefill } from '@onramper/onramper-react-native';

export interface PrefillForm {
  enabled: boolean;
  firstName: string;
  lastName: string;
  /** E.164, e.g. +3712345678. */
  phoneNumber: string;
  /**
   * `email` is the binding identity: if it doesn't match the account that signs
   * in, the server drops the whole prefill — worse than omitting it. Off by default.
   */
  sendEmail: boolean;
  email: string;
}

export const DEFAULT_PREFILL: PrefillForm = {
  enabled: false,
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneNumber: '',
  sendEmail: false,
  email: '',
};

/** Only fields the user filled in are sent — an omitted field is not the same as an empty one. */
export function buildPrefill(form: PrefillForm): OnramperUserPrefill {
  if (!form.enabled) {
    return {};
  }
  const prefill: OnramperUserPrefill = {};
  const put = (key: keyof OnramperUserPrefill, value: string) => {
    const trimmed = value.trim();
    if (trimmed !== '') {
      prefill[key] = trimmed;
    }
  };
  put('firstName', form.firstName);
  put('lastName', form.lastName);
  put('phoneNumber', form.phoneNumber);
  if (form.sendEmail) {
    put('email', form.email);
  }
  return prefill;
}

/** Field names only — prefill values are user PII and are never logged. */
export function prefillSummary(prefill: OnramperUserPrefill): string {
  const keys = Object.keys(prefill);
  return keys.length > 0 ? `Sends: ${keys.join(', ')}` : 'Sends: nothing';
}
