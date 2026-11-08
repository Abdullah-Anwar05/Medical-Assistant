import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { ApiError, userMessage } from '../api/errors';
import type { RegisterRequest } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner, Field, LinkButton, PrimaryButton, Screen, Title } from '../components/ui';
import { TERMS_VERSION } from '../config';
import { colors, spacing, type } from '../theme';

const MIN_PASSWORD = 12; // contract: minimum 12 characters, no other complexity rules

export function isValidPastDate(value: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value) && d.getTime() < today.getTime();
}

export function validateRegistration(f: Omit<RegisterRequest, 'acceptedTermsVersion'>, acceptedTerms: boolean) {
  const e: Record<string, string> = {};
  if (!f.firstName.trim()) e.firstName = 'Enter your first name.';
  if (!f.lastName.trim()) e.lastName = 'Enter your last name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
  if (f.password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
  if (!isValidPastDate(f.dateOfBirth)) e.dateOfBirth = 'Enter your date of birth as YYYY-MM-DD.';
  if (!acceptedTerms) e.acceptedTermsVersion = 'You need to accept the terms to continue.';
  return e;
}

export function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', dateOfBirth: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    const next = validateRegistration(form, acceptedTerms);
    setErrors(next);
    setBanner(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await register({
        ...form,
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        acceptedTermsVersion: TERMS_VERSION,
      });
    } catch (e) {
      setBanner(userMessage(e, 'register'));
      if (e instanceof ApiError && e.status === 400) setErrors(e.fieldErrors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Create your MediPath account</Title>
      <ErrorBanner message={banner} />
      <Field label="First name" value={form.firstName} onChangeText={set('firstName')} error={errors.firstName} autoComplete="given-name" textContentType="givenName" />
      <Field label="Last name" value={form.lastName} onChangeText={set('lastName')} error={errors.lastName} autoComplete="family-name" textContentType="familyName" />
      <Field
        label="Email address"
        value={form.email}
        onChangeText={set('email')}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
      />
      <Field
        label="Password"
        hint={`At least ${MIN_PASSWORD} characters. A short phrase works well.`}
        value={form.password}
        onChangeText={set('password')}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Field
        label="Date of birth"
        hint="YYYY-MM-DD, for example 1980-04-23"
        value={form.dateOfBirth}
        onChangeText={set('dateOfBirth')}
        error={errors.dateOfBirth}
        keyboardType="numbers-and-punctuation"
        autoComplete="birthdate-full"
      />
      <View style={styles.terms}>
        <Switch
          accessibilityLabel="I accept the MediPath terms of use and privacy notice"
          value={acceptedTerms}
          onValueChange={setAcceptedTerms}
          trackColor={{ true: colors.teal, false: colors.border }}
        />
        <Text style={[type.body, styles.termsText]}>I accept the MediPath terms of use and privacy notice</Text>
      </View>
      {errors.acceptedTermsVersion ? <Text style={styles.err}>{errors.acceptedTermsVersion}</Text> : null}
      <PrimaryButton label="Create account" onPress={submit} busy={busy} />
      <LinkButton label="I already have an account" onPress={() => router.replace('/login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  terms: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  termsText: { flex: 1 },
  err: { color: colors.error, fontSize: 14 },
});
