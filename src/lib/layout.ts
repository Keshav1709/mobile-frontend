import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/theme';

/** Height of the floating tab bar in `app/(tabs)/_layout.tsx`. */
export const TAB_BAR_HEIGHT = 58;

/** Screen gutter: the left/right margin of every header, body and footer. */
export const GUTTER = space.xl;
/** Distance from the safe-area top to the header row. */
export const HEADER_TOP = space.lg;
/** The menu button's fixed home, measured from the safe-area edges. */
export const MENU_SLOT = { top: HEADER_TOP, left: GUTTER };

/** Bottom padding a tab screen needs so its last content clears the floating bar. */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, space.md) + space.md;
}
