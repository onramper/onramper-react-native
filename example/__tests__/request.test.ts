import {
  DEFAULT_BUY_FORM,
  buildCheckoutRequest,
  parseAmount,
  selectCountry,
  selectCrypto,
  type BuyForm,
} from '../checkout/request';

describe('parseAmount', () => {
  it('parseAmount accepts a comma decimal and rejects non-positive or malformed input', () => {
    expect(parseAmount('100')).toBe(100);
    expect(parseAmount(' 100,5 ')).toBe(100.5);
    expect(parseAmount('0.25')).toBe(0.25);
    for (const bad of ['', '0', '0.00', 'abc', '1.', '.5', '-3', '1e3', '1.2.3']) {
      expect(parseAmount(bad)).toBeNull();
    }
  });
});

describe('buildCheckoutRequest', () => {
  it('builds the default SOL / USD / Apple Pay request without country or onramp filter', () => {
    expect(buildCheckoutRequest(DEFAULT_BUY_FORM)).toEqual({
      source: 'usd',
      destination: 'sol',
      amount: 100,
      type: 'buy',
      paymentMethod: 'applepay',
      wallet: { network: 'solana', address: 'Br2jjHYskB1JJikv3Qw2QcmWVQGfZvkJFng4ZEwiGSjv' },
    });
  });

  it('adds country and US subdivision when the override is on', () => {
    const form: BuyForm = { ...DEFAULT_BUY_FORM, countryOverride: true, country: 'us', usState: 'NY' };
    const req = buildCheckoutRequest(form);
    expect(req?.country).toBe('us');
    expect(req?.subdivision).toBe('us-ny');
  });

  it('sends a non-US country without a subdivision', () => {
    const req = buildCheckoutRequest({ ...DEFAULT_BUY_FORM, countryOverride: true, country: 'nl' });
    expect(req?.country).toBe('nl');
    expect(req).not.toHaveProperty('subdivision');
  });

  it('ignores country fields while the override is off', () => {
    const req = buildCheckoutRequest({ ...DEFAULT_BUY_FORM, countryOverride: false, country: 'es' });
    expect(req).not.toHaveProperty('country');
  });

  it('adds onlyOnramps for a specific onramp', () => {
    expect(buildCheckoutRequest({ ...DEFAULT_BUY_FORM, onramp: 'moonpay' })?.onlyOnramps).toEqual(['moonpay']);
  });

  it('returns null for an invalid amount or blank wallet', () => {
    expect(buildCheckoutRequest({ ...DEFAULT_BUY_FORM, amount: '0' })).toBeNull();
    expect(buildCheckoutRequest({ ...DEFAULT_BUY_FORM, wallet: '   ' })).toBeNull();
  });

  it('trims the wallet address', () => {
    expect(buildCheckoutRequest({ ...DEFAULT_BUY_FORM, wallet: '  abc  ' })?.wallet.address).toBe('abc');
  });
});

describe('form transitions', () => {
  it('selectCrypto resets the wallet to that currency default', () => {
    const next = selectCrypto({ ...DEFAULT_BUY_FORM, wallet: 'custom' }, 'eth');
    expect(next.cryptoId).toBe('eth');
    expect(next.wallet).toBe('0x97EF62c275A9A4C2E6199Bd7a4feB6efd207fC86');
  });

  it('selectCountry sets the default fiat for that country', () => {
    expect(selectCountry(DEFAULT_BUY_FORM, 'es').fiat).toBe('eur');
    expect(selectCountry({ ...DEFAULT_BUY_FORM, fiat: 'gbp' }, 'us').fiat).toBe('usd');
  });
});
