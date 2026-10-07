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
  /**
   * Environment of the last init run that finished (ready or error). Unlike
   * `status`, it changes even when a failed run is followed by another failed
   * run, so callers can tell when a specific switch has settled.
   */
  settledEnvironment: AppEnvironment | null;
  log: LogEntry[];
  appendLog: (level: LogLevel, line: string) => void;
  clearLog: () => void;
  /** Clears the last completed / failed checkout outcome (not the SDK-driven state). */
  clearOutcome: () => void;
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
  // The client is stored with the run that created it. When props move to a
  // new run, the render that sees the new props must stop exposing the old
  // client: this hook's effect cleanup destroys it in the same commit, after
  // which child effects (e.g. useCheckout) would call a disposed native object.
  const [ready, setReady] = useState<{ client: OnramperClient; runKey: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const runKey = `${environment}|${theme}|${generation}|${attempt}`;
  const client = ready?.runKey === runKey ? ready.client : null;
  const [status, setStatus] = useState<InitStatus>('initializing');
  const [initError, setInitError] = useState<string | null>(null);
  const [sdkState, setSdkState] = useState<OnramperState['kind']>('idle');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [completedCheckoutId, setCompletedCheckoutId] = useState<string | null>(null);
  const [lastFailure, setLastFailure] = useState<string | null>(null);
  const [settledEnvironment, setSettledEnvironment] = useState<AppEnvironment | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
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
  const clearOutcome = useCallback(() => {
    setCompletedCheckoutId(null);
    setLastFailure(null);
  }, []);
  const retry = useCallback(() => setAttempt(a => a + 1), []);

  useEffect(() => {
    let cancelled = false;
    let created: OnramperClient | null = null;
    setReady(null);
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
        setCompletedCheckoutId(null);
        setLastFailure(`${e.error.code} — ${e.error.message}`);
        appendLog('error', `failed ${e.error.code} — ${e.error.message}`);
      });
      c.addEventListener('cancelled', () => appendLog('event', 'checkout cancelled'));

      await c.initialize(session);
      if (cancelled) {
        return;
      }
      setReady({ client: c, runKey });
      setStatus('ready');
      setSettledEnvironment(environment);
      appendLog('info', `[${environment}] SDK initialized`);
    };

    run().catch((e: unknown) => {
      if (cancelled) {
        return;
      }
      const { code, message } = describeError(e);
      setStatus('error');
      setSettledEnvironment(environment);
      setInitError(`${code} — ${message}`);
      appendLog('error', `init failed: ${code} — ${message}`);
    });

    return () => {
      cancelled = true;
      created?.destroy();
    };
  }, [environment, theme, generation, attempt, runKey, appendLog]);

  return {
    client,
    // Same reasoning as `client`: a stale 'ready' would advertise the retired client.
    status: client === null && status === 'ready' ? 'initializing' : status,
    initError,
    sdkState,
    transactionId,
    completedCheckoutId,
    lastFailure,
    settledEnvironment,
    log,
    appendLog,
    clearLog,
    clearOutcome,
    retry,
  };
}
