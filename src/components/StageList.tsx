import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

export type StageState = 'pending' | 'active' | 'done' | 'failed';

export type Stage = { key: string; label: string; state: StageState };

/** Discovery and connect checklists. States come from the camera, never a timer. */
export function StageList({ stages }: { stages: Stage[] }) {
  const { color } = useTheme();

  return (
    <View
      style={[styles.list, { backgroundColor: color.surface, borderColor: color.border }]}
    >
      {stages.map((stage, index) => (
        <View key={stage.key} style={styles.row}>
          <View style={styles.rail}>
            <Mark state={stage.state} />
            {index < stages.length - 1 ? (
              <View
                style={[
                  styles.line,
                  { backgroundColor: stage.state === 'done' ? color.accent : color.border },
                ]}
              />
            ) : null}
          </View>
          <Text
            style={[
              font.body,
              styles.text,
              {
                color: stage.state === 'pending' ? color.textFaint : color.text,
                fontWeight: stage.state === 'active' ? '600' : '400',
              },
            ]}
          >
            {stage.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Mark({ state }: { state: StageState }) {
  const { color } = useTheme();

  if (state === 'active') {
    return (
      <View style={styles.mark}>
        <ActivityIndicator size="small" color={color.accent} />
      </View>
    );
  }

  const done = state === 'done';
  const failed = state === 'failed';
  const fill = done ? color.success : failed ? color.danger : 'transparent';

  return (
    <View
      style={[
        styles.mark,
        styles.dot,
        { backgroundColor: fill, borderColor: done || failed ? fill : color.borderStrong },
      ]}
    >
      {done || failed ? (
        <Text style={[styles.glyph, { color: color.white }]}>{done ? '✓' : '!'}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, borderRadius: radius.xl, borderWidth: 1 },
  row: { flexDirection: 'row', gap: space.lg },
  rail: { alignItems: 'center', width: 26 },
  mark: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 1.5, marginVertical: 4 },
  dot: { borderRadius: radius.pill, borderWidth: 1.5 },
  glyph: { fontSize: 13, fontWeight: '700' },
  text: { paddingTop: 3, paddingBottom: space.lg },
});
