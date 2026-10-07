import { DEFAULT_PREFILL, buildPrefill, prefillSummary } from '../checkout/prefill';

describe('buildPrefill', () => {
  it('sends only non-blank fields, trimmed', () => {
    expect(buildPrefill({ ...DEFAULT_PREFILL, firstName: ' Ada ', phoneNumber: '  ' })).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });

  it('sends nothing when disabled', () => {
    expect(buildPrefill({ ...DEFAULT_PREFILL, enabled: false })).toEqual({});
  });

  it('sends email only when "Send email" is on', () => {
    expect(buildPrefill({ ...DEFAULT_PREFILL, email: 'a@b.co' })).not.toHaveProperty('email');
    expect(buildPrefill({ ...DEFAULT_PREFILL, email: 'a@b.co', sendEmail: true }).email).toBe('a@b.co');
  });
});

describe('prefillSummary', () => {
  it('lists field names, never values', () => {
    expect(prefillSummary({ firstName: 'Ada', phoneNumber: '+3712345678' })).toBe('Sends: firstName, phoneNumber');
    expect(prefillSummary({})).toBe('Sends: nothing');
  });
});
