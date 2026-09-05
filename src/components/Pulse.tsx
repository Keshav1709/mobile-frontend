import { ReactNode, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  /** Full cycle in milliseconds. */
  duration?: number;
  /** How far it dims at the trough. */
  min?: number;
  style?: ViewStyle;
};

/**
 * A slow breathing opacity, for live indicators and ambient glows.
 * Holds still when the viewer has asked for reduced motion.
 */
export function Pulse({ children, duration = 2200, min = 0.45, style }: Props) {
  const value = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: min,
            duration: duration / 2,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 1,
            duration: duration / 2,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });

    return () => loop?.stop();
  }, [value, duration, min]);

  return <Animated.View style={[style, { opacity: value }]}>{children}</Animated.View>;
}
