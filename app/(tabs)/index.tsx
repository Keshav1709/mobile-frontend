import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Glow } from '@/components/Glow';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/Skeleton';
import { Pill } from '@/components/Pill';
import { RefreshNote, settledLine } from '@/components/RefreshNote';
import { Screen } from '@/components/Screen';
import { SectionRule } from '@/components/SectionRule';
import { shortAgo } from '@/lib/activity';
import { agoLabel, cacheKey, readCache, writeCache } from '@/lib/cache';
import { healthLabel, healthOf, type CameraHealth } from '@/lib/cameraHealth';
import { useAttention } from '@/state/attention';
import { useAuth } from '@/state/auth';
import { useCameras } from '@/state/cameras';
import { useConsole } from '@/state/console';
import { useTheme } from '@/state/theme';
import { font, hue, radius, space } from '@/theme';
import type { Palette } from '@/theme';

const DOT: Record<CameraHealth, (c: Palette) => string> = {
  live: (c) => c.success,
  stalled: (c) => c.warning,
  down: (c) => c.danger,
  disabled: (c) => c.textFaint,
  unknown: (c) => c.textFaint,
};

/**
 * The greeting, in the site's own time rather than the phone's.
 *
 * A supervisor checking a Bengaluru plant from another timezone should be
 * greeted by the plant's clock, because everything under it is the plant's day.
 */
function greeting(timeZone: string | undefined): string {
  let hour: number;
  try {
    hour = Number(
      new Date().toLocaleString('en-GB', { timeZone, hour: '2-digit', hour12: false }),
    );
  } catch {
    hour = new Date().getHours();
  }
  if (!Number.isFinite(hour)) hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** How far back "recent" reaches on the home screen. */
const RECENT_WINDOW_MS = 60 * 60 * 1000;

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
  const { manifest } = useConsole();
  const { cameras: list, status, error, cachedAt, refreshing, refresh, refreshIfStale, select } =
    useCameras();
  const {
    alerts,
    activeCount,
    presence,
    pictures,
    attendance,
    loaded: attentionLoaded,
  } = useAttention();

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

  /**
   * Alerts raised in the last hour.
   *
   * Replaces a feed of every detection the cameras made. That feed was busy on
   * a working site and almost none of it needed a person, which is the wrong
   * thing to put on the screen someone checks when they want to know if they
   * can stop looking. An empty hour renders nothing at all.
   */
  const recent = useMemo(() => {
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    return alerts
      .filter((a) => {
        const at = a.created_at ? Date.parse(a.created_at) : NaN;
        return Number.isFinite(at) && at >= cutoff;
      })
      .sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''))
      .slice(0, 6);
  }, [alerts]);

  /**
   * People, counted as people.
   *
   * Deliberately not `people_in` / `people_out`. Those are gate line crossings
   * despite the name: twenty people produced a hundred and one of them in a day,
   * and `out` regularly exceeds `in`, which is impossible for people and normal
   * for crossings.
   *
   * Came in today, still here, and the difference who have gone. `present_now`
   * counts people recognised today and `facility_occupancy` counts who is still
   * inside, so the third number falls out of the other two.
   *
   * One caveat worth knowing: `present_now` counts anyone recognised at any
   * centre in the group, while occupancy counts this building. On a group
   * account where people are spread across centres, somebody working at
   * another site counts as having left this one. Single-centre accounts, which
   * is nearly all of them, are exact.
   */
  const people = attendance
    ? {
        in: attendance.present_now,
        onSite: attendance.facility_occupancy,
        out: Math.max(0, attendance.present_now - attendance.facility_occupancy),
      }
    : null;

  /** Only counts what arrived while they were away, and only if that is news. */
  const sinceCount = useMemo(
    () =>
      lastSeen
        ? recent.filter((a) => Date.parse(a.created_at ?? '') > lastSeen).length
        : 0,
    [recent, lastSeen],
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
      // The site is the eyebrow and the greeting is the title, rather than
      // "Hi, there" for the many accounts that carry no personal name.
      eyebrow={manifest?.org.name ?? user?.tenant_name ?? 'Zero Forg'}
      title={
        user?.first_name ? `${greeting(manifest?.org.timezone)}, ${user.first_name}` : greeting(manifest?.org.timezone)
      }
      titleSize="display"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={color.textMuted} />
      }
    >
      <RefreshNote
        refreshing={refreshing}
        settled={settledLine(activeCount, notSending.length)}
      />

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
        // Straight to the first camera that is not sending, rather than to
        // whichever one happened to be open last.
        <Card onPress={() => open(notSending[0].camera_id)}>
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

      {/* Three counts of people, as a grid rather than a cramped row. Each one
          opens the attendance board, which is where the detail behind it is. */}
      {people ? (
        <View style={styles.grid}>
          <StatTile
            value={people.in}
            label="in today"
            tint={hue.jade}
            wide
            onPress={() => router.push('/attendance')}
          />
          <StatTile
            value={people.onSite}
            label="on site now"
            tint={hue.gold}
            onPress={() => router.push('/attendance')}
          />
          <StatTile
            value={people.out}
            label="left today"
            tint={hue.umber}
            onPress={() => router.push('/attendance')}
          />
        </View>
      ) : null}

      {/* Nothing in the last hour means nothing here. */}
      {recent.length ? (
        <>
          <View style={styles.listHeader}>
            <SectionRule
              label="Last hour"
              meta={sinceCount ? `${sinceCount} since you last looked` : undefined}
            />
          </View>
          {recent.map((alert) => (
            <AlertRow
              key={alert.alert_id}
              label={alert.label}
              where={alert.location ?? null}
              severity={alert.severity}
              at={Date.parse(alert.created_at ?? '')}
              fresh={!!lastSeen && Date.parse(alert.created_at ?? '') > lastSeen}
              onPress={() => router.push('/(tabs)/alerts')}
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

/**
 * One number, with a bloom of its own colour behind it.
 *
 * The bloom is the same Glow the rest of the app uses, tinted per tile and kept
 * low: enough to separate the three at a glance and give the grid some depth,
 * not so much that the figure stops being the thing you read first.
 */
function StatTile({
  value,
  label,
  tint,
  wide,
  onPress,
}: {
  value: number;
  label: string;
  tint: string;
  wide?: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}. Opens attendance.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        wide ? styles.tileWide : styles.tileHalf,
        {
          backgroundColor: color.surface,
          borderColor: color.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Glow tint={tint} x={0.78} y={0.12} size={0.95} opacity={0.5} />
      <Text style={[font.display, styles.tileValue, { color: color.text }]}>{value}</Text>
      <Text style={[font.eyebrow, { color: color.textFaint }]}>{label}</Text>
    </Pressable>
  );
}

/** One alert from the last hour. Memoised so the socket does not repaint it. */
const AlertRow = memo(function AlertRow({
  label,
  where,
  severity,
  at,
  fresh,
  onPress,
}: {
  label: string;
  where: string | null;
  severity: string | null;
  at: number;
  fresh: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const serious = severity === 'critical' || severity === 'high';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${where ? `, ${where}` : ''}, ${shortAgo(at)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.activity,
        { borderBottomColor: color.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {/* A dot, not coloured text: new since the last visit is worth marking,
          not worth shouting about. */}
      <View
        style={[
          styles.activityDot,
          { backgroundColor: fresh ? color.accent : 'transparent' },
        ]}
      />
      <View style={styles.fill}>
        <Text numberOfLines={1} style={[font.body, { color: color.text }]}>
          {label}
        </Text>
        {where ? (
          <Text numberOfLines={1} style={[font.monoSmall, { color: color.textFaint }]}>
            {where}
          </Text>
        ) : null}
      </View>
      {serious ? <Pill label={severity ?? 'alert'} tone="danger" dot /> : null}
      <Text style={[font.monoSmall, { color: color.textFaint }]}>{shortAgo(at)}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fill: { flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  listHeader: { marginTop: space.lg, marginBottom: space.xs },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    marginTop: space.md,
  },
  tile: {
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    gap: 2,
    overflow: 'hidden',
    minHeight: 96,
    justifyContent: 'flex-end',
  },
  tileWide: { width: '100%' },
  // Half the row, less the gap between the two.
  tileHalf: { flexGrow: 1, flexBasis: '47%' },
  tileValue: { fontVariant: ['tabular-nums'] },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityDot: { width: 6, height: 6, borderRadius: 3 },
});
