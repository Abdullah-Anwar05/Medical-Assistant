import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function HomePage() {
  const { user } = useAuth();
  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title">Your elective surgery journey, in one place</h1>
      <p>MediPath helps you follow your treatment pathway from referral to recovery.</p>
      {!user && (
        <p className="actions">
          <Link className="btn-primary" to="/register">
            Create an account
          </Link>
          <Link to="/login">Sign in</Link>
        </p>
      )}
    </section>
  );
}

export function AccountPage() {
  const { user } = useAuth();
  return (
    <section aria-labelledby="account-title">
      <h1 id="account-title">Welcome, {user?.firstName}</h1>
      <p>You are signed in as {user?.email}.</p>
    </section>
  );
}

export function MediWayHomePage() {
  const { user } = useAuth();
  return (
    <section aria-labelledby="mediway-title">
      <h1 id="mediway-title">MediWay staff portal</h1>
      <p>
        Signed in as {user?.firstName} {user?.lastName} ({user?.roles.join(', ')}).
      </p>
    </section>
  );
}

export function ForbiddenPage() {
  return (
    <section aria-labelledby="forbidden-title">
      <h1 id="forbidden-title">You do not have access to this page</h1>
      <p>
        <Link to="/">Go to the home page</Link>
      </p>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <section aria-labelledby="nf-title">
      <h1 id="nf-title">Page not found</h1>
      <p>
        <Link to="/">Go to the home page</Link>
      </p>
    </section>
  );
}
