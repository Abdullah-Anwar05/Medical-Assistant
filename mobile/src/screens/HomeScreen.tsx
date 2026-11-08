import { Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton, Screen, Title } from '../components/ui';
import { useSignOut } from '../hooks/useSignOut';
import { type } from '../theme';

export function HomeScreen() {
  const { user } = useAuth();
  const { busy, signOut } = useSignOut();

  return (
    <Screen>
      <Title>Hello{user ? `, ${user.firstName}` : ''}</Title>
      <Text style={type.body}>Your surgical pathway will appear here.</Text>
      <PrimaryButton label="Sign out" busy={busy} onPress={signOut} />
    </Screen>
  );
}
