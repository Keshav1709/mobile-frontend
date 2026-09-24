import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cloudApi } from '@/api/cloud';
import { Camera } from '@/api/types';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { backTo, finishFlow } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

export default function Success() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { color } = useTheme();
  const { idToken } = useAuth();
  const [camera, setCamera] = useState<Camera | null>(null);

  useEffect(() => {
    if (!idToken) return;
    cloudApi.getCamera(idToken, id).then(setCamera).catch(() => setCamera(null));
  }, [id, idToken]);

  return (
    <Screen
      onBack={() => finishFlow('/(tabs)')}
      eyebrow="Done"
      title="Camera connected"
      subtitle="It's registered to your account."
      footer={
        <>
          <Button label="Open camera" onPress={() => finishFlow('/(tabs)/live')} />
          <Button label="Add another" variant="secondary" onPress={() => backTo('/onboarding')} />
          <Button label="Done" variant="ghost" onPress={() => finishFlow('/(tabs)')} />
        </>
      }
    >
      <View style={[styles.check, { backgroundColor: color.successSoft }]}>
        <Icon name="check" size={32} color={color.success} />
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
  spec: { fontSize: 12 },
});
