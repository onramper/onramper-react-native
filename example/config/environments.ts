import type { OnramperEnvironment } from '@onramper/onramper-react-native';
import { ENV } from '../env.local';

export type AppEnvironment = OnramperEnvironment;

export interface EnvSecrets {
  apiKey: string;
  clientId: string;
  demoToken: string;
}

/** Shape of the gitignored `env.local.ts` — see `env.local.example.ts`. */
export type LocalEnv = Partial<Record<AppEnvironment, Partial<EnvSecrets>>>;

export interface ResolvedEnvironment extends EnvSecrets {
  name: AppEnvironment;
  label: string;
  sessionEndpoint: string;
}

export const ENVIRONMENTS: readonly AppEnvironment[] = [
  'development',
  'production',
];
export const DEFAULT_ENVIRONMENT: AppEnvironment = 'development';

const STATIC: Record<
  AppEnvironment,
  { label: string; sessionEndpoint: string }
> = {
  development: {
    label: 'Development',
    sessionEndpoint: 'https://demo-stg.onramper.dev/demo/create-session',
  },
  production: {
    label: 'Production',
    sessionEndpoint: 'https://demo-prod.onramper.com/demo/create-session',
  },
};

const SECRET_KEYS = ['apiKey', 'clientId', 'demoToken'] as const;

export function environmentLabel(name: AppEnvironment): string {
  return STATIC[name].label;
}

/**
 * Combines the committed endpoint table with the local secrets for `name`.
 * Throws a message naming every missing secret, so a stale or partial
 * `env.local.ts` shows up as a readable init error instead of a network failure.
 */
export function resolveEnvironment(
  name: AppEnvironment,
  local: LocalEnv = ENV,
): ResolvedEnvironment {
  const secrets = local[name] ?? {};
  const value = (key: keyof EnvSecrets) => (secrets[key] ?? '').trim();
  const missing = SECRET_KEYS.filter(key => value(key) === '');
  if (missing.length > 0) {
    throw new Error(
      `env.local.ts is missing ${missing
        .map(key => `${name}.${key}`)
        .join(', ')}`,
    );
  }
  return {
    name,
    ...STATIC[name],
    apiKey: value('apiKey'),
    clientId: value('clientId'),
    demoToken: value('demoToken'),
  };
}
