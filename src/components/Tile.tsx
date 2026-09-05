import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { DotNumber } from '@/components/DotNumber';
import { Glow } from '@/components/Glow';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Props = {
  title: string;
  caption?: string;
  onPress?: () => void;
  /** Fills the tile with the accent gradient. */
  featured?: boolean;
  /** Renders the title as perforated numerals. */
  numeric?: boolean;
  /** Wash colour for a plain tile's bloom and numerals. */
  tint?: string;
  children?: ReactNode;
  style?: ViewStyle;
};

/** Bento tile with a corner affordance. Presses in slightly when touched. */
export function Tile({
  title,
  caption,
  onPress,
  featured,
  numeric,
  tint,
  children,
  style,
}: Props) {
  const { color, gradient } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const press = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  const body = (
    <>
      {featured ? null : <Glow tint={tint} x={0.85} y={0.9} size={1} />}
      <View style={styles.inner}>
        <View style={styles.top}>
          {children}
          {onPress ? (
            <View
              style={[
                styles.arrow,
                { backgroundColor: featured ? 'rgba(255,255,255,0.22)' : color.surfaceRaised },
              ]}
            >
              <Text
                style={[styles.arrowGlyph, { color: featured ? color.white : color.textMuted }]}
              >
                ↗
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.bottom}>
          {numeric ? (
            <DotNumber value={title} size={40} tint={tint ?? color.accent} />
          ) : (
            <Text style={[font.heading, { color: featured ? color.white : color.text }]}>
              {title}
            </Text>
          )}
          {caption ? (
            <Text
              style={[
                font.caption,
                { color: featured ? 'rgba(255,255,255,0.82)' : color.textMuted },
              ]}
            >
              {caption}
            </Text>
          ) : null}
        </View>
      </View>
    </>
  );

  const shell = [
    styles.tile,
    { borderColor: featured ? 'transparent' : color.border },
    !featured && { backgroundColor: color.surface },
    style,
  ];

  const content = featured ? (
    <LinearGradient
      colors={gradient.accent}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  ) : null;

  if (!onPress) {
    return (
      <View style={shell}>
        {content}
        {body}
      </View>
    );
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, styles.grow, style]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
        style={[...shell, styles.fill]}
      >
        {content}
        {body}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  fill: { flex: 1 },
  tile: {
    flex: 1,
    minHeight: 132,
    borderRadius: radius.xxl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inner: { flex: 1, padding: space.lg, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  bottom: { gap: 4 },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlyph: { fontSize: 15, fontWeight: '600' },
});
