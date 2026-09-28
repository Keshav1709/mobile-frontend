import { Tabs } from 'expo-router';

import { GlassTabBar } from '@/components/GlassTabBar';
import { useTheme } from '@/state/theme';

/**
 * Home, Live and Alerts in a floating glass capsule at the bottom (see
 * GlassTabBar). Everything else lives in the burger menu.
 *
 * Alerts is in the bar because it is the product. It sat behind the drawer
 * with eleven other destinations, which meant the one screen that says
 * something happened took two taps and prior knowledge to reach.
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
      <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
      {/* Reachable from the menu, not the bar. */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
    </Tabs>
  );
}
