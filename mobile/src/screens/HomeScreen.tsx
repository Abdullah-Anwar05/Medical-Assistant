import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton, Screen, Title } from '../components/ui';
import { type } from '../theme';

export function HomeScreen() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  return (
    <Screen>
      <Title>Hello{user ? `, ${user.firstName}` : ''}</Title>
      <Text style={type.body}>Your surgical pathway will appear here.</Text>
      <PrimaryButton
        label="Sign out"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await logout();
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
