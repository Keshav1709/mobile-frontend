import { router } from 'expo-router';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CameraThumb } from '@/components/CameraThumb';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/Skeleton';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Tile } from '@/components/Tile';
import { agoLabel } from '@/lib/cache';
import { useAgent } from '@/state/agent';
import { useAuth } from '@/state/auth';
import { useCameras } from '@/state/cameras';
import { useTheme } from '@/state/theme';
import { font, hue, space } from '@/theme';

export default function Home() {
  const { color } = useTheme();
  const { user } = useAuth();
  const { info: agentInfo } = useAgent();
  const { cameras: list, status, error, cachedAt, refreshing, refresh, select } = useCameras();

  // Online = the dashboard has heard from it recently; the same test the web wall uses.
  const streaming = list.filter((camera) => camera.connection_status === 'CONNECTED').length;

  const open = (cameraId: string) => {
    select(cameraId);
    router.push('/(tabs)/live');
  };

  return (
    <Screen
      tabBar
      eyebrow="Zero Forg Vision"
      title={`Hi, ${user?.first_name ?? 'there'}`}
      titleSize="display"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={color.textMuted} />
      }
    >
      <View style={styles.bento}>
        <Tile
          title="Add a camera"
          caption="Scan your network"
          featured
          onPress={() => router.push('/onboarding')}
          style={styles.wide}
        >
          <Pill label={agentInfo ? 'Local agent' : 'Discovery'} tone="accent" />
        </Tile>
        <View style={styles.column}>
          <Tile title={`${list.length}`} caption="Cameras" numeric tint={hue.slate}>
            <Text style={[font.eyebrow, { color: color.textFaint }]}>On this account</Text>
          </Tile>
          <Tile title={`${streaming}`} caption="Online now" numeric tint={hue.amber}>
            <Pill
              label={streaming ? 'Live' : 'Idle'}
              tone={streaming ? 'live' : 'idle'}
              dot
            />
          </Tile>
        </View>
      </View>

      <View style={styles.listHeader}>
        <Text style={[font.heading, { color: color.text }]}>Your cameras</Text>
        <Text style={[font.caption, { color: color.textMuted }]}>
          {cachedAt ? `Saved ${agoLabel(cachedAt)}` : 'Pull to refresh'}
        </Text>
      </View>

      {status === 'ready' && error && list.length ? (
        <Banner
          tone="info"
          title="Showing your saved cameras"
          message={`${error} These are the cameras this phone last saw.`}
        />
      ) : null}

      {status === 'loading' ? (
        <>
          <SkeletonCard lines={3} media />
          <SkeletonCard lines={3} media />
        </>
      ) : null}

      {status === 'error' ? (
        <EmptyState
          tone="error"
          icon="offline"
          title="Couldn't load cameras"
          hint={error ?? undefined}
          action={<Button label="Try again" variant="secondary" onPress={refresh} />}
        />
      ) : null}

      {status === 'ready' && list.length === 0 ? (
        <EmptyState
          icon="camera"
          title="Nothing connected yet"
          hint="Find the cameras on your local network and connect them."
          action={<Button label="Find cameras" variant="secondary" onPress={() => router.push('/onboarding')} />}
        />
      ) : null}

      {list.map((camera) => {
        const live = camera.connection_status === 'CONNECTED';
        return (
          <Card
            key={camera.camera_id}
            glow={live}
            tint={live ? hue.jade : undefined}
            onPress={() => open(camera.camera_id)}
          >
            <CameraThumb cameraId={camera.camera_id} online={live} />
            <View style={styles.cardTop}>
              <Text
                numberOfLines={1}
                style={[font.heading, styles.cardTitle, { color: color.text }]}
              >
                {camera.display_name}
              </Text>
              <Pill
                label={live ? 'Live' : 'No stream'}
                tone={live ? 'live' : 'idle'}
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
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bento: { flexDirection: 'row', gap: space.md, marginBottom: space.sm },
  wide: { flex: 1.25 },
  column: { flex: 1, gap: space.md },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  cardTitle: { flex: 1 },
  spec: { fontSize: 12 },
});
