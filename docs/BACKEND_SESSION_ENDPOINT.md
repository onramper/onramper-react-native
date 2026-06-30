# Backend session endpoint

The Headless Wrapper never talks to Onramper's session-minting API directly —
that call has to be **signed with your partner secret**, which must stay on
your server. So your backend needs to expose a small endpoint that the app
calls to obtain a fresh `{ sessionId, sessionToken }` pair, both at startup and
whenever the wrapper's `onSessionExpired` handler fires.

## What your endpoint does

1. Authenticate the **end user** (your own auth — JWT, session cookie, etc.).
2. Build the client-session request body (`scope`).
3. **Sign** the request with your Ed25519 private key (Signing v2 — see note below).
4. `POST` it to the Onramper partners-api `client-sessions` endpoint.
5. Return the upstream `{ sessionId, sessionToken }` to the app verbatim.

```
app ──(your user auth)──▶ POST /onramper-session  (your backend)
                                    │
                                    │  SigV2-signed, partner secret
                                    ▼
                          POST /partners/v2/{apiKey}/client-sessions  (Onramper)
                                    │
                                    ▼
                          { sessionId, sessionToken }
```

The upstream URL is:

```
{UPSTREAM_BASE_URL}/partners/v2/{PARTNER_API_KEY}/client-sessions
```

- **Staging:** `UPSTREAM_BASE_URL = https://api-stg.onramper.com`
- **Production:** `UPSTREAM_BASE_URL = https://api.onramper.com`

Request body (`scope` required):

```json
{ "scope": ["quotes:read", "checkout:write"] }
```


## 🔐 Authentication: Signing v2

The call to `/partners/v2/{apiKey}/client-sessions` must be authenticated with
**Signing v2 (SigV2)** — an Ed25519 signature over a canonical representation of
the request. We've sent you a dedicated **Signing v2 guide** covering key
registration and the exact canonicalization rules; follow it for the
authoritative spec. The `signRequest` helper below is a working implementation
of that scheme.

You'll need, server-side only:

- `PARTNER_API_KEY` — your partner API key (e.g. `pk_prod_...`), sent as the
  `authorization` header.
- `ED25519_PRIVATE_KEY_PEM` — the PEM-encoded private key whose public half is
  registered against that API key.

## Reference implementation in Typescript

### 1. Signing (`signRequest`)

Please go over the Signing v2 guide for this.

### 2. Calling the Onramper partners-api

```ts
import { signRequest } from "./sigv2";

type CreateSessionInput = { scope?: string[] };

export async function createClientSession(input: CreateSessionInput) {
  const apiKey = process.env.PARTNER_API_KEY!;
  const upstreamBaseUrl = process.env.UPSTREAM_BASE_URL!;
  const privateKeyPem = process.env.ED25519_PRIVATE_KEY_PEM!;

  const path = `/partners/v2/${apiKey}/client-sessions`;
  const body = {
    scope: input.scope ?? ["quotes:read", "checkout:write"],
  };

  const { signature, timestamp, nonce } = signRequest({
    method: "POST",
    path,
    body,
    contentType: "application/json",
    apiKey,
    privateKeyPem,
  });

  const res = await fetch(`${upstreamBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: apiKey,
      "x-onramper-signature": signature,
      "x-onramper-timestamp": timestamp,
      "x-onramper-nonce": nonce,
    },
    body: JSON.stringify(body),
  });

  return { status: res.status, body: await res.json() };
}
```

### 3. Your HTTP endpoint

```ts
import type { FastifyInstance } from "fastify";
import { createClientSession } from "./partners-client";

type CreateSessionBody = { scope?: string[] };

export function registerRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateSessionBody }>("/onramper-session", async (req, reply) => {
    // 1. Authenticate the END USER with your own auth.
    //    e.g. verify req.headers.authorization (your app's JWT), not a partner secret.
    const user = await authenticateUser(req.headers.authorization);
    if (!user) {
      reply.code(401);
      return { error: "unauthorized" };
    }

    // 2. Mint the session against the Onramper partners-api.
    const { scope } = req.body ?? {};
    const result = await createClientSession({ scope });

    // 3. Return { sessionId, sessionToken } to the app verbatim.
    reply.code(result.status);
    return result.body;
  });
}
```

The app side that consumes this — at startup and inside `onSessionExpired` —
looks like:

```ts
const r = await fetch('https://api.yourapp.com/onramper-session', {
  method: 'POST',
  headers: { authorization: `Bearer ${userJWT}` },
});
const { sessionId, sessionToken } = await r.json();
await client.initialize({ sessionId, sessionToken });
```
