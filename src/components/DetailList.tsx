import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

export type Detail = { label: string; value: string | null | undefined };

/** A grouped list of label/value rows. Quieter than a card per fact. */
export function DetailList({ title, rows }: { title?: string; rows: Detail[] }) {
  const { color } = useTheme();

  return (
    <View style={styles.group}>
      {title ? <Text style={[font.eyebrow, { color: color.textFaint }]}>{title}</Text> : null}
      <View style={[styles.list, { backgroundColor: color.surface, borderColor: color.border }]}>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
            ]}
          >
            <Text style={[font.caption, styles.label, { color: color.textMuted }]}>
              {row.label}
            </Text>
            <Text style={[font.label, styles.value, { color: color.text }]}>
              {row.value || 'Not set'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.md },
  list: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.md,
    minHeight: 48,
  },
  label: { flexShrink: 0 },
  value: { flex: 1, textAlign: 'right' },
});
