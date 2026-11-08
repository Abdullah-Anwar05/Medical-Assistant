import { Link, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { PATIENT_ROLES, STAFF_ROLES } from './api/types';
import { useAuth } from './auth/AuthContext';
import { RequireRole } from './auth/RequireRole';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import {
  AccountPage,
  ForbiddenPage,
  HomePage,
  MediWayHomePage,
  NotFoundPage,
} from './pages/SimplePages';

function Layout({ brand, home, staff }: { brand: string; home: string; staff?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  async function onLogout() {
    await logout();
    navigate(staff ? '/mediway/login' : '/', { replace: true });
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className={staff ? 'site-header staff' : 'site-header'}>
        <Link to={home} className="brand">
          {brand}
        </Link>
        <nav aria-label="Account">
          {user ? (
            <button type="button" className="btn-link" onClick={onLogout}>
              Sign out
            </button>
          ) : (
            <Link to={staff ? '/mediway/login' : '/login'}>Sign in</Link>
          )}
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/mediway" element={<Layout brand="MediWay" home="/mediway" staff />}>
        <Route path="login" element={<LoginPage area="staff" />} />
        <Route
          index
          element={
            <RequireRole roles={STAFF_ROLES} loginPath="/mediway/login">
              <MediWayHomePage />
            </RequireRole>
          }
        />
      </Route>
      <Route element={<Layout brand="MediPath" home="/" />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage area="patient" />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="account"
          element={
            <RequireRole roles={PATIENT_ROLES} loginPath="/login">
              <AccountPage />
            </RequireRole>
          }
        />
        <Route path="forbidden" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
