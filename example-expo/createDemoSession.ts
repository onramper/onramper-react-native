export interface DemoSession {
  sessionId: string;
  sessionToken: string;
  /** Trusted partner login outcome; only reported when an email was sent. */
  trustedLogin?: 'bound' | 'unavailable';
}

/**
 * Mints a fresh session pair via the staging demo endpoint. Used both for
 * the initial bootstrap before `initialize(...)` and as the SDK's
 * `onSessionExpired` callback so token refresh runs against real traffic.
 *
 * A non-blank `email` turns on trusted partner login: the demo service binds
 * the session to that user, and the SDK signs them in to OnramperID without an
 * OTP. Only @onramper.com / @moonpay.com addresses are accepted (400 otherwise).
 */
export async function createDemoSession(demoToken: string, email?: string): Promise<DemoSession> {
  const trimmedEmail = email?.trim() ?? '';
  const r = await fetch('https://demo-stg.onramper.dev/demo/create-session', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${demoToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      scope: ['quotes:read', 'checkout:write'],
      ...(trimmedEmail !== '' ? { email: trimmedEmail } : {}),
    }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '<no body>');
    throw new Error(`create-session ${r.status}: ${errText}`);
  }
  const body = (await r.json()) as { sessionId?: string; sessionToken?: string; trustedLogin?: unknown };
  if (!body.sessionId || !body.sessionToken) {
    throw new Error(`create-session response missing fields: ${JSON.stringify(body)}`);
  }
  const session: DemoSession = { sessionId: body.sessionId, sessionToken: body.sessionToken };
  if (body.trustedLogin === 'bound' || body.trustedLogin === 'unavailable') {
    session.trustedLogin = body.trustedLogin;
  }
  return session;
}
