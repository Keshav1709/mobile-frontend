import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/OfflineBanner';
import { AgentProvider } from '@/state/agent';
import { AuthProvider } from '@/state/auth';
import { ConsoleProvider } from '@/state/console';
import { LiveProvider } from '@/state/live';
import { MenuProvider } from '@/state/menu';
import { OnboardingProvider } from '@/state/onboarding';
import { ThemeProvider, useTheme } from '@/state/theme';
import { ToastProvider } from '@/state/toast';

// Geist is the dashboard's typeface. Holding the splash until it has loaded
// avoids the flash of system font reflowing into it on first paint.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Geist-Light': require('../assets/fonts/Geist-Light.ttf'),
    'Geist-Regular': require('../assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium': require('../assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold': require('../assets/fonts/Geist-SemiBold.ttf'),
    'Geist-Bold': require('../assets/fonts/Geist-Bold.ttf'),
    'GeistMono-Regular': require('../assets/fonts/GeistMono-Regular.ttf'),
  });

  useEffect(() => {
    // A font that fails to load must not leave the app on the splash forever;
    // React Native falls back to the system face on its own.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ConsoleProvider>
            <LiveProvider>
              <AgentProvider>
                <OnboardingProvider>
                  <ToastProvider>
                    <MenuProvider>
                      <Shell />
                    </MenuProvider>
                  </ToastProvider>
                </OnboardingProvider>
              </AgentProvider>
            </LiveProvider>
          </ConsoleProvider>
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
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: color.base },
        }}
      />
      <OfflineBanner />
    </>
  );
}
