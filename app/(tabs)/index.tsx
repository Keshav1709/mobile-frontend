import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cloudApi } from '@/api/cloud';
import { Camera } from '@/api/types';
import { Banner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { Contours } from '@/components/Contours';
import { Glow } from '@/components/Glow';
import { Pill } from '@/components/Pill';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Tile } from '@/components/Tile';
import { errorMessage } from '@/lib/helpers';
import { relayConfigured } from '@/onvif/relay';
import { useAgent } from '@/state/agent';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { font, hue, radius, space } from '@/theme';

export default function Home() {
  const { color } = useTheme();
  const { user } = useAuth();
  const { info: agentInfo } = useAgent();

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      setCameras(await cloudApi.listCameras(user.tenant_id));
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't load cameras."));
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const streaming = cameras.filter(
    (camera) => relayConfigured && !!camera.stream_reference,
  ).length;

  return (
    <View style={[styles.root, { backgroundColor: color.base }]}>
      <Glow y={0.04} size={1.2} />
      <Contours opacity={0.1} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={color.textMuted} />
          }
        >
          <View style={styles.greeting}>
            <View style={styles.greetingText}>
              <Text style={[font.eyebrow, { color: color.textFaint }]}>Zero Forg Vision</Text>
              <Text style={[font.display, { color: color.text }]}>
                Hi, {user?.first_name ?? 'there'}
              </Text>
            </View>
            <ThemeToggle />
          </View>

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
              <Tile title={`${cameras.length}`} caption="Connected" numeric tint={hue.violet}>
                <Text style={[font.eyebrow, { color: color.textFaint }]}>Cameras</Text>
              </Tile>
              <Tile title={`${streaming}`} caption="Streaming now" numeric tint={hue.orange}>
                <Pill
                  label={streaming ? 'Live' : 'Idle'}
                  tone={streaming ? 'live' : 'idle'}
                  dot
                />
              </Tile>
            </View>
          </View>

          {error ? <Banner tone="error" title="Couldn't load cameras" message={error} /> : null}

          <View style={styles.listHeader}>
            <Text style={[font.heading, { color: color.text }]}>Your cameras</Text>
            <Text style={[font.caption, { color: color.textMuted }]}>Pull to refresh</Text>
          </View>

          {!error && cameras.length === 0 ? (
            <View style={[styles.empty, { borderColor: color.border }]}>
              <Text style={[font.heading, { color: color.text }]}>Nothing connected yet</Text>
              <Text style={[font.caption, styles.emptyText, { color: color.textMuted }]}>
                Run discovery to find the cameras on your local network.
              </Text>
            </View>
          ) : null}

          {cameras.map((camera) => {
            const live = relayConfigured && !!camera.stream_reference;
            return (
              <Card
                key={camera.camera_id}
                glow={live}
                tint={live ? hue.teal : undefined}
                onPress={() => router.push('/(tabs)/live')}
              >
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
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { padding: space.xl, gap: space.md, paddingBottom: space.xxl },
  greeting: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    marginBottom: space.sm,
  },
  greetingText: { flex: 1, gap: 6 },
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
  empty: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.xl,
  },
  emptyText: { textAlign: 'center' },
});
