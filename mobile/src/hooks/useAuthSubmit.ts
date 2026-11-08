import { hasErrors, toFormError, type AuthFlow, type FieldErrors } from '@medipath/client-core';
import { useState } from 'react';

/** Shared validate → submit → map-errors flow for the auth forms. */
export function useAuthSubmit(flow: AuthFlow) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(validationErrors: FieldErrors, request: () => Promise<void>): Promise<void> {
    setErrors(validationErrors);
    setBanner(null);
    if (hasErrors(validationErrors)) return;

    setBusy(true);
    try {
      await request();
    } catch (e) {
      const formError = toFormError(e, flow);
      setBanner(formError.message);
      setErrors(formError.fields);
    } finally {
      setBusy(false);
    }
  }

  return { errors, banner, busy, run };
}
