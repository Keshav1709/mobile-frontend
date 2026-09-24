import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/state/theme';

type Props = {
  tint?: string;
  /** 0-1 across the parent box. */
  x?: number;
  y?: number;
  size?: number;
  opacity?: number;
  style?: ViewStyle;
};

/**
 * Soft radial bloom behind content. Drawn as SVG because React Native has no
 * radial gradient, and it carries most of the depth in the dark theme.
 */
export function Glow({ tint, x = 0.5, y = 0.35, size = 0.9, opacity, style }: Props) {
  const { color } = useTheme();
  // The palette decides what the bloom is made of: gold on the dark ground,
  // a warm near-white on the light one. That white bloom is what makes the
  // light scheme read as lit rather than merely pale, so it is deliberately
  // far stronger than a tint of the accent would be.
  const fill = tint ?? color.glow;
  const strength = opacity ?? color.glowStrength;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={fill} stopOpacity={strength} />
            <Stop offset="55%" stopColor={fill} stopOpacity={strength * 0.28} />
            <Stop offset="100%" stopColor={fill} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={x * 100} cy={y * 100} rx={size * 70} ry={size * 55} fill="url(#bloom)" />
      </Svg>
    </View>
  );
}
