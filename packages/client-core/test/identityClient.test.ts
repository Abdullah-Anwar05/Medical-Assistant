import { ApiError, NetworkError } from '../src/errors';
import { createIdentityClient } from '../src/identityClient';
import { bodyTokenDelivery, cookieTokenDelivery } from '../src/tokenDelivery';
import { authResponse, BASE, fakeFetch, json, memoryStorage } from './helpers';

const LOGIN = { email: 'test.patient@example.test', password: 'synthetic-password-1' };

function headersOf(init: RequestInit): Headers {
  return new Headers(init.headers);
}

describe('createIdentityClient with cookie delivery (web)', () => {
  it('posts login JSON with credentials included and no X-Client header', async () => {
    const { impl, calls } = fakeFetch(json(200, authResponse()));
    const client = createIdentityClient({ baseUrl: `${BASE}/`, delivery: cookieTokenDelivery, fetchImpl: impl });

    const res = await client.login(LOGIN);

    expect(res.user.roles).toEqual(['Patient']);
    expect(calls[0].url).toBe(`${BASE}/api/v1/identity/login`);
    expect(calls[0].init.credentials).toBe('include');
    expect(calls[0].init.body).toBe(JSON.stringify(LOGIN));
    expect(headersOf(calls[0].init).get('X-Client')).toBeNull();
    expect(headersOf(calls[0].init).get('Content-Type')).toBe('application/json');
  });

  it('sends refresh with no body (the cookie carries the token)', async () => {
    const { impl, calls } = fakeFetch(json(200, authResponse()));
    const client = createIdentityClient({ baseUrl: BASE, delivery: cookieTokenDelivery, fetchImpl: impl });

    await client.refresh();

    expect(calls[0].init.body).toBeUndefined();
  });

  it('sends the bearer token on logout and accepts 204', async () => {
    const { impl, calls } = fakeFetch(new Response(null, { status: 204 }));
    const client = createIdentityClient({ baseUrl: BASE, delivery: cookieTokenDelivery, fetchImpl: impl });

    await expect(client.logout('synthetic-access-token')).resolves.toBeUndefined();
    expect(headersOf(calls[0].init).get('Authorization')).toBe('Bearer synthetic-access-token');
  });

  it('throws ApiError with the Problem Details body', async () => {
    const problem = { title: 'Validation', status: 400, errors: { Password: ['Too short.'] } };
    const { impl } = fakeFetch(json(400, problem, 'application/problem+json'));
    const client = createIdentityClient({ baseUrl: BASE, delivery: cookieTokenDelivery, fetchImpl: impl });

    const error = await client.login(LOGIN).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).problem).toEqual(problem);
  });

  it('throws ApiError with a null problem for a non-JSON error body', async () => {
    const { impl } = fakeFetch(new Response('Bad gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } }));
    const client = createIdentityClient({ baseUrl: BASE, delivery: cookieTokenDelivery, fetchImpl: impl });

    const error = (await client.login(LOGIN).catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(502);
    expect(error.problem).toBeNull();
  });

  it('wraps a failed fetch in NetworkError', async () => {
    const { impl } = fakeFetch(new TypeError('Failed to fetch'));
    const client = createIdentityClient({ baseUrl: BASE, delivery: cookieTokenDelivery, fetchImpl: impl });

    await expect(client.login(LOGIN)).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('createIdentityClient with body delivery (mobile)', () => {
  it('sends X-Client: mobile and stores the returned refresh token', async () => {
    const storage = memoryStorage();
    const { impl, calls } = fakeFetch(json(200, authResponse({ refreshToken: 'synthetic-refresh-1' })));
    const client = createIdentityClient({ baseUrl: BASE, delivery: bodyTokenDelivery(storage), fetchImpl: impl });

    await client.login(LOGIN);

    expect(headersOf(calls[0].init).get('X-Client')).toBe('mobile');
    expect(calls[0].init.credentials).toBe('omit');
    expect(storage.value).toBe('synthetic-refresh-1');
  });

  it('sends the stored refresh token in the refresh body and stores the rotated one', async () => {
    const storage = memoryStorage('synthetic-refresh-1');
    const { impl, calls } = fakeFetch(json(200, authResponse({ refreshToken: 'synthetic-refresh-2' })));
    const client = createIdentityClient({ baseUrl: BASE, delivery: bodyTokenDelivery(storage), fetchImpl: impl });

    await client.refresh();

    expect(calls[0].init.body).toBe(JSON.stringify({ refreshToken: 'synthetic-refresh-1' }));
    expect(storage.value).toBe('synthetic-refresh-2');
  });

  it('rejects refresh with 401 without calling the API when no token is stored', async () => {
    const { impl, calls } = fakeFetch();
    const client = createIdentityClient({ baseUrl: BASE, delivery: bodyTokenDelivery(memoryStorage()), fetchImpl: impl });

    const error = (await client.refresh().catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('rejects an auth response without a refresh token', async () => {
    const { impl } = fakeFetch(json(200, authResponse()));
    const client = createIdentityClient({ baseUrl: BASE, delivery: bodyTokenDelivery(memoryStorage()), fetchImpl: impl });

    await expect(client.login(LOGIN)).rejects.toThrow('no refresh token');
  });

  it('sends the stored refresh token on logout', async () => {
    const { impl, calls } = fakeFetch(new Response(null, { status: 204 }));
    const client = createIdentityClient({
      baseUrl: BASE,
      delivery: bodyTokenDelivery(memoryStorage('synthetic-refresh-1')),
      fetchImpl: impl,
    });

    await client.logout('synthetic-access-token');

    expect(calls[0].init.body).toBe(JSON.stringify({ refreshToken: 'synthetic-refresh-1' }));
  });
});
