import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, createDefaultClient } from '../src/auth/AuthContext';

export default function RootLayout() {
  const [client] = useState(createDefaultClient);
  return (
    <SafeAreaProvider>
      <AuthProvider client={client}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
