/** 2 decimals at or above 1, 6 below (small crypto payouts), "0" for zero. */
export function formatAmount(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1) {
    return value.toFixed(2);
  }
  if (magnitude > 0) {
    return value.toFixed(6);
  }
  return '0';
}

/** Reads `code` / `message` from an OnramperError (or anything shaped like one). */
export function describeError(e: unknown): { code: string; message: string } {
  if (typeof e === 'object' && e !== null) {
    const record = e as { code?: unknown; message?: unknown };
    return {
      code: typeof record.code === 'string' ? record.code : 'unknown',
      message: typeof record.message === 'string' ? record.message : String(e),
    };
  }
  return { code: 'unknown', message: String(e) };
}
