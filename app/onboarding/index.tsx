import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cloudApi } from '@/api/cloud';
import { Camera } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { font, hue, radius, space } from '@/theme';

const STEPS = [
  { title: 'Scan', body: 'We look for ONVIF cameras on your Wi-Fi network.' },
  { title: 'Authenticate', body: 'You enter the camera username and password, once.' },
  { title: 'Verify', body: 'We read the video profile and resolve the stream before saving.' },
];

export default function AddCamera() {
  const { color } = useTheme();
  const { user } = useAuth();
  const [connected, setConnected] = useState<Camera[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setConnected(await cloudApi.listCameras(user.tenant_id));
    } catch {
      setConnected([]);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
        </>
      }
    >
      {connected.length ? (
        <View style={styles.section}>
          <Text style={[font.eyebrow, { color: color.textFaint }]}>
            Already connected · {connected.length}
          </Text>
          {connected.map((camera) => (
            <Card
              key={camera.camera_id}
              glow
              tint={hue.teal}
              onPress={() => router.replace('/(tabs)')}
            >
              <View style={styles.cardTop}>
                <Text
                  numberOfLines={1}
                  style={[font.heading, styles.cardTitle, { color: color.text }]}
                >
                  {camera.display_name}
                </Text>
                <Pill
                  label={camera.connection_status === 'CONNECTED' ? 'Connected' : 'Offline'}
                  tone={camera.connection_status === 'CONNECTED' ? 'live' : 'idle'}
                  dot
                />
              </View>
              <Text style={[font.caption, { color: color.textMuted }]}>
                {[camera.manufacturer, camera.model, camera.ip].filter(Boolean).join(' · ')}
              </Text>
              {camera.resolution ? (
                <Text style={[font.mono, styles.spec, { color: color.textFaint }]}>
                  {camera.resolution}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[font.eyebrow, { color: color.textFaint }]}>
          {connected.length ? 'Add another' : 'How it works'}
        </Text>
        <View style={[styles.steps, { borderColor: color.border, backgroundColor: color.surface }]}>
          {STEPS.map((step, index) => (
            <View
              key={step.title}
              style={[styles.step, index > 0 && styles.divided, { borderTopColor: color.border }]}
            >
              <View style={[styles.number, { backgroundColor: color.accentSoft }]}>
                <Text style={[font.label, styles.numberText, { color: color.accent }]}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.stepText}>
                <Text style={[font.label, { color: color.text }]}>{step.title}</Text>
                <Text style={[font.caption, { color: color.textMuted }]}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  cardTitle: { flex: 1 },
  spec: { fontSize: 12 },
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
});
