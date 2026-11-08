import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toFormError, type FormError } from '../api/errors';
import { STAFF_ROLES, type UserProfile } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ErrorSummary, Field } from '../components/Form';

export function homeFor(user: UserProfile): string {
  return user.roles.some((r) => STAFF_ROLES.includes(r)) ? '/mediway' : '/account';
}

export function LoginPage({ area }: { area: 'patient' | 'staff' }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [error, setError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) summaryRef.current?.focus();
  }, [error]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const fields: Record<string, string> = {};
    if (!email) fields.email = 'Enter your email address.';
    if (!password) fields.password = 'Enter your password.';
    if (Object.keys(fields).length) {
      setError({ message: 'Please correct the highlighted fields.', fields });
      return;
    }
    setSubmitting(true);
    try {
      const user = await login({ email, password });
      navigate(from ?? homeFor(user), { replace: true });
    } catch (err) {
      setError(toFormError(err, 'login'));
    } finally {
      setSubmitting(false);
    }
  }

  const title = area === 'staff' ? 'Sign in to MediWay' : 'Sign in to MediPath';
  return (
    <section className="card" aria-labelledby="login-title">
      <h1 id="login-title">{title}</h1>
      {error && <ErrorSummary ref={summaryRef} message={error.message} />}
      <form onSubmit={onSubmit} noValidate>
        <Field label="Email address" name="email" type="email" autoComplete="username" error={error?.fields.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          error={error?.fields.password}
        />
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {area === 'patient' && (
        <p>
          New to MediPath? <Link to="/register">Create an account</Link>
        </p>
      )}
    </section>
  );
}
