import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cloudApi } from '@/api/cloud';
import { Camera } from '@/api/types';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

export default function Success() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { idToken } = useAuth();
  const { color } = useTheme();
  const [camera, setCamera] = useState<Camera | null>(null);

  useEffect(() => {
    cloudApi.getCamera(id).then(setCamera).catch(() => setCamera(null));
    if (idToken) cloudApi.completeOnboarding(idToken).catch(() => undefined);
    // Runs once for this camera id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <Screen
      onBack={() => router.replace('/(tabs)')}
      eyebrow="Done"
      title="Camera connected"
      subtitle="It's registered to your account."
      footer={
        <>
          <Button label="Open camera" onPress={() => router.replace('/(tabs)')} />
          <Button label="Add another" variant="secondary" onPress={() => router.replace('/onboarding')} />
          <Button label="Done" variant="ghost" onPress={() => router.replace('/(tabs)')} />
        </>
      }
    >
      <View style={[styles.check, { backgroundColor: color.successSoft }]}>
        <Text style={[styles.checkGlyph, { color: color.success }]}>✓</Text>
      </View>

      <Card glow>
        <Text style={[font.heading, { color: color.text }]}>{camera?.display_name ?? 'Camera'}</Text>
        <Text style={[font.caption, { color: color.textMuted }]}>
          {[camera?.manufacturer, camera?.model, camera?.ip].filter(Boolean).join(' · ')}
        </Text>
        {camera?.resolution ? (
          <Text style={[font.mono, styles.spec, { color: color.textFaint }]}>{camera.resolution}</Text>
        ) : null}
      </Card>

      {camera && !camera.stream_reference ? (
        <Banner
          tone="info"
          title="Live view unavailable"
          message="The camera is connected, but its stream could not be published to the relay."
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space.lg,
  },
  checkGlyph: { fontSize: 30, fontWeight: '700' },
  spec: { fontSize: 12 },
});
