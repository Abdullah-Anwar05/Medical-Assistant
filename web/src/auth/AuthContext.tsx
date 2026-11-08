import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, identityApi } from '../api/client';
import type { AuthResponse, LoginRequest, RegisterRequest, Role, UserProfile } from '../api/types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  login(body: LoginRequest): Promise<UserProfile>;
  register(body: RegisterRequest): Promise<UserProfile>;
  logout(): Promise<void>;
  hasAnyRole(roles: readonly Role[]): boolean;
  /** Current access token (memory only) for authenticated requests. */
  getAccessToken(): string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Refresh this long before the access token expires. */
const REFRESH_LEAD_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);
  // Access token lives in memory only — never localStorage/sessionStorage.
  const tokenRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refresh tokens rotate and reuse of a revoked one revokes the whole family, so
  // concurrent refreshes (StrictMode double effects, timer + mount) share one request.
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  const clear = useCallback(() => {
    tokenRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setUser(null);
    setStatus('anonymous');
  }, []);

  const silentRefresh = useCallback((): Promise<boolean> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = identityApi
        .refresh()
        .then((res) => {
          apply(res);
          return true;
        })
        .catch((err: unknown) => {
          // 401 = no/expired/revoked cookie: the normal signed-out state.
          if (!(err instanceof ApiError && err.status === 401)) console.error('Session refresh failed', err);
          clear();
          return false;
        })
        .finally(() => {
          refreshInFlight.current = null;
        });
    }
    return refreshInFlight.current;

    function apply(res: AuthResponse) {
      applyRef.current(res);
    }
  }, [clear]);

  const apply = useCallback(
    (res: AuthResponse) => {
      tokenRef.current = res.accessToken;
      setUser(res.user);
      setStatus('authenticated');
      if (timerRef.current) clearTimeout(timerRef.current);
      const expiresIn = new Date(res.accessTokenExpiresAt).getTime() - Date.now();
      timerRef.current = setTimeout(() => void silentRefresh(), Math.max(expiresIn - REFRESH_LEAD_MS, 5_000));
    },
    [silentRefresh],
  );
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);

  useEffect(() => {
    void silentRefresh();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [silentRefresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(body) {
        const res = await identityApi.login(body);
        apply(res);
        return res.user;
      },
      async register(body) {
        const res = await identityApi.register(body);
        apply(res);
        return res.user;
      },
      async logout() {
        const token = tokenRef.current;
        try {
          if (token) await identityApi.logout(token);
        } catch (err) {
          console.error('Logout request failed; clearing the local session anyway', err);
        } finally {
          clear();
        }
      },
      hasAnyRole: (roles) => !!user && user.roles.some((r) => roles.includes(r)),
      getAccessToken: () => tokenRef.current,
    }),
    [status, user, apply, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
