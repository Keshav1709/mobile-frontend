import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { Glow } from '@/components/Glow';
import { useTheme } from '@/state/theme';
import { radius, space } from '@/theme';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  glow?: boolean;
  /** Tints the glow and left edge, for category colour. */
  tint?: string;
  style?: ViewStyle;
};

export function Card({ children, onPress, glow, tint, style }: Props) {
  const { color } = useTheme();

  const box = [
    styles.card,
    { backgroundColor: color.surface, borderColor: color.border },
    style,
  ];

  const inner = (
    <>
      {glow ? <Glow tint={tint} x={0.85} y={0.1} size={0.8} /> : null}
      <View style={styles.content}>{children}</View>
    </>
  );

  if (!onPress) return <View style={box}>{inner}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [...box, pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  content: { padding: space.lg, gap: space.sm },
  pressed: { opacity: 0.85 },
});
