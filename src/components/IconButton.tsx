import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { IconKey } from '@/lib/icons';
import { useTheme } from '@/state/theme';
import { radius } from '@/theme';

/** Every round header control is this size, so it lands under the same thumb. */
export const ICON_BUTTON_SIZE = 44;

type Props = {
  icon: IconKey;
  label: string;
  onPress: () => void;
  /** Draws the button in its accent state, for toggles that are on. */
  active?: boolean;
  /** Passed through for switches and expandable panels. */
  accessibilityRole?: 'button' | 'switch';
  expanded?: boolean;
  checked?: boolean;
};

/** The round header control: menu, back, camera settings. 44 pt: a real tap target. */
export function IconButton({
  icon,
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
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: active ? color.accentSoft : color.surfaceRaised,
          borderColor: active ? color.accent : color.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={20} color={active ? color.accent : color.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
