// The Expo config plugin's Podfile edit for the `providers` option.
const plugin = require('../app.plugin.js');

const podfile = [
  "require File.join(File.dirname(`node --print \"require.resolve('expo/package.json')\"`), \"scripts/autolinking\")",
  "platform :ios, '16.4'",
  "target 'App' do",
  '  use_expo_modules!',
  'end',
  '',
].join('\n');

describe('app.plugin.js providers', () => {
  it('puts $OnramperProviders at the top of the Podfile, before use_expo_modules!', () => {
    const out: string = plugin.setPodfileProviders(podfile, ['stripe']);
    expect(out.split('\n')[0]).toBe("$OnramperProviders = ['stripe'] # @onramper/onramper-react-native: providers");
    expect(out.indexOf('$OnramperProviders')).toBeLessThan(out.indexOf('use_expo_modules!'));
  });

  it('is idempotent', () => {
    const once = plugin.setPodfileProviders(podfile, ['stripe']);
    expect(plugin.setPodfileProviders(once, ['stripe'])).toBe(once);
  });

  it('removes the line when no provider is configured', () => {
    const withStripe = plugin.setPodfileProviders(podfile, ['stripe']);
    expect(plugin.setPodfileProviders(withStripe, [])).toBe(podfile);
  });

  it('normalizes names and rejects unknown providers', () => {
    expect(plugin.normalizeProviders(undefined)).toEqual([]);
    expect(plugin.normalizeProviders([' Stripe ', 'stripe'])).toEqual(['stripe']);
    expect(() => plugin.normalizeProviders(['paypal'])).toThrow(/unknown provider\(s\) paypal/);
    expect(() => plugin.normalizeProviders('stripe')).toThrow(/must be an array/);
  });
});
