import {
  ApiError,
  NetworkError,
  type LoginRequest,
  type RegisterRequest,
  type Session,
  type SessionManager,
  type UserProfile,
} from '@medipath/client-core';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  login(body: LoginRequest): Promise<void>;
  register(body: RegisterRequest): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Refresh on returning to the foreground when the access token expires within this window. */
const FOREGROUND_REFRESH_SKEW_MS = 60_000;

function isExpiringSoon(session: Session | null, now = Date.now()): boolean {
  return session !== null && session.accessTokenExpiresAt - now <= FOREGROUND_REFRESH_SKEW_MS;
}

export function AuthProvider({ children, sessions }: { children: ReactNode; sessions: SessionManager }) {
  const [session, setSession] = useState<Session | null>(sessions.session);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const unsubscribe = sessions.subscribe((s) => {
      setSession(s);
      setStatus(s ? 'signedIn' : 'signedOut');
    });
    // Restore a session from the Keychain on launch.
    sessions
      .refresh()
      .then((s) => {
        setSession(s);
        setStatus(s ? 'signedIn' : 'signedOut');
      })
      .catch(() => setStatus('signedOut'));
    return unsubscribe;
  }, [sessions]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isExpiringSoon(sessions.session)) sessions.refresh().catch(() => undefined);
    });
    return () => sub.remove();
  }, [sessions]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      login: async (body) => {
        await sessions.login(body);
      },
      register: async (body) => {
        await sessions.register(body);
      },
      // SessionManager always clears locally; an unreachable server or an already-rejected session
      // still counts as signed out, anything else is surfaced.
      logout: async () => {
        try {
          await sessions.logout();
        } catch (e) {
          if (!(e instanceof NetworkError || e instanceof ApiError)) throw e;
        }
      },
    }),
    [sessions, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
