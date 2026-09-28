import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import type { HomeTile } from '@/api/console';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { SectionRule } from '@/components/SectionRule';
import { SkeletonCard } from '@/components/Skeleton';
import { useConsole } from '@/state/console';
import { useDashboard } from '@/state/data';
import { useTheme } from '@/state/theme';
import { font, hue, space } from '@/theme';

/**
 * Home, as the organisation actually uses it.
 *
 * Home was the same page for everybody: alerts, then cameras, then a row of
 * headcounts. That is right for a centre whose product is people and wrong for a
 * factory whose product is its loading bay, which is most of them. TRZ's web
 * dashboard opens on trucks at the dock and time spent there; the app opened on
 * a headcount its workspace does not even have.
 *
 * The dashboard has already solved this. `/console/manifest` carries a `home`
 * block listing the panels it composed for this organisation from its
 * capabilities, and `/console/home/tiles/{id}/data` serves each one's numbers.
 * Reading that list is what keeps the two in step: a capability switched on for
 * a customer appears here without an app release, and nothing appears that their
 * workspace cannot answer for.
 *
 * Unknown kinds render nothing. A tile this build has no renderer for is a
 * dashboard that has moved ahead of the app, which is a reason to show less, not
 * to show a broken panel.
 */

export function HomeTiles() {
  const { manifest } = useConsole();
  const tiles = manifest?.home?.tiles ?? [];
  if (!tiles.length) return null;

  return (
    <>
      {tiles.map((tile) => (
        <HomeTilePanel key={tile.id} tile={tile} />
      ))}
    </>
  );
}

function HomeTilePanel({ tile }: { tile: HomeTile }) {
  const { data, isLoading } = useDashboard<TileData>(
    `/console/home/tiles/${encodeURIComponent(tile.id)}/data`,
  );

  // Only on a first load with nothing cached. A tile that already has numbers
  // keeps them while it re-reads, so Home does not blink on every refresh.
  if (isLoading) return <SkeletonCard lines={2} />;
  if (!data) return null;

  switch (tile.kind) {
    case 'flow_kpis':
      return <FlowKpisTile data={data as unknown as FlowKpis} />;
    case 'event_count':
      return <EventCountTile data={data as unknown as EventCount} tile={tile} />;
    case 'alert_feed':
      return <AlertFeedTile data={data as unknown as AlertFeed} />;
    case 'attendance_board':
      return <AttendanceTile data={data as unknown as AttendanceBoard} />;
    default:
      return null;
  }
}

// ── Shapes, as the tile endpoints return them ────────────────────────────

type TileData = { kind: string } & Record<string, unknown>;

type FlowKpis = {
  totals: { loaded: number; unloaded: number; net: number; entries: number };
  trucks: {
    active: number;
    completed: number;
    avg_dwell_seconds: number | null;
    latest_movement_at: string | null;
  };
  gate_breakdown: { gate: string; loaded: number; unloaded: number; trucks: number }[];
};

type EventCount = { total: number; previous_total: number; window_h: number };
type AlertFeed = {
  active_count: number;
  items: { id?: string; label?: string; location?: string | null; created_at?: string }[];
};
type AttendanceBoard = {
  available: boolean;
  present_now: number;
  facility_occupancy: number;
  enrolled_total: number;
};

// ── Renderers ────────────────────────────────────────────────────────────

/** Minutes, from the seconds the dock tile reports. */
function dwell(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * The loading bay: what is in it now, and how long today's trucks took.
 *
 * Leads with whether the bay is occupied, because that is the thing somebody
 * opening the app on the floor wants to know. The averages are the day's record
 * and sit underneath.
 */
function FlowKpisTile({ data }: { data: FlowKpis }) {
  const { color } = useTheme();
  const { active, completed, avg_dwell_seconds } = data.trucks ?? {
    active: 0,
    completed: 0,
    avg_dwell_seconds: null,
  };
  const gates = data.gate_breakdown ?? [];

  return (
    <>
      <View style={styles.header}>
        <SectionRule label="At the dock" />
      </View>

      <Card>
        <View style={styles.row}>
          <View
            style={[
              styles.dot,
              { backgroundColor: active > 0 ? color.success : color.textFaint },
            ]}
          />
          <View style={styles.fill}>
            <Text style={[font.heading, { color: color.text }]}>
              {active === 0
                ? 'Nothing at the dock'
                : active === 1
                  ? '1 truck at the dock'
                  : `${active} trucks at the dock`}
            </Text>
            <Text numberOfLines={1} style={[font.caption, { color: color.textMuted }]}>
              {active === 0 ? 'The bay is free.' : gates.map((g) => g.gate).join(', ')}
            </Text>
          </View>
          {active > 0 ? <Pill label="Live" tone="live" dot /> : null}
        </View>
      </Card>

      <View style={styles.grid}>
        <Stat value={String(completed)} label={completed === 1 ? 'truck today' : 'trucks today'} tint={hue.jade} wide />
        <Stat value={dwell(avg_dwell_seconds)} label="average at the dock" tint={hue.gold} />
      </View>
    </>
  );
}

/** A count of one kind of event over a window, against the window before it. */
function EventCountTile({ data, tile }: { data: EventCount; tile: HomeTile }) {
  const { color } = useTheme();
  const total = data.total ?? 0;
  const previous = data.previous_total ?? 0;
  const label = titleOf(tile.capability);

  return (
    <Card onPress={() => router.push('/(tabs)/alerts')}>
      <View style={styles.row}>
        <View
          style={[styles.dot, { backgroundColor: total > 0 ? color.warning : color.success }]}
        />
        <View style={styles.fill}>
          <Text style={[font.heading, { color: color.text }]}>
            {total === 0
              ? `No ${label} in ${data.window_h ?? 24}h`
              : `${total} ${label}${total === 1 ? '' : 's'} in ${data.window_h ?? 24}h`}
          </Text>
          <Text style={[font.caption, { color: color.textMuted }]}>
            {previous === 0 && total === 0
              ? 'Same as the day before.'
              : `${previous} in the window before`}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/** Open alerts of one capability, with the most recent named. */
function AlertFeedTile({ data }: { data: AlertFeed }) {
  const { color } = useTheme();
  const count = data.active_count ?? 0;
  if (count === 0 && !(data.items ?? []).length) return null;
  const first = (data.items ?? [])[0];

  return (
    <Card onPress={() => router.push('/(tabs)/alerts')}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: color.danger }]} />
        <View style={styles.fill}>
          <Text style={[font.heading, { color: color.text }]}>
            {count === 1 ? '1 alert needs you' : `${count} alerts need you`}
          </Text>
          <Text numberOfLines={1} style={[font.caption, { color: color.textMuted }]}>
            {first?.label
              ? `${first.label}${first.location ? ` · ${first.location}` : ''}`
              : 'Open the Alerts tab'}
          </Text>
        </View>
        <Pill label="Open" tone="danger" />
      </View>
    </Card>
  );
}

/**
 * People, for the workspaces that count them.
 *
 * `present_now` is everyone recognised today and `facility_occupancy` is who is
 * still in the building, so the third figure falls out of the two. Deliberately
 * not `people_in` / `people_out`: those are gate line crossings despite the
 * names, and read as more people having left than ever arrived.
 */
function AttendanceTile({ data }: { data: AttendanceBoard }) {
  if (!data.available) return null;
  const inToday = data.present_now ?? 0;
  const onSite = data.facility_occupancy ?? 0;

  return (
    <>
      <View style={styles.header}>
        <SectionRule label="People" />
      </View>
      <View style={styles.grid}>
        <Stat value={String(inToday)} label="in today" tint={hue.jade} wide onPress={() => router.push('/attendance')} />
        <Stat value={String(onSite)} label="on site now" tint={hue.gold} onPress={() => router.push('/attendance')} />
        <Stat
          value={String(Math.max(0, inToday - onSite))}
          label="left today"
          tint={hue.umber}
          onPress={() => router.push('/attendance')}
        />
      </View>
    </>
  );
}

/** A capability key as something to put in a sentence. */
function titleOf(capability: string): string {
  const words: Record<string, string> = {
    intrusion: 'intrusion',
    unauthorized_access: 'unauthorised entry',
    loading_unloading: 'dock movement',
    violence: 'incident',
  };
  return words[capability] ?? capability.replace(/_/g, ' ');
}

function Stat({
  value,
  label,
  tint,
  wide,
  onPress,
}: {
  value: string;
  label: string;
  tint: string;
  wide?: boolean;
  onPress?: () => void;
}) {
  const { color } = useTheme();
  return (
    <Card onPress={onPress} style={wide ? styles.statWide : styles.stat}>
      <Text style={[font.display, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[font.caption, { color: color.textMuted }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  fill: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexGrow: 1, flexBasis: '30%', minWidth: 104 },
  statWide: { flexGrow: 1, flexBasis: '100%', minWidth: 104 },
});
