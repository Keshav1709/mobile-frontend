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
  const { color, scheme } = useTheme();

  // At rest a card is exactly the dashboard's: a hairline border, the card
  // colour, and the faintest lift (its `box-shadow: 0 1px 2px rgba(0,0,0,.03)`).
  // The gold ring is the dashboard's *interaction* state, so it is reserved for
  // cards that opt into `glow` rather than applied to every surface.
  const ring = tint ?? color.accentBright;
  const box = [
    styles.card,
    {
      backgroundColor: color.surface,
      borderColor: glow ? color.accentLine : color.border,
      shadowColor: glow ? ring : color.black,
      shadowOpacity: glow ? (scheme === 'dark' ? 0.18 : 0.22) : 0.03,
      shadowRadius: glow ? 12 : 2,
      shadowOffset: { width: 0, height: 1 },
      // Android has no coloured shadow; the border and the bloom carry it there.
      elevation: glow ? 2 : 0,
    },
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
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
});
