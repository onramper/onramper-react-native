import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import type {
  CheckoutButtonStyle,
  CheckoutRequest,
  OnramperClient,
  OnramperUserPrefill,
  QuoteResponse,
} from '@onramper/onramper-react-native';
import { prefillSummary } from '../checkout/prefill';
import { describeError } from '../utils/format';
import type { LogLevel } from './useOnramper';

export interface CheckoutResult {
  quote: QuoteResponse;
  button: ReactElement;
}

export interface UseCheckoutOptions {
  client: OnramperClient | null;
  /** `null` when the form can't be priced (invalid amount / blank wallet). */
  request: CheckoutRequest | null;
  prefill: OnramperUserPrefill;
  buttonStyle: CheckoutButtonStyle;
  onLog: (level: LogLevel, line: string) => void;
}

export interface CheckoutHandle {
  result: CheckoutResult | null;
  loading: boolean;
  error: string | null;
  amountHint: string | null;
  refresh: () => void;
}

/**
 * Re-requests checkout requirements whenever the client or any input changes.
 * The effect's cleanup marks the in-flight request stale, so a response for an
 * older input — or for a client that has since been replaced — is dropped.
 */
export function useCheckout({ client, request, prefill, buttonStyle, onLog }: UseCheckoutOptions): CheckoutHandle {
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountHint, setAmountHint] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Inputs are compared by value (the key) rather than identity; the ref hands
  // the effect the current objects without making them dependencies.
  const key = request ? JSON.stringify([request, prefill, buttonStyle]) : null;
  const inputs = useRef({ request, prefill, buttonStyle, onLog });
  inputs.current = { request, prefill, buttonStyle, onLog };

  useEffect(() => {
    setResult(null);
    setError(null);
    const { request: req, prefill: pf, buttonStyle: style, onLog: log } = inputs.current;
    if (!client || key === null || req === null) {
      setLoading(false);
      setAmountHint(null);
      return;
    }
    let active = true;
    setLoading(true);
    log(
      'info',
      `quote: ${req.amount} ${req.source.toUpperCase()} → ${req.destination.toUpperCase()} via ${req.paymentMethod}`,
    );
    log('info', prefillSummary(pf));
    client.getCheckoutRequirements(req, style, pf).then(
      r => {
        if (!active) {
          return;
        }
        setResult(r);
        setAmountHint(null);
        setLoading(false);
        log('info', `quote ok: ${r.quote.ramp} rate=${r.quote.rate} payout=${r.quote.payout}`);
      },
      (e: unknown) => {
        if (!active) {
          return;
        }
        const { code, message } = describeError(e);
        setLoading(false);
        if (code === 'amountOutOfRange') {
          setAmountHint(message);
        } else {
          setAmountHint(null);
          setError(`${code} — ${message}`);
        }
        log('error', `quote failed: ${code} — ${message}`);
      },
    );
    return () => {
      active = false;
    };
  }, [client, key, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  return { result, loading, error, amountHint, refresh };
}
