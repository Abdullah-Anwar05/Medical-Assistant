import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  hint?: string;
  error?: string;
}

/** Labelled input with hint and error wired up via aria-describedby. */
export function Field({ label, name, hint, error, ...input }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          <span className="visually-hidden">Error: </span>
          {error}
        </p>
      )}
      <input id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
    </div>
  );
}

/** Form-level error summary; focused on appearance so screen readers and keyboard users land on it. */
export const ErrorSummary = forwardRef<HTMLDivElement, { message: string }>(function ErrorSummary({ message }, ref) {
  return (
    <div ref={ref} className="error-summary" role="alert" tabIndex={-1}>
      <h2>There is a problem</h2>
      <p>{message}</p>
    </div>
  );
});
