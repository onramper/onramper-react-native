import { useCallback, useEffect, useRef, useState } from 'react';
import { OnramperClient, type OnramperState } from '@onramper/onramper-react-native';
import { resolveEnvironment, type AppEnvironment } from '../config/environments';
import { createDemoSession } from '../createDemoSession';
import type { ThemeName } from '../theme';
import { describeError } from '../utils/format';

export type InitStatus = 'initializing' | 'ready' | 'error';
export type LogLevel = 'info' | 'event' | 'error';

export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  line: string;
}

export interface UseOnramperOptions {
  environment: AppEnvironment;
  theme: ThemeName;
  /** Bump to tear down and re-initialize (e.g. after clearing local sessions). */
  generation: number;
}

export interface OnramperHandle {
  client: OnramperClient | null;
  status: InitStatus;
  initError: string | null;
  sdkState: OnramperState['kind'];
  transactionId: string | null;
  completedCheckoutId: string | null;
  lastFailure: string | null;
  log: LogEntry[];
  appendLog: (level: LogLevel, line: string) => void;
  clearLog: () => void;
  retry: () => void;
}

const MAX_LOG_ENTRIES = 300;

/**
 * Owns the OnramperClient: mints a demo session, constructs and initializes the
 * client on mount and whenever environment / theme / generation change, and
 * destroys the previous one. A run superseded mid-flight is abandoned — it
 * never publishes its client, and anything it created is destroyed.
 */
export function useOnramper({ environment, theme, generation }: UseOnramperOptions): OnramperHandle {
  const [client, setClient] = useState<OnramperClient | null>(null);
  const [status, setStatus] = useState<InitStatus>('initializing');
  const [initError, setInitError] = useState<string | null>(null);
  const [sdkState, setSdkState] = useState<OnramperState['kind']>('idle');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [completedCheckoutId, setCompletedCheckoutId] = useState<string | null>(null);
  const [lastFailure, setLastFailure] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const nextLogId = useRef(0);

  const appendLog = useCallback((level: LogLevel, line: string) => {
    const entry: LogEntry = {
      id: nextLogId.current++,
      time: new Date().toISOString().slice(11, 19),
      level,
      line,
    };
    setLog(prev => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), entry]);
  }, []);
  const clearLog = useCallback(() => setLog([]), []);
  const retry = useCallback(() => setAttempt(a => a + 1), []);

  useEffect(() => {
    let cancelled = false;
    let created: OnramperClient | null = null;
    setClient(null);
    setStatus('initializing');
    setInitError(null);
    setSdkState('idle');
    setTransactionId(null);
    setCompletedCheckoutId(null);
    setLastFailure(null);

    const run = async () => {
      const env = resolveEnvironment(environment);
      const mint = () => createDemoSession(env.sessionEndpoint, env.demoToken);
      appendLog('info', `[${environment}] minting demo session…`);
      const session = await mint();
      if (cancelled) {
        return;
      }
      appendLog('info', `session ${session.sessionId}`);

      const c = new OnramperClient({
        apiKey: env.apiKey,
        clientId: env.clientId,
        environment: env.name,
        theme,
        logLevel: 'debug',
        onSessionExpired: async () => {
          appendLog('info', 'session expired — minting a new one');
          return mint();
        },
      });
      created = c;
      c.addStateListener(s => {
        setSdkState(s.kind);
        appendLog(s.kind === 'failed' ? 'error' : 'event', `state → ${s.kind}${s.kind === 'failed' ? `: ${s.error.code}` : ''}`);
      });
      c.addTransactionIdListener(setTransactionId);
      c.addEventListener('renderingStarted', e => appendLog('event', `rendering started (${e.renderType})`));
      c.addEventListener('checkoutFinalized', e =>
        appendLog('event', `finalized — transaction ${e.response.onramperTransactionId}`),
      );
      c.addEventListener('completed', e => {
        setCompletedCheckoutId(e.checkoutId);
        setLastFailure(null);
        appendLog('event', `completed ${e.checkoutId}`);
      });
      c.addEventListener('failed', e => {
        setLastFailure(`${e.error.code} — ${e.error.message}`);
        appendLog('error', `failed ${e.error.code} — ${e.error.message}`);
      });
      c.addEventListener('cancelled', () => appendLog('event', 'checkout cancelled'));

      await c.initialize(session);
      if (cancelled) {
        return;
      }
      setClient(c);
      setStatus('ready');
      appendLog('info', `[${environment}] SDK initialized`);
    };

    run().catch((e: unknown) => {
      if (cancelled) {
        return;
      }
      const { code, message } = describeError(e);
      setStatus('error');
      setInitError(`${code} — ${message}`);
      appendLog('error', `init failed: ${code} — ${message}`);
    });

    return () => {
      cancelled = true;
      created?.destroy();
    };
  }, [environment, theme, generation, attempt, appendLog]);

  return {
    client,
    status,
    initError,
    sdkState,
    transactionId,
    completedCheckoutId,
    lastFailure,
    log,
    appendLog,
    clearLog,
    retry,
  };
}
