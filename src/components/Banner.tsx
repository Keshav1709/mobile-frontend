import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { IconKey } from '@/lib/icons';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Props = {
  tone: 'info' | 'error' | 'success';
  title: string;
  message?: string;
};

export function Banner({ tone, title, message }: Props) {
  const { color } = useTheme();
  const palette = {
    info: { bg: color.accentSoft, border: color.accentLine, fg: color.accent },
    error: { bg: color.dangerSoft, border: color.danger, fg: color.danger },
    success: { bg: color.successSoft, border: color.success, fg: color.success },
  }[tone];
  const icon = ({ info: 'info', error: 'warning', success: 'checkCircle' } as const satisfies Record<typeof tone, IconKey>)[tone];

  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <View style={styles.titleRow}>
        <Icon name={icon} size={16} color={palette.fg} />
        <Text style={[font.eyebrow, styles.title, { color: palette.fg }]}>{title}</Text>
      </View>
      {message ? <Text style={[font.body, { color: color.text }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 11 },
});
