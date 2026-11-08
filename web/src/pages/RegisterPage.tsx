import { Link } from 'react-router-dom';
import { MIN_PASSWORD_LENGTH } from '@medipath/client-core';
import { ErrorSummary, Field } from '../components/Form';
import { useRegisterForm } from '../hooks/useRegisterForm';

export function RegisterPage() {
  const { error, submitting, summaryRef, onSubmit } = useRegisterForm();
  const f = error?.fields;
  return (
    <section className="card" aria-labelledby="register-title">
      <h1 id="register-title">Create your MediPath account</h1>
      {error && <ErrorSummary ref={summaryRef} message={error.message} />}
      <form onSubmit={onSubmit} noValidate>
        <Field label="First name" name="firstName" autoComplete="given-name" error={f?.firstName} />
        <Field label="Last name" name="lastName" autoComplete="family-name" error={f?.lastName} />
        <Field label="Email address" name="email" type="email" autoComplete="email" error={f?.email} />
        <Field label="Date of birth" name="dateOfBirth" type="date" autoComplete="bday" error={f?.dateOfBirth} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. A short phrase of several words works well.`}
          error={f?.password}
        />
        <div className="field checkbox">
          {f?.terms && (
            <p id="terms-error" className="field-error">
              <span className="visually-hidden">Error: </span>
              {f.terms}
            </p>
          )}
          <input
            id="terms"
            name="terms"
            type="checkbox"
            aria-invalid={f?.terms ? true : undefined}
            aria-describedby={f?.terms ? 'terms-error' : undefined}
          />
          <label htmlFor="terms">I accept the MediPath terms of use and privacy notice</label>
        </div>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </section>
  );
}
