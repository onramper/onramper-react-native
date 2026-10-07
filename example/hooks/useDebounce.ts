import { useEffect, useRef, useState } from 'react';

/** Typing pause before a text field re-quotes. Taps act immediately. */
export const TYPING_DEBOUNCE_MS = 400;

export function useDebouncedValue<T>(value: T, delayMs: number = TYPING_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * A text input's draft that commits `delayMs` after typing stops. When the
 * committed value changes from elsewhere (e.g. picking a currency resets the
 * wallet), the draft follows immediately and nothing is re-committed.
 */
export function useDebouncedField(
  committed: string,
  commit: (value: string) => void,
  delayMs: number = TYPING_DEBOUNCE_MS,
): [string, (value: string) => void] {
  const [draft, setDraft] = useState(committed);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    setDraft(committed);
  }, [committed]);

  useEffect(() => {
    if (draft === committed) {
      return;
    }
    const timer = setTimeout(() => commitRef.current(draft), delayMs);
    return () => clearTimeout(timer);
  }, [draft, committed, delayMs]);

  return [draft, setDraft];
}
