import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

/**
 * Shown once, at the top of every screen, while the phone has no route to the
 * internet. Screens still render what they have; this says why nothing new
 * is arriving, so each of them does not have to.
 */
export function OfflineBanner() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  if (!offline) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + space.sm }]}>
      <View
        accessibilityRole="alert"
        style={[styles.pill, { backgroundColor: color.surfaceRaised, borderColor: color.border }]}
      >
        <Icon name="offline" size={16} color={color.textMuted} />
        <Text style={[font.caption, { color: color.textMuted }]}>No internet connection</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 25 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 8,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
