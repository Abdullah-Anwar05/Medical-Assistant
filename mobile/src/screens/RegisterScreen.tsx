import { useRouter } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { ErrorBanner, Field, LinkButton, PrimaryButton, Screen, Title } from '../components/ui';
import { useRegisterForm } from '../hooks/useRegisterForm';
import { spacing, type } from '../theme';
import { MIN_PASSWORD_LENGTH, palette } from '@medipath/client-core';

export function RegisterScreen() {
  const router = useRouter();
  const { form, setField, acceptedTerms, setAcceptedTerms, errors, banner, busy, submit } = useRegisterForm();

  // Client validation reports `terms`; a 400 from the API reports `acceptedTermsVersion`.
  const termsError = errors.terms ?? errors.acceptedTermsVersion;

  return (
    <Screen>
      <Title>Create your MediPath account</Title>
      <ErrorBanner message={banner} />
      <Field label="First name" value={form.firstName} onChangeText={setField('firstName')} error={errors.firstName} autoComplete="given-name" textContentType="givenName" />
      <Field label="Last name" value={form.lastName} onChangeText={setField('lastName')} error={errors.lastName} autoComplete="family-name" textContentType="familyName" />
      <Field
        label="Email address"
        value={form.email}
        onChangeText={setField('email')}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
      />
      <Field
        label="Password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters. A short phrase works well.`}
        value={form.password}
        onChangeText={setField('password')}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Field
        label="Date of birth"
        hint="YYYY-MM-DD, for example 1980-04-23"
        value={form.dateOfBirth}
        onChangeText={setField('dateOfBirth')}
        error={errors.dateOfBirth}
        keyboardType="numbers-and-punctuation"
        autoComplete="birthdate-full"
      />
      <View style={styles.terms}>
        <Switch
          accessibilityLabel="I accept the MediPath terms of use and privacy notice"
          value={acceptedTerms}
          onValueChange={setAcceptedTerms}
          trackColor={{ true: palette.teal700, false: palette.border }}
        />
        <Text style={[type.body, styles.termsText]}>I accept the MediPath terms of use and privacy notice</Text>
      </View>
      {termsError ? <Text style={styles.err}>{termsError}</Text> : null}
      <PrimaryButton label="Create account" onPress={submit} busy={busy} />
      <LinkButton label="I already have an account" onPress={() => router.replace('/login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  terms: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  termsText: { flex: 1 },
  err: { color: palette.error, fontSize: 14 },
});
