import { ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  FlatList,
  FlatListProps,
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
  /**
   * A floating status line, centred near the top of the screen.
   *
   * For the refresh note, which used to sit in the scrolling content and so
   * pushed the page down as it appeared and scrolled away while it was still
   * true. Here it is outside the scroll view: it holds its position, it does not
   * move anything under it, and it is the only refresh indicator on screen.
   * Taps pass straight through it.
   */
  notice?: ReactNode;
  /** Larger title, for a screen's landing page (Home). */
  titleSize?: 'title' | 'display';
  /**
   * Render a long list virtually instead of a plain scroll view.
   *
   * A screen whose list can grow without bound should pass this rather than
   * mapping rows into `children`: a ScrollView builds every row up front, so a
   * few hundred of them block the first paint and then keep the memory. With
   * `list` the rows come from `data`/`renderItem` and `children` becomes the
   * header above them, which is what keeps the two from being nested — a
   * virtualised list inside a scroll view loses the virtualisation entirely.
   */
  list?: {
    data: readonly unknown[];
    renderItem: FlatListProps<never>['renderItem'];
    keyExtractor: (item: never, index: number) => string;
    /** Shown under the rows, e.g. a "load more" control or an empty state. */
    footer?: ReactNode;
  };
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
  notice,
  titleSize = 'title',
  list,
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

          <View style={styles.content}>
          {list ? (
            <FlatList
              data={list.data as never[]}
              renderItem={list.renderItem as FlatListProps<never>['renderItem']}
              keyExtractor={list.keyExtractor}
              ListHeaderComponent={<>{body}</>}
              ListFooterComponent={list.footer ? <>{list.footer}</> : null}
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              refreshControl={refreshControl}
              // Rows leave the window entirely on a phone, so dropping them is
              // free; the rest are the defaults tuned down for image-heavy rows.
              removeClippedSubviews
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
            />
          ) : scroll ? (
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

          {/* Over the content, not in it: anchored to the top of the scrolling
              region so it clears a header of any height, and ignoring touches so
              it never takes a tap meant for what is underneath. */}
          {notice ? (
            <View style={styles.notice} pointerEvents="none">
              {notice}
            </View>
          ) : null}
          </View>

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
  /** Holds the scroll view, and gives the floating notice something to sit in. */
  content: { flex: 1 },
  notice: { position: 'absolute', top: space.sm, left: 0, right: 0, alignItems: 'center' },
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
