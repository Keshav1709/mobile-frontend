import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Props = {
  label: string;
  tone?: 'neutral' | 'accent' | 'live' | 'idle';
  dot?: boolean;
  /** Overrides the tone with a category hue. */
  tint?: string;
};

export function Pill({ label, tone = 'neutral', dot, tint }: Props) {
  const { color } = useTheme();

  const palette = {
    neutral: { bg: color.surfaceRaised, fg: color.textMuted },
    accent: { bg: color.accentSoft, fg: color.accent },
    live: { bg: color.successSoft, fg: color.success },
    idle: { bg: color.surfaceRaised, fg: color.textFaint },
  }[tone];

  const foreground = tint ?? palette.fg;

  return (
    <View style={[styles.pill, { backgroundColor: tint ? `${tint}22` : palette.bg }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: foreground }]} /> : null}
      <Text style={[font.caption, styles.label, { color: foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  label: { fontSize: 12, fontWeight: '600' },
});
