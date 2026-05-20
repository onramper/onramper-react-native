import { OnramperError } from '../src/errors';

describe('OnramperError', () => {
  it('wraps a native error payload', () => {
    const err = OnramperError.from({ code: 'deviceBlocked', message: 'blocked' });
    expect(err.code).toBe('deviceBlocked');
    expect(err.message).toBe('blocked');
    expect(err).toBeInstanceOf(Error);
  });

  it('falls back to unrecoverable on unknown input', () => {
    const err = OnramperError.from('some string');
    expect(err.code).toBe('unrecoverable');
    expect(err.message).toBe('some string');
  });

  it('passes through info field', () => {
    const err = OnramperError.from({ code: 'amountOutOfRange', message: 'oor', info: { min: 5, max: 50 } });
    expect(err.info).toEqual({ min: 5, max: 50 });
  });
});
