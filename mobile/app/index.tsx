import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/auth/AuthContext';
import { colors } from '../src/theme';

export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator accessibilityLabel="Loading" color={colors.navy} />
      </View>
    );
  }
  return <Redirect href={status === 'signedIn' ? '/home' : '/login'} />;
}
