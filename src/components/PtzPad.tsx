import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { IconKey } from '@/lib/icons';
import type { Direction } from '@/onvif/ptz';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Props = {
  onStart: (direction: Direction) => void;
  onStop: () => void;
  disabled?: boolean;
  busy?: Direction | null;
};

const ICONS: Record<Direction, IconKey> = {
  up: 'collapse',
  down: 'expand',
  left: 'back',
  right: 'forward',
};

/**
 * Directional pad. Movement is held: press starts a continuous pan, release
 * stops it, which is how ONVIF PTZ is meant to be driven.
 */
export function PtzPad({ onStart, onStop, disabled, busy }: Props) {
  const { color } = useTheme();

  const key = (direction: Direction) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pan ${direction}`}
      disabled={disabled}
      onPressIn={() => onStart(direction)}
      onPressOut={onStop}
      style={({ pressed }) => [
        styles.key,
        {
          backgroundColor: busy === direction || pressed ? color.accentSoft : color.surface,
          borderColor: busy === direction || pressed ? color.accent : color.border,
        },
        disabled && styles.disabled,
      ]}
    >
      <Icon name={ICONS[direction]} size={22} color={disabled ? color.textFaint : color.text} />
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <Text style={[font.eyebrow, { color: color.textFaint }]}>Camera control</Text>
      <View style={styles.pad}>
        <View style={styles.row}>{key('up')}</View>
        <View style={styles.row}>
          {key('left')}
          <View style={[styles.hub, { borderColor: color.border, backgroundColor: color.surfaceSunken }]}>
            <View style={[styles.hubDot, { backgroundColor: color.accent }]} />
          </View>
          {key('right')}
        </View>
        <View style={styles.row}>{key('down')}</View>
      </View>
      {disabled ? (
        <Text style={[font.caption, styles.note, { color: color.textFaint }]}>
          This camera doesn't support pan and tilt.
        </Text>
      ) : null}
    </View>
  );
}

const KEY = 58;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  pad: { alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  key: {
    width: KEY,
    height: KEY,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hub: {
    width: KEY,
    height: KEY,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubDot: { width: 8, height: 8, borderRadius: radius.pill },
  disabled: { opacity: 0.45 },
  note: { textAlign: 'center' },
});
