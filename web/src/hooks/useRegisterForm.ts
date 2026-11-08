import { useNavigate } from 'react-router-dom';
import { validateRegister, type RegisterInput } from '@medipath/client-core';
import { useAuth } from '../auth/AuthContext';
import { fieldValue, passwordValue, useAuthForm, type AuthFormState } from './useAuthForm';

/**
 * Version of the patient terms the user accepts. PLACEHOLDER: the real terms document and
 * its version are not defined yet (contract only requires the field).
 */
export const TERMS_VERSION = '2026-11-draft';

export function useRegisterForm(): AuthFormState {
  const { register } = useAuth();
  const navigate = useNavigate();

  return useAuthForm<RegisterInput>({
    flow: 'register',
    read: (data) => ({
      firstName: fieldValue(data, 'firstName'),
      lastName: fieldValue(data, 'lastName'),
      email: fieldValue(data, 'email'),
      dateOfBirth: fieldValue(data, 'dateOfBirth'),
      password: passwordValue(data),
      acceptedTerms: data.get('terms') === 'on',
    }),
    validate: validateRegister,
    async submit({ firstName, lastName, email, dateOfBirth, password }) {
      await register({ firstName, lastName, email, dateOfBirth, password, acceptedTermsVersion: TERMS_VERSION });
      navigate('/account', { replace: true });
    },
  });
}
