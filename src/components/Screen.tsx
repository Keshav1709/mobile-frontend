import { ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glow } from '@/components/Glow';
import { ICON_BUTTON_SIZE, IconButton } from '@/components/IconButton';
import { GUTTER, HEADER_TOP, useTabBarClearance } from '@/lib/layout';
import { useAuth } from '@/state/auth';
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
  /** Unused since the menu button became a fixed overlay; kept for callers. */
  hideMenu?: boolean;
  /** The screen sits under the floating tab bar; pad the bottom so nothing hides behind it. */
  tabBar?: boolean;
  /** Pull-to-refresh control for the scroll view. */
  refreshControl?: ScrollViewProps['refreshControl'];
  /** Larger title, for a screen's landing page (Home). */
  titleSize?: 'title' | 'display';
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
  hideMenu,
  tabBar,
  refreshControl,
  titleSize = 'title',
}: Props) {
  const { color } = useTheme();
  const { status } = useAuth();
  const clearance = useTabBarClearance();
  // The burger lives in a fixed overlay (see MenuProvider); this row keeps
  // its corner clear so nothing ever draws under it.
  const reserveMenuSlot = status === 'signedIn';
  const bottomPad = tabBar ? clearance : 0;
  const body = (
    <View style={[styles.body, tabBar && !footer && { paddingBottom: bottomPad }]}>{children}</View>
  );

  return (
    <View style={[styles.root, { backgroundColor: color.base }]}>
      {glow ? <Glow y={0.08} size={1.1} opacity={0.4} /> : null}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {title || action || onBack || reserveMenuSlot ? (
            <View style={styles.header}>
              {reserveMenuSlot ? <View style={styles.menuSlot} /> : null}
              {onBack ? <IconButton icon="back" label="Go back" onPress={onBack} /> : null}
              <View style={styles.headingText}>
                {eyebrow ? (
                  <Text style={[font.eyebrow, { color: color.textFaint }]}>{eyebrow}</Text>
                ) : null}
                {title ? (
                  <Text style={[titleSize === 'display' ? font.display : font.title, { color: color.text }]}>
                    {title}
                  </Text>
                ) : null}
                {subtitle ? (
                  <Text style={[font.body, styles.subtitle, { color: color.textMuted }]}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {action ? <View style={styles.actions}>{action}</View> : null}
            </View>
          ) : null}

          {scroll ? (
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              refreshControl={refreshControl}
            >
              <Pressable onPress={Keyboard.dismiss} style={styles.dismiss}>
                {body}
              </Pressable>
            </ScrollView>
          ) : (
            body
          )}

          {footer ? (
            <View
              style={[
                styles.footer,
                { borderTopColor: color.border },
                tabBar && { paddingBottom: bottomPad },
              ]}
            >
              {footer}
            </View>
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
    paddingHorizontal: GUTTER,
    paddingTop: HEADER_TOP,
    paddingBottom: space.lg,
  },
  menuSlot: { width: ICON_BUTTON_SIZE, height: ICON_BUTTON_SIZE },
  headingText: { flex: 1, gap: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: 2 },
  subtitle: { marginTop: 2 },
  scroll: { flexGrow: 1 },
  dismiss: { flex: 1 },
  body: { flex: 1, paddingHorizontal: GUTTER, paddingBottom: space.lg, gap: space.md },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
