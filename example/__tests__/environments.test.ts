jest.mock('../env.local', () => ({ ENV: {} }), { virtual: true });

import { resolveEnvironment, type LocalEnv } from '../config/environments';

const local: LocalEnv = {
  development: { apiKey: 'pk_test_x', clientId: 'cid', demoToken: 'tok' },
  production: { apiKey: 'pk_prod_x', clientId: 'cid', demoToken: 'tok' },
};

describe('resolveEnvironment', () => {
  it('maps development to the staging demo endpoint', () => {
    expect(resolveEnvironment('development', local)).toEqual({
      name: 'development',
      label: 'Development',
      sessionEndpoint: 'https://demo-stg.onramper.dev/demo/create-session',
      apiKey: 'pk_test_x',
      clientId: 'cid',
      demoToken: 'tok',
    });
  });

  it('maps production to the production demo endpoint', () => {
    const env = resolveEnvironment('production', local);
    expect(env.sessionEndpoint).toBe(
      'https://demo-prod.onramper.com/demo/create-session',
    );
    expect(env.apiKey).toBe('pk_prod_x');
  });

  it('names every missing or blank secret', () => {
    expect(() =>
      resolveEnvironment('production', {
        production: { apiKey: ' ', clientId: 'cid' },
      }),
    ).toThrow(
      'env.local.ts is missing production.apiKey, production.demoToken',
    );
  });

  it('rejects the legacy flat shape with a readable message', () => {
    const legacy = {
      apiKey: 'pk',
      clientId: 'cid',
      demoToken: 'tok',
    } as unknown as LocalEnv;
    expect(() => resolveEnvironment('development', legacy)).toThrow(
      'env.local.ts is missing development.apiKey, development.clientId, development.demoToken',
    );
  });
});
