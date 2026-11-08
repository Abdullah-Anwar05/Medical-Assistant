import { normalizeRegisterInput, validateRegister, type RegisterInput } from '@medipath/client-core';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { TERMS_VERSION } from '../config';
import { useAuthSubmit } from './useAuthSubmit';

type RegisterFields = Omit<RegisterInput, 'acceptedTerms'>;

const EMPTY: RegisterFields = { firstName: '', lastName: '', email: '', password: '', dateOfBirth: '' };

export function useRegisterForm() {
  const { register } = useAuth();
  const [form, setForm] = useState<RegisterFields>(EMPTY);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { errors, banner, busy, run } = useAuthSubmit('register');

  const setField = (key: keyof RegisterFields) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const input = { ...form, acceptedTerms };
    return run(validateRegister(input), () => {
      const { acceptedTerms: _accepted, ...body } = normalizeRegisterInput(input);
      return register({ ...body, acceptedTermsVersion: TERMS_VERSION });
    });
  };

  return { form, setField, acceptedTerms, setAcceptedTerms, errors, banner, busy, submit };
}
