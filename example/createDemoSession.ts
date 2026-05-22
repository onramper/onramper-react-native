export interface DemoSession {
  sessionId: string;
  sessionToken: string;
}

/**
 * Mints a fresh session pair via the staging demo endpoint. Used both for
 * the initial bootstrap before `initialize(...)` and as the SDK's
 * `onSessionExpired` callback so token refresh runs against real traffic.
 */
export async function createDemoSession(demoToken: string): Promise<DemoSession> {
  const r = await fetch('https://demo-stg.onramper.dev/demo/create-session', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${demoToken}`,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '<no body>');
    throw new Error(`create-session ${r.status}: ${errText}`);
  }
  const body = (await r.json()) as { sessionId?: string; sessionToken?: string };
  if (!body.sessionId || !body.sessionToken) {
    throw new Error(`create-session response missing fields: ${JSON.stringify(body)}`);
  }
  return { sessionId: body.sessionId, sessionToken: body.sessionToken };
}
