export type CryptoId = 'btc' | 'eth' | 'sol';

export interface CryptoOption {
  id: CryptoId;
  symbol: string;
  name: string;
  network: string;
  color: string;
  defaultWallet: string;
}

export const CRYPTOS: readonly CryptoOption[] = [
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    network: 'bitcoin',
    color: '#F7931A',
    defaultWallet: 'bc1qj5lez36llxlmflw9rh4yqakkap297fz8h6l2kp',
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    network: 'ethereum',
    color: '#8E5CF7',
    defaultWallet: '0x97EF62c275A9A4C2E6199Bd7a4feB6efd207fC86',
  },
  {
    id: 'sol',
    symbol: 'SOL',
    name: 'Solana',
    network: 'solana',
    color: '#32ADE6',
    defaultWallet: 'Br2jjHYskB1JJikv3Qw2QcmWVQGfZvkJFng4ZEwiGSjv',
  },
];

export function findCrypto(id: CryptoId): CryptoOption {
  const crypto = CRYPTOS.find(c => c.id === id);
  if (!crypto) {
    throw new Error(`unknown crypto ${id}`);
  }
  return crypto;
}

export type Fiat = 'usd' | 'eur' | 'gbp';
export const FIATS: readonly Fiat[] = ['usd', 'eur', 'gbp'];

export type PaymentMethodId = 'applepay' | 'revolutpay';
export const PAYMENT_METHODS: readonly {
  id: PaymentMethodId;
  label: string;
}[] = [
  { id: 'applepay', label: 'Apple Pay' },
  { id: 'revolutpay', label: 'Revolut Pay' },
];

/** `value: null` means no `onlyOnramps` filter. */
export interface OnrampOption {
  value: string | null;
  label: string;
}
export const ONRAMPS: readonly OnrampOption[] = [
  { value: null, label: 'Any' },
  { value: 'moonpay', label: 'MoonPay' },
  { value: 'paybis', label: 'Paybis' },
  { value: 'coinbasepay', label: 'Coinbase Pay' },
];

export type CountryId = 'us' | 'es' | 'nl' | 'gr';
export interface CountryOption {
  id: CountryId;
  label: string;
  flag: string;
  defaultFiat: Fiat;
}
export const COUNTRIES: readonly CountryOption[] = [
  { id: 'us', label: 'US', flag: '🇺🇸', defaultFiat: 'usd' },
  { id: 'es', label: 'ES', flag: '🇪🇸', defaultFiat: 'eur' },
  { id: 'nl', label: 'NL', flag: '🇳🇱', defaultFiat: 'eur' },
  { id: 'gr', label: 'GR', flag: '🇬🇷', defaultFiat: 'eur' },
];

export function findCountry(id: CountryId): CountryOption {
  const country = COUNTRIES.find(c => c.id === id);
  if (!country) {
    throw new Error(`unknown country ${id}`);
  }
  return country;
}

/** `code` is the ISO 3166-2:US suffix, upper-case (sent as `us-<code lower>`). */
export interface UsState {
  code: string;
  name: string;
}

// 50 states + DC, sorted by name. Hard-coded on purpose (same as the iOS demo).
export const US_STATES: readonly UsState[] = (
  [
    ['AL', 'Alabama'],
    ['AK', 'Alaska'],
    ['AZ', 'Arizona'],
    ['AR', 'Arkansas'],
    ['CA', 'California'],
    ['CO', 'Colorado'],
    ['CT', 'Connecticut'],
    ['DE', 'Delaware'],
    ['DC', 'District of Columbia'],
    ['FL', 'Florida'],
    ['GA', 'Georgia'],
    ['HI', 'Hawaii'],
    ['ID', 'Idaho'],
    ['IL', 'Illinois'],
    ['IN', 'Indiana'],
    ['IA', 'Iowa'],
    ['KS', 'Kansas'],
    ['KY', 'Kentucky'],
    ['LA', 'Louisiana'],
    ['ME', 'Maine'],
    ['MD', 'Maryland'],
    ['MA', 'Massachusetts'],
    ['MI', 'Michigan'],
    ['MN', 'Minnesota'],
    ['MS', 'Mississippi'],
    ['MO', 'Missouri'],
    ['MT', 'Montana'],
    ['NE', 'Nebraska'],
    ['NV', 'Nevada'],
    ['NH', 'New Hampshire'],
    ['NJ', 'New Jersey'],
    ['NM', 'New Mexico'],
    ['NY', 'New York'],
    ['NC', 'North Carolina'],
    ['ND', 'North Dakota'],
    ['OH', 'Ohio'],
    ['OK', 'Oklahoma'],
    ['OR', 'Oregon'],
    ['PA', 'Pennsylvania'],
    ['RI', 'Rhode Island'],
    ['SC', 'South Carolina'],
    ['SD', 'South Dakota'],
    ['TN', 'Tennessee'],
    ['TX', 'Texas'],
    ['UT', 'Utah'],
    ['VT', 'Vermont'],
    ['VA', 'Virginia'],
    ['WA', 'Washington'],
    ['WV', 'West Virginia'],
    ['WI', 'Wisconsin'],
    ['WY', 'Wyoming'],
  ] as const
).map(([code, name]) => ({ code, name }));
