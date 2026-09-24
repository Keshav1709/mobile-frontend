import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { IconKey } from '@/lib/icons';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Row = {
  icon?: IconKey;
  label: string;
  /** Secondary text under the label. */
  hint?: string;
  /** Right-hand value, or a control (switch, segmented). */
  value?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'danger';
};

/**
 * The settings row: icon, label, value or control, chevron when it navigates.
 * Same height and rhythm everywhere so a list reads as one object.
 */
export function ListRow({ icon, label, hint, value, right, onPress, tone = 'default' }: Row) {
  const { color } = useTheme();
  const fg = tone === 'danger' ? color.danger : color.text;
  const body = (
    <>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: tone === 'danger' ? color.dangerSoft : color.surfaceRaised, borderColor: color.border }]}>
          <Icon name={icon} size={18} color={tone === 'danger' ? color.danger : color.accent} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[font.body, { color: fg }]}>{label}</Text>
        {hint ? <Text numberOfLines={2} style={[font.caption, { color: color.textMuted }]}>{hint}</Text> : null}
      </View>
      {right ?? (value !== undefined ? (
        <Text numberOfLines={1} style={[font.label, styles.value, { color: color.textMuted }]}>
          {value || 'Not set'}
        </Text>
      ) : null)}
      {onPress && !right ? <Icon name="forward" size={18} color={color.textFaint} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.accentSoft }]}
    >
      {body}
    </Pressable>
  );
}

/** Rows grouped under an eyebrow, on one surface. */
export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.group}>
      {title ? <Text style={[font.eyebrow, styles.groupTitle, { color: color.textFaint }]}>{title}</Text> : null}
      <View style={[styles.surface, { backgroundColor: color.surface, borderColor: color.border }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  groupTitle: { paddingHorizontal: space.xs },
  surface: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  iconWrap: { width: 32, height: 32, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  value: { flexShrink: 1, maxWidth: '55%', textAlign: 'right' },
});
