import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '@/state/theme';

/**
 * The faint dot grid behind the board's panels.
 *
 * Drawn as a tiled SVG pattern rather than a hundred views, so it costs one
 * node however large the card is. It sits under the content and never
 * intercepts touches.
 */
export function DotField({ spacing = 16, style }: { spacing?: number; style?: ViewStyle }) {
  const { color, scheme } = useTheme();
  // Just visible on white, a touch stronger on the dark ground where the
  // surrounding surface is closer to the dot's own value.
  const dot = scheme === 'dark' ? 'rgba(246,245,244,0.10)' : 'rgba(30,32,31,0.10)';

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="dots"
            x="0"
            y="0"
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <Circle cx={1} cy={1} r={1} fill={dot} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#dots)" />
      </Svg>
    </View>
  );
}
