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


test('uses safe fallback copy for JS or malformed native errors', () => {
  const raw = new Error('ONRAMPER_ERROR:not JSON');
  const error = OnramperError.from(raw);
  expect(error.code).toBe('unrecoverable');
  expect(error.userMessage).toBe('Something went wrong. Please try again.');
  expect(error.supportCode).toBe('unrecoverable');
});

test('round-trips structured error metadata without altering the message', () => {
  const payload = { code: 'amountOutOfRange', message: 'diagnostic', userMessage: 'Choose an amount between 5 and 50.', supportCode: 'amountOutOfRange', info: { min: 5, max: 50 } };
  const error = OnramperError.from(new Error('ONRAMPER_ERROR:' + JSON.stringify(payload)));
  expect(error).toMatchObject(payload);
  expect(OnramperError.from(error)).toBe(error);
});
