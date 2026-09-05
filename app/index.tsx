import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Glow } from '@/components/Glow';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';

/** Sends the user to the first step they have not completed. */
export default function Index() {
  const { status, user } = useAuth();
  const { color } = useTheme();

  if (status === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: color.base }]}>
        <Glow y={0.5} size={1} />
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (!user?.profile_completed) return <Redirect href="/create-profile" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
