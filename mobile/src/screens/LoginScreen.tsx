import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ApiError, userMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner, Field, LinkButton, PrimaryButton, Screen, Title } from '../components/ui';

export function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = 'Enter your email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setBanner(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await login({ email: email.trim(), password });
    } catch (e) {
      setBanner(userMessage(e, 'login'));
      if (e instanceof ApiError && e.status === 400) setErrors(e.fieldErrors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Sign in to MediPath</Title>
      <ErrorBanner message={banner} />
      <Field
        label="Email address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      <PrimaryButton label="Sign in" onPress={submit} busy={busy} />
      <LinkButton label="Create an account" onPress={() => router.push('/register')} />
    </Screen>
  );
}
