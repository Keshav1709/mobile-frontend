import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AgentProvider } from '@/state/agent';
import { AuthProvider } from '@/state/auth';
import { OnboardingProvider } from '@/state/onboarding';
import { ThemeProvider, useTheme } from '@/state/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AgentProvider>
            <OnboardingProvider>
              <Shell />
            </OnboardingProvider>
          </AgentProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Inside the provider so the status bar and canvas follow the active scheme. */
function Shell() {
  const { scheme, color } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.base } }}
      />
    </>
  );
}
