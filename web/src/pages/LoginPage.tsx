import { Link } from 'react-router-dom';
import { ErrorSummary, Field } from '../components/Form';
import { useLoginForm } from '../hooks/useLoginForm';

export function LoginPage({ area }: { area: 'patient' | 'staff' }) {
  const { error, submitting, summaryRef, onSubmit } = useLoginForm();
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
