import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading }: Props) {
  const { color, gradient } = useTheme();
  const inactive = disabled || loading;

  const labelColor = {
    primary: color.white,
    secondary: color.text,
    ghost: color.textMuted,
    danger: color.danger,
  }[variant];

  const surface = {
    primary: {},
    secondary: { backgroundColor: color.surfaceRaised, borderWidth: 1, borderColor: color.border },
    ghost: { backgroundColor: 'transparent', height: 44 },
    danger: { backgroundColor: color.dangerSoft, borderWidth: 1, borderColor: color.dangerSoft },
  }[variant];

  const content = loading ? (
    <ActivityIndicator color={variant === 'primary' ? color.white : color.accent} />
  ) : (
    <Text style={[font.label, styles.label, { color: labelColor }]}>{label}</Text>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={inactive}
      style={({ pressed }) => [pressed && !inactive && styles.pressed, inactive && styles.inactive]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={gradient.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.base}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.base, surface]}>{content}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  label: { fontSize: 15, letterSpacing: 0.1 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  inactive: { opacity: 0.4 },
});
