import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/IconButton';
import { ThemeReveal, useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the content, above the home indicator. */
  footer?: ReactNode;
};

/**
 * The app's one modal pattern: a sheet that rises from the bottom over a
 * dimmed page, with a grab handle, a title row and a close control in the
 * same place every time. Content scrolls; the footer stays put.
 */
export function BottomSheet({ visible, onClose, title, subtitle, children, footer }: Props) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const rise = useRef(new Animated.Value(height)).current;
  const dim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(rise, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dim, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(rise, {
          toValue: height,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible, mounted, rise, dim, height]);

  if (!mounted) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: dim }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: color.surface,
            borderColor: color.border,
            maxHeight: height - insets.top - space.xxl,
            paddingBottom: Math.max(insets.bottom, space.md),
            transform: [{ translateY: rise }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: color.borderStrong }]} />
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text numberOfLines={1} style={[font.title, { color: color.text }]}>{title}</Text>
            {subtitle ? (
              <Text numberOfLines={1} style={[font.caption, { color: color.textMuted }]}>{subtitle}</Text>
            ) : null}
          </View>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {children}
        </ScrollView>
        {footer ? <View style={[styles.footer, { borderTopColor: color.border }]}>{footer}</View> : null}
      </Animated.View>
      <ThemeReveal />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingTop: space.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.pill, marginBottom: space.md },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  titleText: { flex: 1, gap: 2 },
  content: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.lg },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
