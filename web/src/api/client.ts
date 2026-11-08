import { cookieTokenDelivery, createIdentityClient, SessionManager } from '@medipath/client-core';

/** Refresh this long before the access token expires. */
const REFRESH_LEAD_MS = 60_000;

/** Gateway base URL from env (VITE_API_BASE_URL). */
export function apiBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL;
  if (!url) throw new Error('VITE_API_BASE_URL is not set. Copy .env.example to .env.local.');
  return url;
}

/**
 * Web composition of the shared client core: refresh token in the HttpOnly `mp_refresh` cookie,
 * access token in memory only (never localStorage/sessionStorage).
 */
export function createWebSessionManager(onBackgroundError: (error: unknown) => void): SessionManager {
  const client = createIdentityClient({ baseUrl: apiBaseUrl(), delivery: cookieTokenDelivery });
  return new SessionManager({
    client,
    delivery: cookieTokenDelivery,
    autoRefreshLeadMs: REFRESH_LEAD_MS,
    onBackgroundError,
  });
}
