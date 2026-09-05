import { IconButton } from '@/components/IconButton';
import { useTheme } from '@/state/theme';

/** The persistent light/dark switch, top-right on every screen. */
export function ThemeToggle() {
  const { scheme, toggle } = useTheme();
  return (
    <IconButton
      accessibilityRole="switch"
      glyph={scheme === 'dark' ? '☾' : '☀'}
      label={scheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      checked={scheme === 'dark'}
      onPress={toggle}
    />
  );
}
