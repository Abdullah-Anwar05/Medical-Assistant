import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createDefaultSession } from '../src/api/session';
import { AuthProvider } from '../src/auth/AuthContext';

export default function RootLayout() {
  const [sessions] = useState(createDefaultSession);
  return (
    <SafeAreaProvider>
      <AuthProvider sessions={sessions}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
