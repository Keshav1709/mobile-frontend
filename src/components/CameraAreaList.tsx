import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cloudApi } from '@/api/cloud';
import { Camera } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/Skeleton';
import { Pill } from '@/components/Pill';
import { errorMessage } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { font, hue, space } from '@/theme';

/**
 * Every camera in the workspace with how many areas it has. Tapping one opens
 * the editor. Shared by the setup step and the Areas page under Profile.
 */
export function CameraAreaList({ onLoaded }: { onLoaded?: (cameras: Camera[]) => void }) {
  const { color } = useTheme();
  const { user, idToken } = useAuth();
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !idToken) return;
    try {
      const list = await cloudApi.listCameras(idToken);
      setCameras(list);
      onLoaded?.(list);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't load your cameras."));
    }
  }, [user, idToken, onLoaded]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error) {
    return (
      <EmptyState
        tone="error"
        icon="offline"
        title="Couldn't load cameras"
        hint={error}
        action={<Button label="Try again" variant="secondary" onPress={load} />}
      />
    );
  }

  if (cameras === null) {
    return (
      <View style={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  if (cameras.length === 0) {
    return (
      <EmptyState
        icon="camera"
        title="No cameras yet"
        hint="Add at least one camera first, then come back to outline areas."
        action={<Button label="Add a camera" variant="secondary" onPress={() => router.push('/onboarding')} />}
      />
    );
  }

  return (
    <View style={styles.list}>
      {cameras.map((camera) => {
        const count = camera.zones_json?.length ?? 0;
        return (
          <Card
            key={camera.camera_id}
            glow={count > 0}
            tint={hue.jade}
            onPress={() => router.push(`/zones/${camera.camera_id}`)}
          >
            <View style={styles.cardTop}>
              <Text numberOfLines={1} style={[font.heading, styles.cardTitle, { color: color.text }]}>
                {camera.display_name}
              </Text>
              <Pill
                label={count ? `${count} area${count === 1 ? '' : 's'}` : 'No areas'}
                tone={count ? 'live' : 'idle'}
              />
            </View>
            <Text style={[font.caption, { color: color.textMuted }]}>
              {count
                ? camera.zones_json.map((zone) => zone.name || zone.label).join(' · ')
                : 'Tap to outline entrances, restricted areas, docks…'}
            </Text>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  cardTitle: { flex: 1 },
});
