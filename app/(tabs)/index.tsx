import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/Skeleton';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { SectionRule } from '@/components/SectionRule';
import { agoLabel } from '@/lib/cache';
import { healthLabel, healthOf, type CameraHealth } from '@/lib/cameraHealth';
import { useAttention } from '@/state/attention';
import { useAuth } from '@/state/auth';
import { useCameras } from '@/state/cameras';
import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';
import type { Palette } from '@/theme';

const DOT: Record<CameraHealth, (c: Palette) => string> = {
  live: (c) => c.success,
  stalled: (c) => c.warning,
  down: (c) => c.danger,
  disabled: (c) => c.textFaint,
  unknown: (c) => c.textFaint,
};

const PILL_TONE: Record<CameraHealth, 'live' | 'warning' | 'danger' | 'idle'> = {
  live: 'live',
  stalled: 'warning',
  down: 'danger',
  disabled: 'idle',
  unknown: 'idle',
};

/**
 * Home answers one question: is anything wrong right now.
 *
 * It used to lead with "Add a camera" — done once, given the largest tile on
 * the screen people open every day — and two tiles counting cameras. Neither
 * tells a supervisor whether they can put the phone down. Open alerts come
 * first now, then cameras that have stopped sending, then an explicit all-clear
 * when there is neither. Adding a camera moved to the menu, where setup belongs.
 */
export default function Home() {
  const { color } = useTheme();
  const { user } = useAuth();
  const { cameras: list, status, error, cachedAt, refreshing, refresh, refreshIfStale, select } =
    useCameras();
  const { alerts, activeCount, presence, loaded: attentionLoaded } = useAttention();

  useFocusEffect(
    useCallback(() => {
      refreshIfStale();
    }, [refreshIfStale]),
  );

  /**
   * Health comes from presence, never from `connection_status`.
   *
   * That column is written once at onboarding and never updated — the backend's
   * own service says as much — so Home reported cameras online that had sent
   * nothing for hours. Same source as the Live tab now, so the two agree.
   */
  const health = useCallback(
    (id: string): CameraHealth => healthOf(presence[id]),
    [presence],
  );

  const notSending = useMemo(
    () => list.filter((c) => ['down', 'stalled'].includes(health(c.camera_id))),
    [list, health],
  );

  const sending = list.length - notSending.length;
  const quiet = attentionLoaded && activeCount === 0 && notSending.length === 0 && list.length > 0;

  const open = useCallback(
    (cameraId: string) => {
      select(cameraId);
      router.push('/(tabs)/live');
    },
    [select],
  );

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
      {activeCount > 0 ? (
        <Card onPress={() => router.push('/(tabs)/alerts')}>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: color.danger }]} />
            <View style={styles.fill}>
              <Text style={[font.heading, { color: color.text }]}>
                {activeCount === 1 ? '1 alert needs you' : `${activeCount} alerts need you`}
              </Text>
              <Text numberOfLines={1} style={[font.caption, { color: color.textMuted }]}>
                {alerts[0]
                  ? `${alerts[0].label}${alerts[0].location ? ` · ${alerts[0].location}` : ''}`
                  : 'Open the Alerts tab'}
              </Text>
            </View>
            <Pill label="Open" tone="danger" />
          </View>
        </Card>
      ) : null}

      {notSending.length ? (
        <Card onPress={() => router.push('/(tabs)/live')}>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: color.warning }]} />
            <View style={styles.fill}>
              <Text style={[font.heading, { color: color.text }]}>
                {notSending.length === 1
                  ? '1 camera is not sending'
                  : `${notSending.length} cameras are not sending`}
              </Text>
              <Text numberOfLines={1} style={[font.caption, { color: color.textMuted }]}>
                {notSending.map((c) => c.display_name).join(', ')}
              </Text>
            </View>
            <Pill label="Check" tone="warning" />
          </View>
        </Card>
      ) : null}

      {quiet ? (
        <Card>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: color.success }]} />
            <View style={styles.fill}>
              <Text style={[font.heading, { color: color.text }]}>All clear</Text>
              <Text style={[font.caption, { color: color.textMuted }]}>
                {sending === 1 ? '1 camera sending' : `${sending} cameras sending`}, nothing open
              </Text>
            </View>
            <Pill label="Live" tone="live" dot />
          </View>
        </Card>
      ) : null}

      <View style={styles.listHeader}>
        <SectionRule
          label="Your cameras"
          meta={cachedAt ? `saved ${agoLabel(cachedAt)}` : undefined}
        />
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
          <SkeletonCard lines={1} />
          <SkeletonCard lines={1} />
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
          action={
            <Button
              label="Find cameras"
              variant="secondary"
              onPress={() => router.push('/onboarding')}
            />
          }
        />
      ) : null}

      {list.map((camera) => (
        <CameraRow
          key={camera.camera_id}
          id={camera.camera_id}
          name={camera.display_name}
          health={health(camera.camera_id)}
          onPress={open}
        />
      ))}
    </Screen>
  );
}

/**
 * Memoised: the live socket moves its neighbours several times a second, and a
 * row whose name and health have not changed should not repaint with them.
 */
const CameraRow = memo(function CameraRow({
  id,
  name,
  health,
  onPress,
}: {
  id: string;
  name: string;
  health: CameraHealth;
  onPress: (id: string) => void;
}) {
  const { color } = useTheme();
  const live = health === 'live';
  return (
    <Card glow={live} onPress={() => onPress(id)}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: DOT[health](color) }]} />
        <Text numberOfLines={1} style={[font.heading, styles.fill, { color: color.text }]}>
          {name}
        </Text>
        <Pill label={healthLabel[health]} tone={PILL_TONE[health]} dot={live} />
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fill: { flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  listHeader: { marginTop: space.lg, marginBottom: space.xs },
});
