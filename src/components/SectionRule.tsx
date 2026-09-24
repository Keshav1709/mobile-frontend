import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';

type Props = {
  /** Shown in caps with wide tracking, after the leading dash. */
  label: string;
  /** Right-hand meta, set in mono: "0 · 0%", "all CoEs · 0 today". */
  meta?: string;
  /** A line under the label, muted and monospaced. */
  subtitle?: string;
  /** Sits between the dash and the label — the board uses medals here. */
  glyph?: ReactNode;
};

/**
 * The board's section header: an em-dash rule, then the title in letterspaced
 * caps, with optional monospaced meta pushed to the right.
 *
 *     — WHO'S IN TODAY                          all CoEs · 0 today
 *       CoE Gurgaon · 0 present · 20 out
 *
 * This is the single most recognisable thing about the dashboard's layout, so
 * it lives in one component rather than being re-typed per screen.
 */
export function SectionRule({ label, meta, subtitle, glyph }: Props) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.dash, { backgroundColor: color.text }]} />
        {glyph ? <View style={styles.glyph}>{glyph}</View> : null}
        <Text style={[font.eyebrow, styles.label, { color: color.text }]} numberOfLines={2}>
          {label}
        </Text>
        {meta ? (
          <Text style={[font.mono, { color: color.textFaint }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {subtitle ? (
        <Text style={[font.mono, styles.subtitle, { color: color.textFaint }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // The rule itself: short, the weight of the type beside it.
  dash: { width: 14, height: 1.5, borderRadius: 1 },
  glyph: { marginRight: -2 },
  label: { flexShrink: 1 },
  subtitle: { marginLeft: 22 },
});
