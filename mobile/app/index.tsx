import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/auth/AuthContext';
import { palette } from '@medipath/client-core';

export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.neutral50 }}>
        <ActivityIndicator accessibilityLabel="Loading" color={palette.navy900} />
      </View>
    );
  }
  return <Redirect href={status === 'signedIn' ? '/home' : '/login'} />;
}
