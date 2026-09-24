import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Dimensions, Easing, StyleSheet, useColorScheme, View } from 'react-native';

import { gradientFor, Palette, palettes, Scheme } from '@/theme';

const MODE_KEY = 'zeroforg.theme_mode';
const REVEAL_MS = 520;

/** 'auto' follows the phone's own appearance setting. */
export type ThemeMode = 'light' | 'dark' | 'auto';

type ThemeValue = {
  mode: ThemeMode;
  scheme: Scheme;
  color: Palette;
  gradient: ReturnType<typeof gradientFor>;
  setMode: (mode: ThemeMode) => void;
  /** Flips between light and dark, leaving 'auto' behind. */
  toggle: () => void;
  /**
   * Flips like `toggle`, but reveals the new theme as a circle spreading out
   * from the given window point — the control the person just pressed.
   */
  toggleFrom: (x: number, y: number) => void;
};

type RevealState = { x: number; y: number; to: Scheme; progress: Animated.Value; fade: Animated.Value };

const ThemeContext = createContext<ThemeValue | null>(null);
const RevealContext = createContext<RevealState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // Follow the phone's own appearance setting until someone picks a theme
  // in Settings; that choice is restored from SecureStore just below.
  const [mode, setModeState] = useState<ThemeMode>('auto');
  const [reveal, setReveal] = useState<{ x: number; y: number; to: Scheme } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    SecureStore.getItemAsync(MODE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'auto') setModeState(stored);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    SecureStore.setItemAsync(MODE_KEY, next).catch(() => undefined);
  }, []);

  const scheme: Scheme = mode === 'auto' ? (system === 'light' ? 'light' : 'dark') : mode;

  const toggleFrom = useCallback(
    (x: number, y: number) => {
      if (reveal) return; // one at a time
      const to: Scheme = scheme === 'dark' ? 'light' : 'dark';
      setReveal({ x, y, to });
      progress.setValue(0);
      fade.setValue(1);
      // The circle grows in the new theme's ground colour until it covers the
      // screen; only then does the palette switch underneath, so nothing
      // flashes. The disc then fades away over the already-switched page.
      Animated.timing(progress, {
        toValue: 1,
        duration: REVEAL_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setMode(to);
        Animated.timing(fade, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start(() => setReveal(null));
      });
    },
    [reveal, scheme, setMode, progress, fade],
  );

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      scheme,
      color: palettes[scheme],
      gradient: gradientFor(scheme),
      setMode,
      toggle: () => setMode(scheme === 'dark' ? 'light' : 'dark'),
      toggleFrom,
    }),
    [mode, scheme, setMode, toggleFrom],
  );

  const revealState = useMemo<RevealState | null>(
    () => (reveal ? { ...reveal, progress, fade } : null),
    [reveal, progress, fade],
  );

  return (
    <ThemeContext.Provider value={value}>
      <RevealContext.Provider value={revealState}>
        {children}
        <ThemeReveal />
      </RevealContext.Provider>
    </ThemeContext.Provider>
  );
}

/**
 * The spreading disc, sized to reach the farthest screen corner from its
 * origin. Rendered once at the root; a native Modal sits above that layer, so
 * anything modal that hosts a toggle renders it again inside itself.
 */
export function ThemeReveal() {
  const reveal = useContext(RevealContext);
  if (!reveal) return null;
  const { x, y, to, progress, fade } = reveal;
  const { width, height } = Dimensions.get('window');
  const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 8;
  const size = radius * 2;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={{
          position: 'absolute',
          left: x - radius,
          top: y - radius,
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: palettes[to].base,
          opacity: fade,
          transform: [{ scale: progress }],
        }}
      />
    </View>
  );
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider.');
  return value;
}
