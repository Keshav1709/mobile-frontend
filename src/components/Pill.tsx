import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Pulse } from '@/components/Pulse';
import { IconKey } from '@/lib/icons';

import { useTheme } from '@/state/theme';
import { family, font, radius, space } from '@/theme';

type Props = {
  label: string;
  tone?: 'neutral' | 'accent' | 'live' | 'idle' | 'warning' | 'danger';
  dot?: boolean;
  /** Overrides the tone with a category hue. */
  tint?: string;
  /** Leading icon, e.g. a check on a "Ready" state. */
  icon?: IconKey;
};

export function Pill({ label, tone = 'neutral', dot, tint, icon }: Props) {
  const { color } = useTheme();

  const palette = {
    neutral: { bg: color.surfaceRaised, fg: color.textMuted },
    accent: { bg: color.accentSoft, fg: color.accent },
    live: { bg: color.successSoft, fg: color.success },
    idle: { bg: color.surfaceRaised, fg: color.textFaint },
    warning: { bg: color.warningSoft, fg: color.warningText },
    danger: { bg: color.dangerSoft, fg: color.dangerText },
  }[tone];

  const foreground = tint ?? palette.fg;

  return (
    <View style={[styles.pill, { backgroundColor: tint ? `${tint}22` : palette.bg }]}>
      {dot ? (
        <Pulse duration={1800} min={0.3}>
          <View style={[styles.dot, { backgroundColor: foreground }]} />
        </Pulse>
      ) : null}
      {icon ? <Icon name={icon} size={13} color={foreground} /> : null}
      <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[font.caption, styles.label, { color: foreground }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  label: { fontSize: 12, fontFamily: family.medium },
});
