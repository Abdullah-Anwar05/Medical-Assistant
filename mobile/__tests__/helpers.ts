// Synthetic test data only — not real patients.
import type { AuthResponse, FetchLike, RefreshTokenStorage } from '@medipath/client-core';
import { createSession } from '../src/api/session';

export const BASE = 'http://gateway.test';

export function authResponse(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    accessToken: 'access-1',
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: 'refresh-1',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test.patient@example.test',
      firstName: 'Testy',
      lastName: 'Patient',
      roles: ['Patient'],
      organisationId: null,
    },
    ...overrides,
  };
}

export function json(status: number, body?: unknown, contentType = 'application/json'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
    headers: { get: () => contentType },
  } as unknown as Response;
}

export function memoryStore(initial: string | null = null): RefreshTokenStorage & { value: string | null } {
  const store = {
    value: initial,
    get: async () => store.value,
    set: async (t: string) => {
      store.value = t;
    },
    clear: async () => {
      store.value = null;
    },
  };
  return store;
}

export function makeSession(responses: Response[], store = memoryStore()) {
  const fetchImpl = jest.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('Unexpected fetch');
    return next;
  });
  const sessions = createSession({ baseUrl: BASE, storage: store, fetchImpl: fetchImpl as unknown as FetchLike });
  return { sessions, fetchImpl, store };
}

/** Parsed request of the n-th fetch call. */
export function call(fetchImpl: jest.Mock, n: number) {
  const [url, init] = fetchImpl.mock.calls[n] as [string, RequestInit];
  return {
    url,
    method: init.method,
    headers: init.headers as Record<string, string>,
    body: init.body ? JSON.parse(init.body as string) : undefined,
  };
}
