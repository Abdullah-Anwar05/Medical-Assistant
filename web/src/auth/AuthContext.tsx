import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  hasAnyRole,
  type LoginRequest,
  type RegisterRequest,
  type Role,
  type SessionManager,
  type UserProfile,
} from '@medipath/client-core';
import { createWebSessionManager } from '../api/client';

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

/** A refresh that failed for any reason other than a rejected token: log it and treat the user as signed out. */
function signOutAfterUnexpectedError(manager: SessionManager, error: unknown): void {
  console.error('Session refresh failed', error);
  void manager.discard();
}

function createDefaultManager(): SessionManager {
  const manager: SessionManager = createWebSessionManager((error) => signOutAfterUnexpectedError(manager, error));
  return manager;
}

export function AuthProvider({ children, manager: injected }: { children: ReactNode; manager?: SessionManager }) {
  const [manager] = useState<SessionManager>(() => injected ?? createDefaultManager());
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = manager.subscribe((session) => {
      setUser(session?.user ?? null);
      setStatus(session ? 'authenticated' : 'anonymous');
    });
    manager.refresh().then(
      (session) => {
        if (!session) setStatus('anonymous');
      },
      (error: unknown) => signOutAfterUnexpectedError(manager, error),
    );
    return () => {
      unsubscribe();
      manager.dispose();
    };
  }, [manager]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: (body) => manager.login(body),
      register: (body) => manager.register(body),
      async logout() {
        await manager.logout().catch((error: unknown) => {
          console.error('Logout request failed; the local session was cleared anyway', error);
        });
      },
      hasAnyRole: (roles) => hasAnyRole(user, roles),
      getAccessToken: () => manager.session?.accessToken ?? null,
    }),
    [manager, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
