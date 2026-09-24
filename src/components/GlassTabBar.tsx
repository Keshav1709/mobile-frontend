import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { IconKey } from '@/lib/icons';
import { TAB_BAR_HEIGHT } from '@/lib/layout';
import { useTheme } from '@/state/theme';
import { family, font, radius, space } from '@/theme';

/** The props expo-router hands a custom tab bar (its bottom-tabs is vendored). */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** The only routes in the bar, in order. Everything else is reached from the menu. */
const TABS: { name: string; icon: IconKey; activeIcon: IconKey; label: string }[] = [
  { name: 'index', icon: 'home', activeIcon: 'homeActive', label: 'Home' },
  { name: 'live', icon: 'live', activeIcon: 'liveActive', label: 'Live' },
];
const TAB_WIDTH = 84;

/**
 * A floating glass capsule, exactly as wide as its tabs, centred at the
 * bottom of the screen. Replaces the navigator's own bar so nothing about
 * its position is left to default styles.
 */
export function GlassTabBar({ state, navigation }: TabBarProps) {
  const { color, scheme, gradient } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const dark = scheme === 'dark';

  // Expo Router strips `href: null` before the navigator sees it, so the bar
  // decides for itself: exactly these two, whatever else is registered.
  const routes = TABS.flatMap((tab) => {
    const route = state.routes.find((candidate) => candidate.name === tab.name);
    return route ? [{ ...tab, route }] : [];
  });
  const capsuleWidth = TAB_WIDTH * routes.length + 8;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.strip,
        {
          // Explicit screen width and an explicit left offset for the capsule:
          // centred by arithmetic on the window, not by whatever the parent's
          // flex layout happens to be.
          width: screenWidth,
          left: 0,
          bottom: Math.max(insets.bottom, space.md),
        },
      ]}
    >
      <View
        style={[
          styles.capsule,
          {
            width: capsuleWidth,
            marginLeft: (screenWidth - capsuleWidth) / 2,
            borderColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(26,15,24,0.14)',
            shadowColor: color.black,
            shadowOpacity: dark ? 0.5 : 0.14,
          },
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 70 : 100}
          tint={dark ? 'systemThickMaterialDark' : 'systemThickMaterialLight'}
          experimentalBlurMethod="dimezisBlurView"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)' },
          ]}
        />
        {/* A faint bloom of the brand gradient through the glass. */}
        <LinearGradient
          colors={[
            `${gradient.bloom[0]}${dark ? '2E' : '1A'}`,
            `${gradient.bloom[1]}${dark ? '14' : '0A'}`,
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Top-edge sheen: light catching the rim. */}
        <LinearGradient
          colors={[dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.row}>
          {routes.map(({ route, icon, activeIcon, label }) => {
            const focused = state.routes[state.index]?.key === route.key;
            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                onPress={onPress}
                style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              >
                {focused ? (
                  <LinearGradient
                    colors={gradient.accent}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconWrap}
                  >
                    <Icon name={activeIcon} size={18} color={color.white} />
                  </LinearGradient>
                ) : (
                  <View style={styles.iconWrap}>
                    <Icon name={icon} size={18} color={color.textFaint} />
                  </View>
                )}
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={[font.caption, styles.label, { color: focused ? color.accent : color.textFaint }]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full width, invisible; only its child is drawn — that is what centres it.
  strip: { position: 'absolute', zIndex: 10 },
  capsule: {
    height: TAB_BAR_HEIGHT,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tab: { width: TAB_WIDTH, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 44,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontFamily: family.medium },
});
