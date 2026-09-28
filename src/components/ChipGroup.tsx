import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Props = {
  label: string;
  options: readonly string[];
  value: string | null;
  onChange: (value: string) => void;
  required?: boolean;
};

/** Single-select chips, where a picker would be heavier than the choice. */
export function ChipGroup({ label, options, value, onChange, required }: Props) {
  const { color } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[font.eyebrow, { color: color.textFaint }]}>
        {label}
        {required ? <Text style={{ color: color.danger }}> *</Text> : null}
      </Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${option}`}
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? color.accentSoft : color.surface,
                  borderColor: active ? color.accent : color.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[font.label, styles.text, { color: active ? color.accent : color.textMuted }]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  text: { fontSize: 14 },
  pressed: { opacity: 0.8 },
});
