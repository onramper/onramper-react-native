// Copy this file to `env.local.ts` and fill in real values for both
// environments. `env.local.ts` is gitignored — secrets stay local.
import type { LocalEnv } from './config/environments';

export const ENV: LocalEnv = {
  development: {
    apiKey: 'pk_test_...',
    clientId: '01K...',
    demoToken: '3c76cc5a...',
  },
  production: {
    apiKey: 'pk_prod_...',
    clientId: '01K...',
    demoToken: '3c76cc5a...',
  },
};
