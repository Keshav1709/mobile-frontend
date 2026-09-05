import Svg, { Ellipse, G } from 'react-native-svg';
import { StyleSheet, View, ViewStyle } from 'react-native';

const RINGS = 9;

/** Topographic line texture. Sits behind hero content at low opacity. */
export function Contours({ style, opacity = 0.16 }: { style?: ViewStyle; opacity?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 200 200">
        <G opacity={opacity}>
          {Array.from({ length: RINGS }, (_, index) => {
            const step = index / RINGS;
            return (
              <Ellipse
                key={index}
                cx={150 - step * 22}
                cy={44 + step * 16}
                rx={24 + step * 78}
                ry={17 + step * 54}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={0.5}
                transform={`rotate(${-18 - step * 10} ${150 - step * 22} ${44 + step * 16})`}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
