import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, minTouch, spacing, type } from '../theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={type.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export function Field({ label, error, hint, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      {hint ? <Text style={type.hint}>{hint}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
      {error ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!busy, busy: !!busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.banner} accessible accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.lg, gap: spacing.md },
  field: { gap: spacing.xs },
  input: {
    minHeight: minTouch,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 17,
    color: colors.navy,
  },
  inputError: { borderColor: colors.error, borderWidth: 2 },
  fieldError: { color: colors.error, fontSize: 14 },
  button: {
    minHeight: minTouch,
    borderRadius: 8,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonPressed: { backgroundColor: colors.tealDark },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: '600' },
  link: { minHeight: minTouch, justifyContent: 'center', alignItems: 'center' },
  linkText: { color: colors.teal, fontSize: 17, fontWeight: '600', textDecorationLine: 'underline' },
  banner: { backgroundColor: colors.errorBg, borderLeftWidth: 4, borderLeftColor: colors.error, padding: spacing.md },
  bannerText: { color: colors.error, fontSize: 15 },
});
