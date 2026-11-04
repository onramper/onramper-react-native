// scripts/verify-version.js helpers: the onramper-ios tag → commit pin and
// the product check.
const { tagCommit, missingProducts } = require('../scripts/verify-version.js');

describe('verify-version', () => {
  it('reads a lightweight tag', () => {
    expect(tagCommit('aaa\trefs/tags/v1.6.0\n', 'v1.6.0')).toBe('aaa');
  });

  it('prefers the peeled commit of an annotated tag', () => {
    expect(tagCommit('tagobj\trefs/tags/v1.6.0\ncommit\trefs/tags/v1.6.0^{}\n', 'v1.6.0')).toBe('commit');
  });

  it('returns undefined when the tag is missing', () => {
    expect(tagCommit('', 'v1.6.0')).toBeUndefined();
  });

  it('requires both products', () => {
    const both = '.library(name: "OnramperSDK", targets: ["OnramperSDK"]),\n.library(name: "OnramperStripe", targets: ["OnramperStripe"]),';
    expect(missingProducts(both)).toEqual([]);
    expect(missingProducts('.library(name: "OnramperSDK", targets: ["OnramperSDK", "OnramperStripe"]),')).toEqual([
      'OnramperStripe',
    ]);
  });
});
