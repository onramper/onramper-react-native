import type { CheckoutRequest } from '@onramper/onramper-react-native';
import {
  findCountry,
  findCrypto,
  type CountryId,
  type CryptoId,
  type Fiat,
  type PaymentMethodId,
} from '../config/catalog';

/** Everything the Buy Crypto form edits. Text fields hold what the user typed. */
export interface BuyForm {
  cryptoId: CryptoId;
  wallet: string;
  amount: string;
  fiat: Fiat;
  paymentMethod: PaymentMethodId;
  /** `null` = any onramp (no `onlyOnramps`). */
  onramp: string | null;
  countryOverride: boolean;
  country: CountryId;
  /** US state code, e.g. `CA`. Only sent when the override is on and country is US. */
  usState: string;
}

export const DEFAULT_BUY_FORM: BuyForm = {
  cryptoId: 'sol',
  wallet: findCrypto('sol').defaultWallet,
  amount: '100',
  fiat: 'usd',
  paymentMethod: 'applepay',
  onramp: null,
  countryOverride: false,
  country: 'us',
  usState: 'CA',
};

const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

/** Parses typed amount text (`,` or `.` decimal). Returns null unless it's a plain number > 0. */
export function parseAmount(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!AMOUNT_PATTERN.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return value > 0 ? value : null;
}

/** Maps the form to an SDK request, or null when the form can't be priced yet. */
export function buildCheckoutRequest(form: BuyForm): CheckoutRequest | null {
  const amount = parseAmount(form.amount);
  const address = form.wallet.trim();
  if (amount === null || address === '') {
    return null;
  }
  const crypto = findCrypto(form.cryptoId);
  const request: CheckoutRequest = {
    source: form.fiat,
    destination: crypto.id,
    amount,
    type: 'buy',
    paymentMethod: form.paymentMethod,
    wallet: { network: crypto.network, address },
  };
  if (form.countryOverride) {
    request.country = form.country;
    if (form.country === 'us') {
      request.subdivision = `us-${form.usState.toLowerCase()}`;
    }
  }
  if (form.onramp) {
    request.onlyOnramps = [form.onramp];
  }
  return request;
}

export function selectCrypto(form: BuyForm, cryptoId: CryptoId): BuyForm {
  return { ...form, cryptoId, wallet: findCrypto(cryptoId).defaultWallet };
}

export function selectCountry(form: BuyForm, country: CountryId): BuyForm {
  return { ...form, country, fiat: findCountry(country).defaultFiat };
}
