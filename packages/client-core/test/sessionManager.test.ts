import { ApiError } from '../src/errors';
import { createIdentityClient } from '../src/identityClient';
import { SessionManager, type Session } from '../src/sessionManager';
import { bodyTokenDelivery, cookieTokenDelivery } from '../src/tokenDelivery';
import { authResponse, BASE, fakeFetch, json, makeUser, memoryStorage } from './helpers';

function webManager(...responses: Array<Response | Error>) {
  const fetch = fakeFetch(...responses);
  const client = createIdentityClient({ baseUrl: BASE, delivery: cookieTokenDelivery, fetchImpl: fetch.impl });
  return { manager: new SessionManager({ client, delivery: cookieTokenDelivery }), calls: fetch.calls };
}

describe('SessionManager', () => {
  it('shares one refresh request between concurrent callers', async () => {
    const { manager, calls } = webManager(json(200, authResponse()));

    const [a, b] = await Promise.all([manager.refresh(), manager.refresh()]);

    expect(calls).toHaveLength(1);
    expect(a).toBe(b);
    expect(manager.session?.user.email).toBe('test.patient@example.test');
  });

  it('resolves null and notifies listeners when the API rejects the refresh token', async () => {
    const { manager } = webManager(json(401, { title: 'Unauthorized' }));
    const seen: Array<Session | null> = [];
    manager.subscribe((s) => seen.push(s));

    await expect(manager.refresh()).resolves.toBeNull();
    expect(seen).toEqual([null]);
  });

  it('rethrows server errors from refresh and keeps the stored mobile token', async () => {
    const storage = memoryStorage('synthetic-refresh-1');
    const delivery = bodyTokenDelivery(storage);
    const { impl } = fakeFetch(json(503, { title: 'Unavailable' }));
    const manager = new SessionManager({ client: createIdentityClient({ baseUrl: BASE, delivery, fetchImpl: impl }), delivery });

    await expect(manager.refresh()).rejects.toBeInstanceOf(ApiError);
    expect(storage.value).toBe('synthetic-refresh-1');
  });

  it('clears the session locally even when the logout request fails, then rethrows', async () => {
    const { manager } = webManager(json(200, authResponse()), new TypeError('Failed to fetch'));
    await manager.login({ email: 'test.patient@example.test', password: 'synthetic-password-1' });

    await expect(manager.logout()).rejects.toThrow();
    expect(manager.session).toBeNull();
  });

  it('refreshes and retries logout once when the access token has expired', async () => {
    const { manager, calls } = webManager(
      json(200, authResponse()),
      json(401, { title: 'Unauthorized' }),
      json(200, authResponse({ accessToken: 'synthetic-access-2' })),
      new Response(null, { status: 204 }),
    );
    await manager.login({ email: 'test.patient@example.test', password: 'synthetic-password-1' });

    await manager.logout();

    expect(calls.map((c) => c.url.split('/').pop())).toEqual(['login', 'logout', 'refresh', 'logout']);
    expect(new Headers(calls[3].init.headers).get('Authorization')).toBe('Bearer synthetic-access-2');
    expect(manager.session).toBeNull();
  });

  it('skips the logout request when there is no session', async () => {
    const { manager, calls } = webManager();

    await manager.logout();

    expect(calls).toHaveLength(0);
  });

  it('retries /me once after refreshing a rejected access token', async () => {
    const { manager, calls } = webManager(
      json(200, authResponse()),
      json(401, { title: 'Unauthorized' }),
      json(200, authResponse({ accessToken: 'synthetic-access-2' })),
      json(200, makeUser(['PlatformAdmin'])),
    );
    await manager.login({ email: 'test.patient@example.test', password: 'synthetic-password-1' });

    const me = await manager.me();

    expect(me.roles).toEqual(['PlatformAdmin']);
    expect(new Headers(calls[3].init.headers).get('Authorization')).toBe('Bearer synthetic-access-2');
  });

  describe('timed refresh', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('refreshes the lead time before expiry', async () => {
      const fetch = fakeFetch(json(200, authResponse({}, 15 * 60_000)), json(200, authResponse()));
      const client = createIdentityClient({ baseUrl: BASE, delivery: cookieTokenDelivery, fetchImpl: fetch.impl });
      const manager = new SessionManager({ client, delivery: cookieTokenDelivery, autoRefreshLeadMs: 60_000 });
      await manager.login({ email: 'test.patient@example.test', password: 'synthetic-password-1' });

      await vi.advanceTimersByTimeAsync(14 * 60_000 - 1_000);
      expect(fetch.calls).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(fetch.calls[1].url).toBe(`${BASE}/api/v1/identity/refresh`);
      manager.dispose();
    });

    it('reports an unexpected timed-refresh failure to onBackgroundError', async () => {
      const fetch = fakeFetch(json(200, authResponse({}, 0)), json(500, { title: 'Boom' }));
      const client = createIdentityClient({ baseUrl: BASE, delivery: cookieTokenDelivery, fetchImpl: fetch.impl });
      const onBackgroundError = vi.fn();
      const manager = new SessionManager({
        client,
        delivery: cookieTokenDelivery,
        autoRefreshLeadMs: 60_000,
        onBackgroundError,
      });
      await manager.login({ email: 'test.patient@example.test', password: 'synthetic-password-1' });

      await vi.advanceTimersByTimeAsync(5_000);

      expect(onBackgroundError).toHaveBeenCalledWith(expect.any(ApiError));
      manager.dispose();
    });
  });
});
