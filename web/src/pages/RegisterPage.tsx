import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toFormError, type FormError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { ErrorSummary, Field } from '../components/Form';

/**
 * Version of the patient terms the user accepts. PLACEHOLDER: the real terms document and
 * its version are not defined yet (contract only requires the field).
 */
export const TERMS_VERSION = '2026-11-draft';
const MIN_PASSWORD = 12; // contract: minimum 12 characters, no other complexity rules

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) summaryRef.current?.focus();
  }, [error]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const v = (k: string) => String(data.get(k) ?? '').trim();
    const body = {
      firstName: v('firstName'),
      lastName: v('lastName'),
      email: v('email'),
      dateOfBirth: v('dateOfBirth'),
      password: String(data.get('password') ?? ''),
      acceptedTermsVersion: TERMS_VERSION,
    };
    const fields: Record<string, string> = {};
    if (!body.firstName) fields.firstName = 'Enter your first name.';
    if (!body.lastName) fields.lastName = 'Enter your last name.';
    if (!body.email) fields.email = 'Enter your email address.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth)) fields.dateOfBirth = 'Enter your date of birth.';
    if (body.password.length < MIN_PASSWORD) fields.password = `Password must be at least ${MIN_PASSWORD} characters.`;
    if (data.get('terms') !== 'on') fields.terms = 'You must accept the terms to continue.';
    if (Object.keys(fields).length) {
      setError({ message: 'Please correct the highlighted fields.', fields });
      return;
    }
    setSubmitting(true);
    try {
      await register(body);
      navigate('/account', { replace: true });
    } catch (err) {
      setError(toFormError(err, 'register'));
    } finally {
      setSubmitting(false);
    }
  }

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
          hint={`At least ${MIN_PASSWORD} characters. A short phrase of several words works well.`}
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
