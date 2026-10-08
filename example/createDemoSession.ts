export interface DemoSession {
  sessionId: string;
  sessionToken: string;
}

/**
 * Mints a fresh session pair from the selected environment's demo endpoint.
 * Used both for the initial bootstrap before `initialize(...)` and as the SDK's
 * `onSessionExpired` callback so token refresh runs against real traffic.
 */
export async function createDemoSession(
  endpoint: string,
  demoToken: string,
): Promise<DemoSession> {
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${demoToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      scope: ['quotes:read', 'checkout:read', 'checkout:write'],
    }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '<no body>');
    throw new Error(`create-session ${r.status}: ${errText}`);
  }
  const body = (await r.json()) as {
    sessionId?: string;
    sessionToken?: string;
  };
  if (!body.sessionId || !body.sessionToken) {
    throw new Error(
      'create-session response is missing sessionId or sessionToken',
    );
  }
  return { sessionId: body.sessionId, sessionToken: body.sessionToken };
}
