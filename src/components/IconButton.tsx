import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/state/theme';
import { radius } from '@/theme';

type Props = {
  glyph: string;
  label: string;
  onPress: () => void;
  /** Draws the button in its accent state, for toggles that are on. */
  active?: boolean;
  /** Passed through for switches and expandable panels. */
  accessibilityRole?: 'button' | 'switch';
  expanded?: boolean;
  checked?: boolean;
};

/** The round header control: theme toggle, back, camera settings. */
export function IconButton({
  glyph,
  label,
  onPress,
  active,
  accessibilityRole = 'button',
  expanded,
  checked,
}: Props) {
  const { color } = useTheme();

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityState={{ expanded, checked }}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: active ? color.accentSoft : color.surfaceRaised,
          borderColor: active ? color.accent : color.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.glyph, { color: active ? color.accent : color.text }]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 16 },
  pressed: { opacity: 0.7 },
});
