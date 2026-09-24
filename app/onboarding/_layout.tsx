import { Stack } from 'expo-router';

/** The camera-onboarding flow: add → discover → credentials → connect → done. */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
