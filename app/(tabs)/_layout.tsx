import { Tabs } from 'expo-router';

import { GlassTabBar } from '@/components/GlassTabBar';
import { useTheme } from '@/state/theme';

/**
 * Two tabs — Home and Live — in a floating glass capsule centred at the
 * bottom (see GlassTabBar). Everything else lives in the burger menu; those
 * routes stay registered but keep out of the bar.
 */
export default function TabsLayout() {
  const { color } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.base } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="live" options={{ title: 'Live' }} />
      {/* Reachable from the menu, not the bar (GlassTabBar only draws Home and Live). */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="alerts" options={{ href: null }} />
    </Tabs>
  );
}
