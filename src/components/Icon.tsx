import { Ionicons } from '@expo/vector-icons';

import { IconKey, icons } from '@/lib/icons';
import { useTheme } from '@/state/theme';

type Props = { name: IconKey; size?: number; color?: string };

/** A crisp vector icon by meaning; defaults to the text colour of the theme. */
export function Icon({ name, size = 20, color }: Props) {
  const { color: palette } = useTheme();
  return <Ionicons name={icons[name]} size={size} color={color ?? palette.text} />;
}
