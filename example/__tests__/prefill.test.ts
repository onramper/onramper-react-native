import { DEFAULT_PREFILL, buildPrefill, prefillSummary } from '../checkout/prefill';

const ENABLED = { ...DEFAULT_PREFILL, enabled: true };

describe('buildPrefill', () => {
  it('is off by default', () => {
    expect(buildPrefill(DEFAULT_PREFILL)).toEqual({});
  });

  it('sends only non-blank fields, trimmed', () => {
    expect(buildPrefill({ ...ENABLED, firstName: ' Ada ', phoneNumber: '  ' })).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });

  it('sends nothing when disabled', () => {
    expect(buildPrefill({ ...DEFAULT_PREFILL, enabled: false })).toEqual({});
  });

  it('sends email only when "Send email" is on', () => {
    expect(buildPrefill({ ...ENABLED, email: 'a@b.co' })).not.toHaveProperty('email');
    expect(buildPrefill({ ...ENABLED, email: 'a@b.co', sendEmail: true }).email).toBe('a@b.co');
  });
});

describe('prefillSummary', () => {
  it('lists field names, never values', () => {
    expect(prefillSummary({ firstName: 'Ada', phoneNumber: '+3712345678' })).toBe('Sends: firstName, phoneNumber');
    expect(prefillSummary({})).toBe('Sends: nothing');
  });
});
