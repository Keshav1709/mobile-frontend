import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMenu } from '@/components/AppMenu';
import { IconButton } from '@/components/IconButton';
import { MENU_SLOT } from '@/lib/layout';
import { useAuth } from '@/state/auth';

type MenuValue = { open: () => void; close: () => void; isOpen: boolean };

const MenuContext = createContext<MenuValue | null>(null);

/** The slide-in navigation drawer, opened from the burger on any main screen. */
export function MenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);
  return (
    <MenuContext.Provider value={value}>
      {children}
      <MenuButton onPress={open} />
      <AppMenu visible={isOpen} onClose={close} />
    </MenuContext.Provider>
  );
}

/**
 * The burger. Rendered once, above every screen, at one fixed spot: the same
 * distance from the top and left edges no matter which page is showing or
 * how that page lays out its header. Screens leave that corner empty.
 */
function MenuButton({ onPress }: { onPress: () => void }) {
  const { status } = useAuth();
  const insets = useSafeAreaInsets();
  if (status !== 'signedIn') return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.slot, { top: insets.top + MENU_SLOT.top, left: MENU_SLOT.left }]}
    >
      <IconButton icon="menu" label="Open menu" onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', zIndex: 20 },
});

export function useMenu(): MenuValue {
  const value = useContext(MenuContext);
  if (!value) throw new Error('useMenu must be used inside MenuProvider.');
  return value;
}
