import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Glow } from '@/components/Glow';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { space } from '@/theme';

/** Signed in goes to the app; everyone else goes to sign-in. */
export default function Index() {
  const { status } = useAuth();
  const { color } = useTheme();

  if (status === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: color.base }]}>
        <Glow y={0.5} size={1} />
        <Skeleton width={120} height={12} />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
});
