export type TrustedLoginResult = 'bound' | 'unavailable';

export interface DemoSession {
  sessionId: string;
  sessionToken: string;
  /**
   * Trusted partner login outcome. The backend only reports it when an email
   * was sent with the request; absent otherwise.
   */
  trustedLogin?: TrustedLoginResult;
}

/**
 * Mints a fresh session pair from the selected environment's demo endpoint.
 * Used both for the initial bootstrap before `initialize(...)` and as the SDK's
 * `onSessionExpired` callback so token refresh runs against real traffic.
 *
 * `email` (optional) turns on trusted partner login: the demo service forwards
 * it as `user.email`, and the SDK then signs that user in to OnramperID without
 * an OTP. It's sent only when non-blank; the demo service accepts only
 * @onramper.com / @moonpay.com addresses (400 `invalid_email` /
 * `email_not_allowed` otherwise).
 */
export async function createDemoSession(
  endpoint: string,
  demoToken: string,
  email?: string,
): Promise<DemoSession> {
  const trimmedEmail = email?.trim() ?? '';
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${demoToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      scope: ['quotes:read', 'checkout:read', 'checkout:write'],
      ...(trimmedEmail !== '' ? { email: trimmedEmail } : {}),
    }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '<no body>');
    throw new Error(`create-session ${r.status}: ${errText}`);
  }
  const body = (await r.json()) as {
    sessionId?: string;
    sessionToken?: string;
    trustedLogin?: unknown;
  };
  if (!body.sessionId || !body.sessionToken) {
    throw new Error(
      'create-session response is missing sessionId or sessionToken',
    );
  }
  const session: DemoSession = { sessionId: body.sessionId, sessionToken: body.sessionToken };
  if (body.trustedLogin === 'bound' || body.trustedLogin === 'unavailable') {
    session.trustedLogin = body.trustedLogin;
  }
  return session;
}
