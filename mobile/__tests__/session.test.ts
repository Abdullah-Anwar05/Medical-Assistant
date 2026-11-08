import { NetworkError } from '@medipath/client-core';
import { authResponse, BASE, call, json, makeSession, memoryStore } from './helpers';

// Generic client/session behaviour is tested in packages/client-core; these cover mobile's wiring.
describe('mobile session wiring', () => {
  it('logs in with X-Client: mobile, stores the refresh token, keeps the access token in memory', async () => {
    const { sessions, fetchImpl, store } = makeSession([json(200, authResponse())]);
    const user = await sessions.login({ email: 'test.patient@example.test', password: 'correct horse battery' });

    const req = call(fetchImpl, 0);
    expect(req.url).toBe(`${BASE}/api/v1/identity/login`);
    expect(req.headers['X-Client']).toBe('mobile');
    expect(user.firstName).toBe('Testy');
    expect(store.value).toBe('refresh-1');
    expect(sessions.session?.accessToken).toBe('access-1');
  });

  it('refreshes with the stored token in the body and stores the rotated one', async () => {
    const store = memoryStore('stored');
    const { sessions, fetchImpl } = makeSession([json(200, authResponse({ refreshToken: 'rotated' }))], store);
    await sessions.refresh();
    expect(call(fetchImpl, 0).body).toEqual({ refreshToken: 'stored' });
    expect(store.value).toBe('rotated');
  });

  it('keeps the stored refresh token on a network error', async () => {
    const store = memoryStore('stored');
    const { sessions, fetchImpl } = makeSession([], store);
    fetchImpl.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(sessions.refresh()).rejects.toBeInstanceOf(NetworkError);
    expect(store.value).toBe('stored');
  });

  it('logout sends the refresh token with a bearer and clears the Keychain', async () => {
    const store = memoryStore();
    const { sessions, fetchImpl } = makeSession([json(200, authResponse()), json(204)], store);
    await sessions.login({ email: 'a@b.test', password: 'p' });
    await sessions.logout();
    const req = call(fetchImpl, 1);
    expect(req.url).toBe(`${BASE}/api/v1/identity/logout`);
    expect(req.headers.Authorization).toBe('Bearer access-1');
    expect(req.body).toEqual({ refreshToken: 'refresh-1' });
    expect(store.value).toBeNull();
  });
});
