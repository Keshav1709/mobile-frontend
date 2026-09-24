import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { IconKey } from '@/lib/icons';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Props = {
  icon: IconKey;
  title: string;
  hint?: string;
  /** Usually one Button. */
  action?: ReactNode;
  /** 'error' for a failed load, 'offline' when a service can't be reached. */
  tone?: 'empty' | 'error' | 'offline';
};

/** Nothing here yet, something failed, or nothing reachable: one shape for all three. */
export function EmptyState({ icon, title, hint, action, tone = 'empty' }: Props) {
  const { color } = useTheme();
  const fg = tone === 'error' ? color.danger : tone === 'offline' ? color.textMuted : color.accent;
  const bg = tone === 'error' ? color.dangerSoft : tone === 'offline' ? color.surfaceRaised : color.accentSoft;
  return (
    <View style={[styles.wrap, { borderColor: color.border }]}>
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Icon name={icon} size={24} color={fg} />
      </View>
      <Text style={[font.heading, styles.centre, { color: color.text }]}>{title}</Text>
      {hint ? <Text style={[font.caption, styles.centre, { color: color.textMuted }]}>{hint}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.xl,
  },
  badge: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  centre: { textAlign: 'center', maxWidth: 300 },
  action: { marginTop: space.sm, alignSelf: 'stretch' },
});
