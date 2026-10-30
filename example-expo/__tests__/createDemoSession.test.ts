import { createDemoSession } from '../createDemoSession';

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

const sentBody = (): Record<string, unknown> => JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('omits a missing or blank email', async () => {
  respond(200, { sessionId: 's', sessionToken: 't' });
  await expect(createDemoSession('tok', '  ')).resolves.toEqual({ sessionId: 's', sessionToken: 't' });
  expect(sentBody()).toEqual({ scope: ['quotes:read', 'checkout:write'] });
});

test('sends a trimmed email and returns trustedLogin', async () => {
  respond(200, { sessionId: 's', sessionToken: 't', trustedLogin: 'unavailable' });
  await expect(createDemoSession('tok', ' a@moonpay.com ')).resolves.toEqual({
    sessionId: 's',
    sessionToken: 't',
    trustedLogin: 'unavailable',
  });
  expect(sentBody()).toEqual({ scope: ['quotes:read', 'checkout:write'], email: 'a@moonpay.com' });
});

test('a rejected email throws with the status and body', async () => {
  respond(400, { error: 'invalid_email' });
  await expect(createDemoSession('tok', 'nope')).rejects.toThrow('create-session 400: {"error":"invalid_email"}');
});
