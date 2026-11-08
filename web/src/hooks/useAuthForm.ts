import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { CORRECT_FIELDS_MESSAGE, hasErrors, toFormError, type AuthFlow, type FieldErrors, type FormError } from '@medipath/client-core';

export interface AuthFormState {
  error: FormError | null;
  submitting: boolean;
  /** Attach to the error summary; it is focused whenever an error appears. */
  summaryRef: RefObject<HTMLDivElement>;
  onSubmit(e: FormEvent<HTMLFormElement>): void;
}

interface AuthFormConfig<T> {
  flow: AuthFlow;
  read(data: FormData): T;
  validate(values: T): FieldErrors;
  submit(values: T): Promise<void>;
}

/** Shared submit cycle for auth forms: read, validate client-side, call the API, map failures to messages. */
export function useAuthForm<T>({ flow, read, validate, submit }: AuthFormConfig<T>): AuthFormState {
  const [error, setError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) summaryRef.current?.focus();
  }, [error]);

  async function run(form: HTMLFormElement) {
    const values = read(new FormData(form));
    const fields = validate(values);
    if (hasErrors(fields)) {
      setError({ message: CORRECT_FIELDS_MESSAGE, fields });
      return;
    }
    setSubmitting(true);
    try {
      await submit(values);
    } catch (err) {
      setError(toFormError(err, flow));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    error,
    submitting,
    summaryRef,
    onSubmit(e) {
      e.preventDefault();
      void run(e.currentTarget);
    },
  };
}

export function fieldValue(data: FormData, name: string): string {
  return String(data.get(name) ?? '').trim();
}

/** Passwords are never trimmed: spaces are valid characters. */
export function passwordValue(data: FormData, name = 'password'): string {
  return String(data.get(name) ?? '');
}
