import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/state/theme';
import { font, hue, radius, space } from '@/theme';

const PLANNED = [
  { title: 'Person and vehicle detection', tint: hue.lime },
  { title: 'Zone intrusion alerts', tint: hue.pink },
  { title: 'Loitering and crowd analysis', tint: hue.violet },
  { title: 'Natural-language footage search', tint: hue.orange },
];

export default function AiFeatures() {
  const { color } = useTheme();

  return (
    <Screen
      eyebrow="Intelligence"
      title="AI features"
      subtitle="Detection and analysis running on your cameras."
    >
      <Pill label="Coming soon" tone="accent" dot />

      {PLANNED.map((feature) => (
        <Card key={feature.title} glow tint={feature.tint}>
          <View style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: feature.tint }]} />
            <Text style={[font.heading, styles.title, { color: color.text }]}>{feature.title}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  swatch: { width: 10, height: 34, borderRadius: radius.sm },
  title: { flex: 1 },
});
