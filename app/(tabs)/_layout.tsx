import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/state/theme';
import { font } from '@/theme';

const ICONS = { live: '▣', profile: '◍', ai: '✦', alerts: '☰' } as const;

function TabIcon({ name, focused }: { name: keyof typeof ICONS; focused: boolean }) {
  const { color } = useTheme();
  return (
    <Text style={[styles.icon, { color: focused ? color.accent : color.textFaint }]}>
      {ICONS[name]}
    </Text>
  );
}

export default function TabsLayout() {
  const { color } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textFaint,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 84,
          paddingTop: 8,
        },
        tabBarLabelStyle: { ...font.caption, fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Live',
          tabBarIcon: ({ focused }) => <TabIcon name="live" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI',
          tabBarIcon: ({ focused }) => <TabIcon name="ai" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => <TabIcon name="alerts" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 18 },
});
