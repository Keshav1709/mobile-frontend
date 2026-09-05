import { ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glow } from '@/components/Glow';
import { IconButton } from '@/components/IconButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';

type Props = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  glow?: boolean;
  /** Extra control shown left of the theme toggle, e.g. a settings gear. */
  action?: ReactNode;
  /** Renders a back control left of the title. */
  onBack?: () => void;
  /** Hides the theme toggle where a parent already renders one. */
  hideToggle?: boolean;
};

export function Screen({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
  glow = true,
  action,
  onBack,
  hideToggle,
}: Props) {
  const { color } = useTheme();
  const body = <View style={styles.body}>{children}</View>;

  return (
    <View style={[styles.root, { backgroundColor: color.base }]}>
      {glow ? <Glow y={0.08} size={1.1} opacity={0.4} /> : null}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {title || action || !hideToggle ? (
            <View style={styles.header}>
              {onBack ? <IconButton glyph="‹" label="Go back" onPress={onBack} /> : null}
              <View style={styles.headingText}>
                {eyebrow ? (
                  <Text style={[font.eyebrow, { color: color.textFaint }]}>{eyebrow}</Text>
                ) : null}
                {title ? <Text style={[font.title, { color: color.text }]}>{title}</Text> : null}
                {subtitle ? (
                  <Text style={[font.body, styles.subtitle, { color: color.textMuted }]}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <View style={styles.actions}>
                {action}
                {hideToggle ? null : <ThemeToggle />}
              </View>
            </View>
          ) : null}

          {scroll ? (
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <Pressable onPress={Keyboard.dismiss} style={styles.dismiss}>
                {body}
              </Pressable>
            </ScrollView>
          ) : (
            body
          )}

          {footer ? (
            <View style={[styles.footer, { borderTopColor: color.border }]}>{footer}</View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.lg,
  },
  headingText: { flex: 1, gap: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: 2 },
  subtitle: { marginTop: 2 },
  scroll: { flexGrow: 1 },
  dismiss: { flex: 1 },
  body: { flex: 1, paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.md },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
