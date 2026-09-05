import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { gradientFor, Palette, palettes, Scheme } from '@/theme';

const MODE_KEY = 'zeroforg.theme_mode';

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
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

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

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      scheme,
      color: palettes[scheme],
      gradient: gradientFor(scheme),
      setMode,
      toggle: () => setMode(scheme === 'dark' ? 'light' : 'dark'),
    }),
    [mode, scheme, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider.');
  return value;
}
