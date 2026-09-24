import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { haptic } from '@/lib/haptics';
import { IconKey } from '@/lib/icons';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Props = {
  tone: 'info' | 'error' | 'success';
  title: string;
  message?: string;
  /**
   * What to run when the person presses Try again. A banner that reports a
   * failure and offers no way out of it is a dead end, so anything that can
   * be retried should pass this.
   */
  onRetry?: () => void;
  /** Wording for the retry control, when "Try again" is not what it does. */
  retryLabel?: string;
};

export function Banner({ tone, title, message, onRetry, retryLabel = 'Try again' }: Props) {
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
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={() => {
            haptic.tap();
            onRetry();
          }}
          style={({ pressed }) => [
            styles.retry,
            { borderColor: palette.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="refresh" size={15} color={palette.fg} />
          <Text style={[font.label, styles.retryLabel, { color: palette.fg }]}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 11 },
  retry: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  retryLabel: { fontSize: 13 },
});
