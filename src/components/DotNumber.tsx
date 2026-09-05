import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/state/theme';
import { shade } from '@/theme';

/**
 * Perforated numerals, drawn as a 3x5 dot grid per digit.
 *
 * Lit dots carry the value; unlit ones stay faintly visible so the figure reads
 * as a display rather than plain text.
 */

// Each row is three bits, most significant on the left.
const GLYPHS: Record<string, number[]> = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b010, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
};

const COLS = 3;
const ROWS = 5;

type Props = {
  value: number | string;
  /** Height of the digits in points. */
  size?: number;
  tint?: string;
};

export function DotNumber({ value, size = 44, tint }: Props) {
  const { color, scheme } = useTheme();
  const base = tint ?? color.accent;
  // The hues are picked for a dark ground; on white they need deepening, and
  // the unlit dots need real weight or the figure disappears into the card.
  const lit = scheme === 'light' ? shade(base, -0.45) : base;
  const unlit = scheme === 'light' ? color.textFaint : color.borderStrong;
  const unlitOpacity = scheme === 'light' ? 0.28 : 0.35;

  const digits = String(value).split('').filter((char) => char in GLYPHS);
  if (!digits.length) return null;

  const step = size / ROWS;
  const radius = step * 0.3;
  const digitWidth = COLS * step;
  const gap = step * 0.8;
  const width = digits.length * digitWidth + (digits.length - 1) * gap;

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={size} viewBox={`0 0 ${width} ${size}`}>
        {digits.map((digit, index) => {
          const originX = index * (digitWidth + gap);
          return GLYPHS[digit].map((row, y) =>
            Array.from({ length: COLS }, (_, x) => {
              const on = (row >> (COLS - 1 - x)) & 1;
              return (
                <Circle
                  key={`${index}-${y}-${x}`}
                  cx={originX + x * step + step / 2}
                  cy={y * step + step / 2}
                  r={radius}
                  fill={on ? lit : unlit}
                  opacity={on ? 1 : unlitOpacity}
                />
              );
            }),
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
});
