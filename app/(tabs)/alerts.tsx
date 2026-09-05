import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

export default function Alerts() {
  const { color } = useTheme();

  return (
    <Screen
      eyebrow="Activity"
      title="Alerts & reports"
      subtitle="Events from your cameras will appear here."
    >
      <View
        style={[styles.empty, { borderColor: color.border }]}
      >
        <Text style={[font.heading, { color: color.text }]}>Nothing yet</Text>
        <Text style={[font.caption, styles.text, { color: color.textMuted }]}>
          Once detection is enabled, alerts and daily reports will be listed here.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xxxl,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.xl,
  },
  text: { textAlign: 'center' },
});
