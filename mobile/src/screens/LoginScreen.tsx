import { useRouter } from 'expo-router';
import { ErrorBanner, Field, LinkButton, PrimaryButton, Screen, Title } from '../components/ui';
import { useLoginForm } from '../hooks/useLoginForm';

export function LoginScreen() {
  const router = useRouter();
  const { email, setEmail, password, setPassword, errors, banner, busy, submit } = useLoginForm();

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
