import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/state/theme';
import { radius, space } from '@/theme';

/** A placeholder block with a slow shimmer. Size it like the content it stands in for. */
export function Skeleton({ width, height = 16, style }: { width?: number | `${number}%`; height?: number; style?: ViewStyle }) {
  const { color, scheme } = useTheme();
  const x = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1400, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const translateX = x.interpolate({ inputRange: [-1, 1], outputRange: [-200, 200] });
  const sheen = scheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.7)';
  return (
    <View style={[styles.block, { width: width ?? '100%', height, backgroundColor: color.surfaceRaised }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={['transparent', sheen, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/**
 * A card-shaped skeleton: title line, caption lines.
 *
 * Size it like the card it stands in for. A placeholder is only useful if the
 * content lands where it was, otherwise the list jumps the moment it loads.
 */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  const { color } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
      <Skeleton width="60%" height={18} />
      {Array.from({ length: lines - 1 }, (_, index) => (
        <Skeleton key={index} width={index % 2 ? '35%' : '80%'} height={12} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: radius.sm, overflow: 'hidden' },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: space.lg, gap: space.sm },
});
