import { validateLogin } from '@medipath/client-core';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAuthSubmit } from './useAuthSubmit';

export function useLoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { errors, banner, busy, run } = useAuthSubmit('login');

  const submit = () => run(validateLogin({ email, password }), () => login({ email: email.trim(), password }));

  return { email, setEmail, password, setPassword, errors, banner, busy, submit };
}
