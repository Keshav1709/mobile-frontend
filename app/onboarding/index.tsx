import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

const STEPS = [
  { title: 'Scan', body: 'We sweep your Wi-Fi network for ONVIF cameras.' },
  { title: 'Authenticate', body: 'You enter the camera username and password, once.' },
  { title: 'Verify', body: 'We read the video profile and resolve the stream before saving.' },
];

export default function AddCamera() {
  const { color } = useTheme();

  return (
    <Screen
      onBack={() => router.replace('/(tabs)')}
      eyebrow="Camera onboarding"
      title="Add a camera"
      subtitle="Connect a camera on this Wi-Fi network."
      footer={
        <>
          <Button label="Find cameras" onPress={() => router.push('/onboarding/discovery')} />
          <Button
            label="Add manually"
            variant="secondary"
            onPress={() => router.push('/onboarding/manual')}
          />
          <Button label="Cancel" variant="ghost" onPress={() => router.replace('/(tabs)')} />
        </>
      }
    >
      <View style={[styles.steps, { borderColor: color.border, backgroundColor: color.surface }]}>
        {STEPS.map((step, index) => (
          <View
            key={step.title}
            style={[styles.step, index > 0 && styles.divided, { borderTopColor: color.border }]}
          >
            <View style={[styles.number, { backgroundColor: color.accentSoft }]}>
              <Text style={[font.label, styles.numberText, { color: color.accent }]}>{index + 1}</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={[font.label, { color: color.text }]}>{step.title}</Text>
              <Text style={[font.caption, { color: color.textMuted }]}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.note, { backgroundColor: color.surfaceSunken, borderColor: color.border }]}>
        <Pill label="Local only" tone="accent" dot />
        <Text style={[font.caption, { color: color.textMuted }]}>
          Camera passwords are kept in this phone&apos;s keychain so the app can pan the camera and
          reconnect. They never reach the cloud.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: space.lg },
  step: { flexDirection: 'row', gap: space.lg, paddingVertical: space.lg },
  divided: { borderTopWidth: StyleSheet.hairlineWidth },
  stepText: { flex: 1, gap: 3 },
  number: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontSize: 13 },
  note: { gap: space.md, padding: space.lg, borderRadius: radius.xl, borderWidth: 1 },
});
