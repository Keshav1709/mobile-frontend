import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/state/theme';

/**
 * The brand mark: a glossy sphere built from layered radial gradients.
 * Pure SVG, so it stays crisp at any size and costs no image asset.
 */
export function Orb({ size = 200 }: { size?: number }) {
  const { color } = useTheme();

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
            <Stop offset="55%" stopColor={color.accent} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={color.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="body" cx="38%" cy="32%" r="72%">
            <Stop offset="0%" stopColor="#FFE3F1" stopOpacity={0.95} />
            <Stop offset="28%" stopColor={color.accentBright} stopOpacity={0.9} />
            <Stop offset="62%" stopColor="#C0288C" stopOpacity={0.95} />
            <Stop offset="100%" stopColor="#12040C" stopOpacity={1} />
          </RadialGradient>
          <RadialGradient id="rim" cx="62%" cy="78%" r="46%">
            <Stop offset="0%" stopColor="#FF9A5C" stopOpacity={0.6} />
            <Stop offset="100%" stopColor="#FF9A5C" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="highlight" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Circle cx="50" cy="50" r="49" fill="url(#halo)" />
        <Circle cx="50" cy="50" r="34" fill="url(#body)" />
        <Circle cx="50" cy="50" r="34" fill="url(#rim)" />
        <Ellipse cx="39" cy="33" rx="12" ry="8" fill="url(#highlight)" transform="rotate(-24 39 33)" />
        <Circle cx="50" cy="50" r="34" fill="none" stroke={color.accentLine} strokeWidth={0.4} />
      </Svg>
    </View>
  );
}
