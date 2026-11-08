import { useLocation, useNavigate } from 'react-router-dom';
import { isStaff, validateLogin, type LoginRequest, type UserProfile } from '@medipath/client-core';
import { useAuth } from '../auth/AuthContext';
import { fieldValue, passwordValue, useAuthForm, type AuthFormState } from './useAuthForm';

export function homeFor(user: UserProfile): string {
  return isStaff(user) ? '/mediway' : '/account';
}

/** Login form: returns to the page that sent the user here, else the user's home area. */
export function useLoginForm(): AuthFormState {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return useAuthForm<LoginRequest>({
    flow: 'login',
    read: (data) => ({ email: fieldValue(data, 'email'), password: passwordValue(data) }),
    validate: validateLogin,
    async submit(values) {
      const user = await login(values);
      navigate(from ?? homeFor(user), { replace: true });
    },
  });
}
