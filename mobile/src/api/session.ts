import {
  bodyTokenDelivery,
  createIdentityClient,
  SessionManager,
  type FetchLike,
  type RefreshTokenStorage,
} from '@medipath/client-core';
import { API_BASE_URL } from '../config';
import { secureRefreshTokenStore } from './tokenStore';

export interface SessionOptions {
  baseUrl: string;
  storage: RefreshTokenStorage;
  fetchImpl?: FetchLike;
}

/** Mobile session: refresh token in request bodies (`X-Client: mobile`), persisted in `storage`. */
export function createSession({ baseUrl, storage, fetchImpl }: SessionOptions): SessionManager {
  const delivery = bodyTokenDelivery(storage);
  return new SessionManager({ client: createIdentityClient({ baseUrl, delivery, fetchImpl }), delivery });
}

export function createDefaultSession(): SessionManager {
  return createSession({ baseUrl: API_BASE_URL, storage: secureRefreshTokenStore });
}
