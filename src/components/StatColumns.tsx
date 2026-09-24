import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';

export type Stat = { label: string; value: string; tone?: 'default' | 'good' };

/**
 * The board's divided stat strip — ON TIME | AVG ARRIVAL | GREETINGS — with a
 * hairline between each column and the figures set in mono.
 */
export function StatColumns({ stats }: { stats: Stat[] }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      {stats.map((stat, index) => (
        <View
          key={stat.label}
          style={[
            styles.column,
            index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: color.border },
          ]}
        >
          <Text style={[font.eyebrow, { color: color.textFaint }]} numberOfLines={1}>
            {stat.label}
          </Text>
          <Text
            style={[
              font.figureSmall,
              { color: stat.tone === 'good' ? color.success : color.text },
            ]}
          >
            {stat.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  column: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.md, gap: space.xs },
});
