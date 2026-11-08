// SYNTHETIC test data only.
import type { AuthResponse, Role, UserProfile } from '../src/contract';
import type { FetchLike } from '../src/identityClient';
import type { RefreshTokenStorage } from '../src/tokenDelivery';

export const BASE = 'http://gateway.test';

export function makeUser(roles: Role[] = ['Patient']): UserProfile {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'test.patient@example.test',
    firstName: 'Testy',
    lastName: 'Synthetic',
    roles,
    organisationId: null,
  };
}

export function authResponse(extra: Partial<AuthResponse> = {}, expiresInMs = 15 * 60_000): AuthResponse {
  return {
    accessToken: 'synthetic-access-token',
    accessTokenExpiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    user: makeUser(),
    ...extra,
  };
}

export function json(status: number, body: unknown, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

export interface RecordedCall {
  url: string;
  init: RequestInit;
}

/** Fake fetch answering from a queue of responses and recording every call. */
export function fakeFetch(...responses: Array<Response | Error>) {
  const calls: RecordedCall[] = [];
  const impl: FetchLike = (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) return Promise.reject(new Error(`Unexpected request to ${url}`));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  return { impl, calls };
}

export function memoryStorage(initial: string | null = null): RefreshTokenStorage & { value: string | null } {
  return {
    value: initial,
    get() {
      return Promise.resolve(this.value);
    },
    set(token) {
      this.value = token;
      return Promise.resolve();
    },
    clear() {
      this.value = null;
      return Promise.resolve();
    },
  };
}
