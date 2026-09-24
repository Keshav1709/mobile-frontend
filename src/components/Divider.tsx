import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';

/** A rule with a small label through it — "or continue with". */
export function Divider({ label }: { label: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.rule, { backgroundColor: color.border }]} />
      <Text style={[font.eyebrow, styles.label, { color: color.textFaint }]}>{label}</Text>
      <View style={[styles.rule, { backgroundColor: color.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  label: { fontSize: 10 },
});
