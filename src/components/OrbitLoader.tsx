import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse } from 'react-native-svg';

import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';

/**
 * The web console's orbit loader, in React Native.
 *
 * A dot travelling a tilted ellipse with a darkening arc behind it, ported from
 * `zeroforg-frontend/src/components/attendance/loaders.tsx` so the phone and
 * the board wait in the same way. The web's reason for choosing CSS transforms
 * applies doubly here: a loader is on screen exactly when the JS thread is busy
 * fetching and parsing, so the rotation runs on the native driver and keeps
 * turning through work that would stall an interpolation done in JS.
 */

export function OrbitLoader({ size = 56, tint }: { size?: number; tint?: string }) {
  const { color } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  const [still, setStill] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (alive) setStill(reduce);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin, still]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ink = tint ?? color.accent;

  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar">
      {/* The whole drawing turns rather than a group inside it: react-native-svg
          will not take a style transform on <G>, and rotating the view keeps
          the animation on the native driver where it belongs. */}
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* The path the dot travels. */}
          <Ellipse
            cx="50"
            cy="50"
            rx="38"
            ry="24"
            stroke={ink}
            strokeOpacity={0.22}
            strokeWidth={3}
            fill="none"
            transform="rotate(-20 50 50)"
          />
          {/* The trail, about a third of the ellipse, so the dot always has
              visible weight behind it. */}
          <Ellipse
            cx="50"
            cy="50"
            rx="38"
            ry="24"
            stroke={ink}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray="60 200"
            fill="none"
            transform="rotate(-20 50 50)"
          />
          <Circle cx="88" cy="50" r="6" fill={ink} transform="rotate(-20 50 50)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * Full panel wait, loader over a caption.
 *
 * Used instead of a skeleton on the dense boards, for the reason the web gives:
 * a skeleton of a slab of numbers is a grey approximation of a grey design, and
 * reads as broken rather than as pending.
 */
export function BoardLoading({ message = 'Reading today’s attendance' }: { message?: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.panel}>
      <OrbitLoader size={56} />
      <Text style={[font.eyebrow, styles.caption, { color: color.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    paddingHorizontal: space.xl,
  },
  caption: { textAlign: 'center' },
});
