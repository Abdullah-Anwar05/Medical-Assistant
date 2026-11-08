// MSW mock of the Identity API (contracts/identity-v1.md). SYNTHETIC test data only.
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { AuthResponse, Role, UserProfile } from '@medipath/client-core';

export const API = 'http://gateway.test/api/v1/identity';

export function makeUser(roles: Role[] = ['Patient'], overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'test.patient@example.test',
    firstName: 'Testy',
    lastName: 'Synthetic',
    roles,
    organisationId: null,
    ...overrides,
  };
}

export function authResponse(user: UserProfile = makeUser()): AuthResponse {
  return {
    accessToken: 'synthetic-access-token',
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    user,
  };
}

export const problem = (status: number, extra: object = {}) =>
  HttpResponse.json({ title: 'Error', status, ...extra }, { status, headers: { 'Content-Type': 'application/problem+json' } });

/** Default: no session cookie, so refresh is 401. */
export const server = setupServer(http.post(`${API}/refresh`, () => problem(401)));
