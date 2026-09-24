import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { IconKey } from '@/lib/icons';
import { TAB_BAR_HEIGHT } from '@/lib/layout';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Tone = 'success' | 'info' | 'error';
type Toast = { id: number; message: string; tone: Tone };
type ToastValue = { show: (message: string, tone?: Tone) => void };

const ToastContext = createContext<ToastValue | null>(null);
const SHOW_MS = 2600;

/** Brief confirmations at the bottom of the screen, above the tab bar. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: Tone = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    counter.current += 1;
    setToast({ id: counter.current, message, tone });
    timer.current = setTimeout(() => setToast(null), SHOW_MS);
  }, []);

  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastView toast={toast} />
    </ToastContext.Provider>
  );
}

function ToastView({ toast }: { toast: Toast | null }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<Toast | null>(toast);
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (toast) {
      setCurrent(toast);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(lift, { toValue: 12, duration: 180, useNativeDriver: true }),
      ]).start(() => setCurrent(null));
    }
  }, [toast, opacity, lift]);

  if (!current) return null;
  const icon: IconKey = current.tone === 'success' ? 'checkCircle' : current.tone === 'error' ? 'warning' : 'info';
  const fg = current.tone === 'success' ? color.success : current.tone === 'error' ? color.danger : color.accent;
  return (
    <View pointerEvents="none" style={[styles.host, { bottom: Math.max(insets.bottom, space.md) + TAB_BAR_HEIGHT + space.md }]}>
      <Animated.View
        accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: color.surfaceRaised, borderColor: color.border, opacity, transform: [{ translateY: lift }] }]}
      >
        <Icon name={icon} size={18} color={fg} />
        <Text numberOfLines={2} style={[font.label, styles.text, { color: color.text }]}>{current.message}</Text>
      </Animated.View>
    </View>
  );
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider.');
  return value;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: '86%',
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { flexShrink: 1 },
});
