import { describeError, formatAmount } from '../utils/format';

describe('formatAmount', () => {
  it('uses 2 decimals at or above 1, 6 below, and "0" for zero', () => {
    expect(formatAmount(1234.567)).toBe('1234.57');
    expect(formatAmount(0.00012345)).toBe('0.000123');
    expect(formatAmount(0)).toBe('0');
  });
});

describe('describeError', () => {
  it('reads code and message from OnramperError-like objects', () => {
    expect(describeError({ code: 'quoteUnavailable', message: 'no quote' })).toEqual({
      code: 'quoteUnavailable',
      message: 'no quote',
    });
  });

  it('falls back to unknown for plain errors and non-objects', () => {
    expect(describeError(new Error('boom'))).toEqual({ code: 'unknown', message: 'boom' });
    expect(describeError('oops')).toEqual({ code: 'unknown', message: 'oops' });
  });
});
