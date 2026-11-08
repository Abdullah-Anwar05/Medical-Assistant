import { ApiError, NetworkError, userMessage } from '../src/api/errors';
import { authResponse, BASE, call, json, makeClient, memoryStore } from './helpers';

describe('ApiClient', () => {
  it('logs in with X-Client: mobile, stores the refresh token, keeps the access token in memory', async () => {
    const { client, fetchImpl, store } = makeClient([json(200, authResponse())]);
    const user = await client.login({ email: 'test.patient@example.test', password: 'correct horse battery' });

    const req = call(fetchImpl, 0);
    expect(req.url).toBe(`${BASE}/api/v1/identity/login`);
    expect(req.method).toBe('POST');
    expect(req.headers['X-Client']).toBe('mobile');
    expect(req.body).toEqual({ email: 'test.patient@example.test', password: 'correct horse battery' });
    expect(user.firstName).toBe('Testy');
    expect(store.value).toBe('refresh-1');
    expect(client.currentSession?.accessToken).toBe('access-1');
  });

  it('surfaces Problem Details on failure', async () => {
    const { client } = makeClient([json(401, { title: 'Invalid credentials', status: 401 }, 'application/problem+json')]);
    const err = await client.login({ email: 'a@b.test', password: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.problem.title).toBe('Invalid credentials');
  });

  it('maps 400 errors map to camelCase field errors', () => {
    const err = new ApiError(400, { errors: { Password: ['Too short'], dateOfBirth: ['Invalid'] } });
    expect(err.fieldErrors).toEqual({ password: 'Too short', dateOfBirth: 'Invalid' });
  });

  it('refreshes once on 401 and retries the request with the new token', async () => {
    const store = memoryStore();
    const { client, fetchImpl } = makeClient(
      [
        json(200, authResponse()),
        json(401, { title: 'expired' }),
        json(200, authResponse({ accessToken: 'access-2', refreshToken: 'refresh-2' })),
        json(200, authResponse().user),
      ],
      store,
    );
    await client.login({ email: 'a@b.test', password: 'p' });
    const me = await client.me();

    expect(me.email).toBe('test.patient@example.test');
    expect(call(fetchImpl, 1).headers.Authorization).toBe('Bearer access-1');
    expect(call(fetchImpl, 2).url).toBe(`${BASE}/api/v1/identity/refresh`);
    expect(call(fetchImpl, 2).body).toEqual({ refreshToken: 'refresh-1' });
    expect(call(fetchImpl, 3).headers.Authorization).toBe('Bearer access-2');
    expect(store.value).toBe('refresh-2');
  });

  it('shares one refresh between concurrent callers (rotation safety)', async () => {
    const { client, fetchImpl } = makeClient([json(200, authResponse())], memoryStore('stored'));
    const [a, b] = await Promise.all([client.refresh(), client.refresh()]);
    expect(a).toBe(b);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('signs out locally when the refresh token is rejected', async () => {
    const store = memoryStore('revoked');
    const { client } = makeClient([json(401, { title: 'nope' })], store);
    const listener = jest.fn();
    client.subscribe(listener);
    expect(await client.refresh()).toBeNull();
    expect(store.value).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it('keeps the stored refresh token on a network error', async () => {
    const store = memoryStore('stored');
    const { client, fetchImpl } = makeClient([], store);
    fetchImpl.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(client.refresh()).rejects.toBeInstanceOf(NetworkError);
    expect(store.value).toBe('stored');
  });

  it('logout posts the refresh token with a bearer and clears local state even if the server fails', async () => {
    const store = memoryStore();
    const { client, fetchImpl } = makeClient([json(200, authResponse()), json(500, { title: 'boom' })], store);
    await client.login({ email: 'a@b.test', password: 'p' });
    await client.logout();
    const req = call(fetchImpl, 1);
    expect(req.url).toBe(`${BASE}/api/v1/identity/logout`);
    expect(req.headers.Authorization).toBe('Bearer access-1');
    expect(req.body).toEqual({ refreshToken: 'refresh-1' });
    expect(store.value).toBeNull();
    expect(client.currentSession).toBeNull();
  });
});

describe('userMessage', () => {
  it('never reveals whether an email exists on login', () => {
    const msg = userMessage(new ApiError(401, { detail: 'No account for test@example.test' }), 'login');
    expect(msg).toBe('Email or password is incorrect.');
  });
  it('explains lockout and rate limiting', () => {
    expect(userMessage(new ApiError(423, null), 'login')).toMatch(/15 minutes/);
    expect(userMessage(new ApiError(429, null), 'login')).toMatch(/Too many requests/);
  });
});
