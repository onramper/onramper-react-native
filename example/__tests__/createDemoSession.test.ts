import { createDemoSession } from '../createDemoSession';

const ENDPOINT = 'https://demo-stg.onramper.dev/demo/create-session';
const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function sentBody(): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
  return JSON.parse(init.body);
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('omits email when none is given and returns no trustedLogin', async () => {
  respond(200, { sessionId: 's', sessionToken: 't' });
  await expect(createDemoSession(ENDPOINT, 'tok')).resolves.toEqual({ sessionId: 's', sessionToken: 't' });
  expect(fetchMock).toHaveBeenCalledWith(
    ENDPOINT,
    expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer tok' }) }),
  );
  expect(sentBody()).not.toHaveProperty('email');
});

test.each(['', '   '])('omits a blank email (%j)', async email => {
  respond(200, { sessionId: 's', sessionToken: 't' });
  await createDemoSession(ENDPOINT, 'tok', email);
  expect(sentBody()).not.toHaveProperty('email');
});

test('sends a trimmed email and returns the trustedLogin outcome', async () => {
  respond(200, { sessionId: 's', sessionToken: 't', trustedLogin: 'bound' });
  await expect(createDemoSession(ENDPOINT, 'tok', '  a@onramper.com ')).resolves.toEqual({
    sessionId: 's',
    sessionToken: 't',
    trustedLogin: 'bound',
  });
  expect(sentBody()).toEqual({ scope: ['quotes:read', 'checkout:read', 'checkout:write'], email: 'a@onramper.com' });
});

test('passes unavailable through and drops unknown trustedLogin values', async () => {
  respond(200, { sessionId: 's', sessionToken: 't', trustedLogin: 'unavailable' });
  expect((await createDemoSession(ENDPOINT, 'tok', 'a@moonpay.com')).trustedLogin).toBe('unavailable');
  respond(200, { sessionId: 's', sessionToken: 't', trustedLogin: 'something-new' });
  expect(await createDemoSession(ENDPOINT, 'tok', 'a@moonpay.com')).not.toHaveProperty('trustedLogin');
});

test('a rejected email throws with the status and body', async () => {
  respond(400, { error: 'email_not_allowed' });
  await expect(createDemoSession(ENDPOINT, 'tok', 'a@example.com')).rejects.toThrow(
    'create-session 400: {"error":"email_not_allowed"}',
  );
});

test('throws when the session pair is missing', async () => {
  respond(200, { sessionId: 's' });
  await expect(createDemoSession(ENDPOINT, 'tok')).rejects.toThrow('missing sessionId or sessionToken');
});
