import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { ApiClient, type Session } from '../api/client';
import { secureRefreshTokenStore } from '../api/tokenStore';
import type { LoginRequest, RegisterRequest, UserProfile } from '../api/types';
import { API_BASE_URL } from '../config';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  client: ApiClient;
  login(body: LoginRequest): Promise<void>;
  register(body: RegisterRequest): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function createDefaultClient(): ApiClient {
  return new ApiClient({ baseUrl: API_BASE_URL, tokenStore: secureRefreshTokenStore });
}

export function AuthProvider({ children, client }: { children: ReactNode; client: ApiClient }) {
  const [session, setSession] = useState<Session | null>(client.currentSession);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const unsubscribe = client.subscribe((s) => {
      setSession(s);
      setStatus(s ? 'signedIn' : 'signedOut');
    });
    // Restore a session from the Keychain on launch.
    client
      .refresh()
      .then((s) => {
        setSession(s);
        setStatus(s ? 'signedIn' : 'signedOut');
      })
      .catch(() => setStatus('signedOut'));
    return unsubscribe;
  }, [client]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && client.isExpiringSoon()) client.refresh().catch(() => undefined);
    });
    return () => sub.remove();
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      client,
      login: async (body) => {
        await client.login(body);
      },
      register: async (body) => {
        await client.register(body);
      },
      logout: () => client.logout(),
    }),
    [client, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
