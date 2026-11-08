import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '../api/types';
import { useAuth } from './AuthContext';

interface Props {
  roles: readonly Role[];
  loginPath: string;
  children: ReactNode;
}

/** Route guard: anonymous users go to login (and come back afterwards); wrong role sees 403. */
export function RequireRole({ roles, loginPath, children }: Props) {
  const { status, hasAnyRole } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <p role="status">Checking your session…</p>;
  if (status === 'anonymous') return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  if (!hasAnyRole(roles)) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
}
