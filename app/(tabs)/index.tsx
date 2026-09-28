import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/Skeleton';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { SectionRule } from '@/components/SectionRule';
import { shortAgo, toActivity } from '@/lib/activity';
import { agoLabel, cacheKey, readCache, writeCache } from '@/lib/cache';
import { healthLabel, healthOf, type CameraHealth } from '@/lib/cameraHealth';
import { useAttention } from '@/state/attention';
import { useAuth } from '@/state/auth';
import { useCameras } from '@/state/cameras';
import { useLive } from '@/state/live';
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
  const { alerts, activeCount, presence, pictures, loaded: attentionLoaded } = useAttention();
  const live = useLive();

  /**
   * When this device last opened Home. Read once, then frozen for the visit so
   * the "since" line does not reset itself while being read, and written back
   * on the way out.
   */
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    void (async () => {
      const seen = await readCache<number>(cacheKey.lastSeen);
      setLastSeen(seen?.data ?? null);
      void writeCache(cacheKey.lastSeen, Date.now());
    })();
  }, []);

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
    (id: string): CameraHealth => healthOf(presence[id], Date.now(), pictures[id]),
    [presence, pictures],
  );

  const cameraName = useCallback(
    (id: string) => list.find((c) => c.camera_id === id)?.display_name ?? '',
    [list],
  );

  /** What the cameras have seen, newest first. Arrives on the socket. */
  const activity = useMemo(
    () => toActivity(live.recentEvents, live.flowEvents, cameraName),
    [live.recentEvents, live.flowEvents, cameraName],
  );

  /** Site flow today, summed across cameras from the socket's own counters. */
  const pulse = useMemo(() => {
    const stats = live.cameras ?? [];
    return {
      in: stats.reduce((n, c) => n + (c.total_in || 0), 0),
      out: stats.reduce((n, c) => n + (c.total_out || 0), 0),
    };
  }, [live.cameras]);

  /** Only counts what happened while they were away, and only if that is news. */
  const sinceCount = useMemo(
    () => (lastSeen ? activity.filter((a) => a.at > lastSeen).length : 0),
    [activity, lastSeen],
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

      {/* ── Site pulse: numbers that move while you look at them ───── */}
      {live.isConnected && (pulse.in || pulse.out || sending) ? (
        <View style={[styles.pulse, { borderColor: color.border, backgroundColor: color.surface }]}>
          <Stat value={sending} label="watching" color={color.text} />
          <View style={[styles.divider, { backgroundColor: color.border }]} />
          <Stat value={pulse.in} label="in today" color={color.success} />
          <View style={[styles.divider, { backgroundColor: color.border }]} />
          <Stat value={pulse.out} label="out today" color={color.textMuted} />
        </View>
      ) : null}

      {/* ── What just happened ─────────────────────────────────────── */}
      {activity.length ? (
        <>
          <View style={styles.listHeader}>
            <SectionRule
              label="What just happened"
              meta={
                sinceCount
                  ? `${sinceCount} since you last looked`
                  : live.isConnected
                    ? 'live'
                    : undefined
              }
            />
          </View>
          {activity.slice(0, 8).map((item) => (
            <ActivityRow
              key={item.id}
              text={item.text}
              detail={item.detail}
              at={item.at}
              fresh={!!lastSeen && item.at > lastSeen}
            />
          ))}
        </>
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

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  const { color: palette } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[font.heading, styles.statValue, { color }]}>{value}</Text>
      <Text style={[font.eyebrow, { color: palette.textFaint }]}>{label}</Text>
    </View>
  );
}

/**
 * One thing a camera saw. Memoised because the socket pushes often and a row
 * that has already scrolled past has no reason to repaint.
 */
const ActivityRow = memo(function ActivityRow({
  text,
  detail,
  at,
  fresh,
}: {
  text: string;
  detail: string | null;
  at: number;
  fresh: boolean;
}) {
  const { color } = useTheme();
  return (
    <View style={[styles.activity, { borderBottomColor: color.border }]}>
      {/* A dot rather than a colour on the text: new since last visit is worth
          marking, but not worth shouting about. */}
      <View
        style={[
          styles.activityDot,
          { backgroundColor: fresh ? color.accent : 'transparent' },
        ]}
      />
      <Text numberOfLines={1} style={[font.body, styles.fill, { color: color.text }]}>
        {text}
      </Text>
      {detail ? (
        <Text style={[font.monoSmall, { color: color.textMuted }]}>{detail}</Text>
      ) : null}
      <Text style={[font.monoSmall, { color: color.textFaint }]}>{shortAgo(at)}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fill: { flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  listHeader: { marginTop: space.lg, marginBottom: space.xs },
  pulse: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: space.md,
    marginTop: space.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontVariant: ['tabular-nums'] },
  divider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityDot: { width: 6, height: 6, borderRadius: 3 },
});
