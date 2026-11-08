import type { AuthResponse } from './contract';

export interface RefreshTokenBody {
  refreshToken: string;
}

/**
 * How the refresh token travels between client and API (contracts/identity-v1.md, "Tokens").
 * Web uses the HttpOnly cookie; mobile sends it in the body and keeps it in secure storage.
 */
export interface TokenDelivery {
  readonly headers: Readonly<Record<string, string>>;
  readonly credentials: RequestCredentials;
  /** Body for POST /refresh: `undefined` sends none, `null` means no refresh token is held. */
  refreshBody(): Promise<RefreshTokenBody | undefined | null>;
  /** Body for POST /logout, or `undefined` for none. */
  logoutBody(): Promise<RefreshTokenBody | undefined>;
  /** Called with every successful auth response (login, register, refresh). */
  accept(res: AuthResponse): Promise<void>;
  /** Forget any locally held refresh token. */
  clear(): Promise<void>;
}

/** Web: the API sets and reads the `mp_refresh` cookie; the browser holds it, so there is nothing to store. */
export const cookieTokenDelivery: TokenDelivery = {
  headers: {},
  credentials: 'include',
  refreshBody: () => Promise.resolve(undefined),
  logoutBody: () => Promise.resolve(undefined),
  accept: () => Promise.resolve(),
  clear: () => Promise.resolve(),
};

/** Storage for the mobile refresh token (iOS Keychain via expo-secure-store in the app). */
export interface RefreshTokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

/** Mobile: `X-Client: mobile`, refresh token in request/response bodies, persisted in `storage`. */
export function bodyTokenDelivery(storage: RefreshTokenStorage): TokenDelivery {
  async function storedBody(): Promise<RefreshTokenBody | null> {
    const refreshToken = await storage.get();
    return refreshToken ? { refreshToken } : null;
  }
  return {
    headers: { 'X-Client': 'mobile' },
    credentials: 'omit',
    refreshBody: storedBody,
    logoutBody: async () => (await storedBody()) ?? undefined,
    async accept(res) {
      if (!res.refreshToken) throw new Error('Identity API returned no refresh token for X-Client: mobile');
      await storage.set(res.refreshToken);
    },
    clear: () => storage.clear(),
  };
}
