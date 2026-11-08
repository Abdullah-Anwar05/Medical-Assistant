import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';

export default function AppLayout() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
