import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { dashboardApi, isNotEnabled } from '@/api/dashboard';
import { AttendanceOverview, AttendanceRanking, AttendanceStats } from '@/api/types';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { DotField } from '@/components/DotField';
import { EmptyState } from '@/components/EmptyState';
import { Face } from '@/components/Face';
import { HeatCalendar } from '@/components/HeatCalendar';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SectionRule } from '@/components/SectionRule';
import { SkeletonCard } from '@/components/Skeleton';
import { StatColumns } from '@/components/StatColumns';
import { errorMessage, goBack } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useConsole } from '@/state/console';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

const MEDALS = ['🥇', '🥈', '🥉'];
/** The board is a live instrument; the dashboard re-reads on the same cadence. */
const POLL_MS = 15000;

/** YYYY-MM-DD for "now" in the workspace's own timezone, not the phone's. */
function todayIn(timeZone: string | undefined): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone });
  } catch {
    return new Date().toLocaleDateString('en-CA');
  }
}

/**
 * The stats window the calendar and the rankings share: from the 1st of the month on
 * view up to today, as the dashboard does it. At least a week so a fresh month still
 * shows something; at most ninety days, which is as far back as the board keeps.
 */
function windowDays(year: number, month: number, todayIso: string): number {
  const start = new Date(`${year}-${String(month).padStart(2, '0')}-01T12:00:00`);
  const today = new Date(`${todayIso}T12:00:00`);
  const diff = Math.round((today.getTime() - start.getTime()) / 86400000) + 1;
  return Math.min(90, Math.max(7, diff));
}

const hhmm = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function ago(from: Date, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
}

function dayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const today = new Date();
  const days = Math.round((today.setHours(0, 0, 0, 0) - date.getTime()) / 86400000);
  if (days === 1) return 'yesterday';
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

type Tab = 'today' | 'people' | 'trend';
const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'people', label: 'People' },
  { key: 'trend', label: 'Trend' },
];

export default function Attendance() {
  const { color } = useTheme();
  const { idToken, user } = useAuth();
  const { manifest, orgId } = useConsole();
  const [board, setBoard] = useState<AttendanceOverview | null>(null);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [ranking, setRanking] = useState<AttendanceRanking[]>([]);
  const [tab, setTab] = useState<Tab>('today');
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readAt, setReadAt] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const live = useRef(true);

  const workspace = manifest?.org.name ?? user?.tenant_name ?? '';
  const todayIso = todayIn(manifest?.org.timezone);

  // Which month the calendar shows, and which day the board is opened on. Neither
  // is the default: the calendar starts on the current month and the board on today,
  // and a tap on a past day moves both the board and the Today tab to it.
  const [cursor, setCursor] = useState<{ year: number; month: number } | null>(null);
  const [boardDate, setBoardDate] = useState<string | null>(null);
  const viewYear = cursor?.year ?? Number(todayIso.slice(0, 4));
  const viewMonth = cursor?.month ?? Number(todayIso.slice(5, 7));
  const statsDays = windowDays(viewYear, viewMonth, todayIso);

  const load = useCallback(
    async (quiet = false) => {
      if (!idToken) return;
      if (!quiet) setRefreshing(true);
      try {
        const [overview, trend, ranks] = await Promise.all([
          dashboardApi.attendanceOverview(idToken, boardDate),
          dashboardApi.attendanceStats(idToken, statsDays).catch(() => null),
          dashboardApi.attendanceRanking(idToken, statsDays).catch(() => []),
        ]);
        if (!live.current) return;
        setBoard(overview);
        setStats(trend);
        setRanking(ranks);
        setReadAt(new Date());
        setError(null);
        setUnavailable(null);
      } catch (cause) {
        if (!live.current) return;
        if (isNotEnabled(cause)) {
          setUnavailable(errorMessage(cause, 'Attendance is not enabled for this workspace.'));
          setError(null);
        } else if (!quiet) {
          // A failed background poll keeps the last good board on screen
          // rather than replacing real numbers with an error.
          setError(errorMessage(cause, "We couldn't load attendance."));
        }
      } finally {
        if (live.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // orgId: a centre switch changes every number here.
    [idToken, boardDate, statsDays, orgId],
  );

  // Poll only while the screen is actually being looked at.
  useFocusEffect(
    useCallback(() => {
      live.current = true;
      load(true);
      const poll = setInterval(() => load(true), POLL_MS);
      const tick = setInterval(() => setNow(new Date()), 10000);
      return () => {
        live.current = false;
        clearInterval(poll);
        clearInterval(tick);
      };
    }, [load]),
  );

  useEffect(() => {
    if (board) setNow(new Date());
  }, [board]);

  const present = board?.roster.filter((entry) => entry.present) ?? [];
  const away = board?.roster.filter((entry) => !entry.present) ?? [];
  const quiet = (board?.checked_in_today ?? 0) === 0;

  /**
   * When today is empty, the most useful thing on the screen is what a normal
   * day looks like — otherwise a board of zeros is indistinguishable from a
   * broken one. Found from the trend rather than another request.
   */
  const lastActive = useMemo(() => {
    if (!stats?.daily?.length || !quiet) return null;
    const today = board?.date;
    for (let i = stats.daily.length - 1; i >= 0; i -= 1) {
      const day = stats.daily[i];
      if (day.people > 0 && day.date !== today) return day;
    }
    return null;
  }, [stats, quiet, board?.date]);

  /** A workspace that has never had a check-in is a setup problem, not a quiet day. */
  const neverSeen = useMemo(
    () => quiet && !!stats?.daily?.length && stats.daily.every((day) => day.people === 0),
    [quiet, stats],
  );

  return (
    <Screen
      onBack={() => goBack('/(tabs)')}
      titleSize="display"
      title="Attendance"
      subtitle={workspace}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load()} tintColor={color.accent} />
      }
    >
      <View style={styles.controls}>
        <View style={[styles.clock, { borderColor: color.border }]}>
          <View style={[styles.pulse, { backgroundColor: color.success }]} />
          <Text style={[font.mono, { color: color.textMuted }]}>
            {hhmm(readAt)} · {ago(readAt, now)}
          </Text>
        </View>
      </View>

      {error ? (
        <Banner tone="error" title="Couldn't load" message={error} onRetry={() => void load()} />
      ) : null}

      {loading ? (
        <SkeletonCard lines={4} />
      ) : unavailable ? (
        <EmptyState
          icon="profile"
          title="Not enabled here"
          hint={`${unavailable} Ask your workspace admin to turn it on.`}
        />
      ) : !board ? null : (
        <>
          {/* Someone recognised in the last half-minute. */}
          {board.now_welcoming ? (
            <Panel>
              <View style={styles.welcome}>
                <Face
                  name={board.now_welcoming.person}
                  photo={board.now_welcoming.photo}
                  size={52}
                />
                <View style={styles.fill}>
                  <Text style={[font.heading, { color: color.text }]}>
                    Welcome, {board.now_welcoming.person}
                  </Text>
                  <Text style={[font.mono, { color: color.textFaint }]}>
                    {board.now_welcoming.camera} · {board.now_welcoming.at}
                  </Text>
                </View>
              </View>
            </Panel>
          ) : null}

          {/* ── The hero. One number, always visible, above the tabs. ───── */}
          <Panel>
            <SectionRule label={`In the building · ${workspace}`} />
            <View style={styles.figureRow}>
              <Text style={[font.figure, { color: color.text }]}>
                {board.facility_occupancy}
              </Text>
              <Text style={[font.title, styles.figureWord, { color: color.textMuted }]}>
                {board.facility_occupancy === 0
                  ? 'building clear'
                  : board.facility_occupancy === 1
                    ? 'person on site'
                    : 'people on site'}
              </Text>
            </View>
            <Text style={[font.mono, { color: color.textFaint }]}>
              {[board.active_hours, `${board.people_in} in`, `${board.people_out} out`]
                .filter(Boolean)
                .join(' · ')}
            </Text>

            <View style={[styles.note, { backgroundColor: color.surfaceSunken }]}>
              <Icon name={neverSeen ? 'warning' : 'info'} size={14} color={color.textFaint} />
              <Text style={[font.body, styles.fill, { color: color.textMuted }]}>
                {neverSeen
                  ? `No one has ever been recognised here, though ${board.enrolled_total} people are enrolled. Worth checking the cameras.`
                  : quiet
                    ? lastActive
                      ? `Nothing yet today · ${dayLabel(lastActive.date)} ${lastActive.people} were in`
                      : 'Building clear · no check-ins recorded yet'
                    : `${board.checked_in_today} of ${board.enrolled_total} checked in today`}
              </Text>
            </View>
          </Panel>

          <View style={styles.tabs}>
            {TABS.map((entry) => (
              <Pressable
                key={entry.key}
                onPress={() => setTab(entry.key)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: tab === entry.key ? color.accentSoft : 'transparent',
                    borderColor: tab === entry.key ? color.accentLine : color.border,
                  },
                ]}
              >
                <Text
                  style={[
                    font.label,
                    { color: tab === entry.key ? color.accent : color.textMuted },
                  ]}
                >
                  {entry.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ── Today ───────────────────────────────────────────────────── */}
          {tab === 'today' ? (
            <>
              {boardDate ? (
                <Panel>
                  <View style={styles.dayPick}>
                    <View style={styles.dayPickText}>
                      <Text style={[font.eyebrow, { color: color.textFaint }]}>Showing</Text>
                      <Text style={[font.heading, { color: color.text }]}>
                        {new Date(`${boardDate}T12:00:00`).toLocaleDateString(undefined, {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </Text>
                    </View>
                    <Button label="Back to today" variant="ghost" onPress={() => setBoardDate(null)} />
                  </View>
                </Panel>
              ) : null}

              <Panel padded={false}>
                <View style={styles.panelHead}>
                  <SectionRule
                    label="Checked in here"
                    meta={`${board.checked_in_today} of ${board.enrolled_total}`}
                  />
                </View>
                <View style={[styles.divider, { backgroundColor: color.border }]} />
                <StatColumns
                  stats={[
                    {
                      label: 'On time',
                      value: `${board.on_time_rate.toFixed(1)}%`,
                      tone: board.on_time_rate > 0 ? 'good' : 'default',
                    },
                    { label: 'Avg arrival', value: board.avg_arrival ?? 'No data' },
                    { label: 'Greetings', value: String(board.greetings_today) },
                  ]}
                />
              </Panel>

              <Panel>
                <SectionRule
                  label="Recent arrivals"
                  meta={board.recent_arrivals.length ? `${board.recent_arrivals.length} today` : undefined}
                  glyph={board.recent_arrivals.length ? <Text>{MEDALS[0]}</Text> : undefined}
                />
                {board.recent_arrivals.length ? (
                  <View style={styles.rows}>
                    {board.recent_arrivals.map((arrival, index) => (
                      <View key={`${arrival.person}-${arrival.at}`} style={styles.personRow}>
                        <Text style={[font.mono, styles.rank, { color: color.textFaint }]}>
                          {MEDALS[index] ?? index + 1}
                        </Text>
                        <Face name={arrival.person} photo={arrival.photo} size={32} />
                        <View style={styles.fill}>
                          <Text style={[font.body, { color: color.text }]} numberOfLines={1}>
                            {arrival.person}
                          </Text>
                          <Text style={[font.monoSmall, { color: color.textFaint }]}>
                            {arrival.camera}
                          </Text>
                        </View>
                        <Text
                          style={[
                            font.mono,
                            { color: arrival.on_time ? color.success : color.textMuted },
                          ]}
                        >
                          {arrival.at}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Hollow text="No one has arrived yet today." />
                )}
              </Panel>
            </>
          ) : null}

          {/* ── People ──────────────────────────────────────────────────── */}
          {tab === 'people' ? (
            <>
              <Panel>
                <SectionRule
                  label="Who's in today"
                  subtitle={`${present.length} present · ${away.length} out`}
                />
                {present.length ? (
                  <View style={styles.faces}>
                    {present.map((entry) => (
                      <View key={entry.person} style={styles.face}>
                        <Face name={entry.person} photo={entry.photo} />
                        <Text
                          numberOfLines={1}
                          style={[font.monoSmall, { color: color.text }]}
                        >
                          {entry.person}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Hollow text="Nobody recognised yet today." />
                )}
              </Panel>

              {away.length ? (
                <Panel>
                  <SectionRule label="Not in yet" meta={`${away.length}`} />
                  <View style={styles.faces}>
                    {away.map((entry) => (
                      <View key={entry.person} style={styles.face}>
                        <Face name={entry.person} photo={entry.photo} present={false} />
                        <Text
                          numberOfLines={1}
                          style={[font.monoSmall, { color: color.textFaint }]}
                        >
                          {entry.person}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Panel>
              ) : null}
            </>
          ) : null}

          {/* ── Trend ───────────────────────────────────────────────────── */}
          {tab === 'trend' ? (
            <>
              {stats ? (
                <Panel>
                  <SectionRule
                    label="Headcount by day"
                    meta={`avg ${stats.avg_people}`}
                    subtitle={
                      stats.best_day
                        ? `busiest ${dayLabel(stats.best_day)} · ${stats.best_day_people} people`
                        : undefined
                    }
                  />
                  <HeatCalendar
                    days={stats.daily ?? []}
                    year={viewYear}
                    month={viewMonth}
                    todayIso={todayIso}
                    selectedIso={boardDate ?? todayIso}
                    onPrev={() =>
                      setCursor({
                        year: viewMonth === 1 ? viewYear - 1 : viewYear,
                        month: viewMonth === 1 ? 12 : viewMonth - 1,
                      })
                    }
                    onNext={() =>
                      setCursor({
                        year: viewMonth === 12 ? viewYear + 1 : viewYear,
                        month: viewMonth === 12 ? 1 : viewMonth + 1,
                      })
                    }
                    onSelectDay={(day) => {
                      setBoardDate(day === todayIso ? null : day);
                      setTab('today');
                    }}
                  />
                </Panel>
              ) : null}

              {stats?.weekday?.length ? (
                <Panel>
                  <SectionRule label="By weekday" />
                  <View style={styles.rows}>
                    {stats.weekday.map((day) => {
                      const peak = Math.max(1, ...stats.weekday.map((d) => d.avg_people));
                      return (
                        <View key={day.weekday} style={styles.personRow}>
                          <Text style={[font.mono, styles.day, { color: color.textFaint }]}>
                            {day.weekday.slice(0, 3)}
                          </Text>
                          <View
                            style={[styles.track, styles.fill, { backgroundColor: color.surfaceSunken }]}
                          >
                            <View
                              style={[
                                styles.fillBar,
                                {
                                  backgroundColor: color.accentBright,
                                  width: `${Math.max(day.avg_people ? 3 : 0, (day.avg_people / peak) * 100)}%`,
                                },
                              ]}
                            />
                          </View>
                          <Text style={[font.mono, styles.count, { color: color.text }]}>
                            {day.avg_people}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Panel>
              ) : null}

              <Panel>
                <SectionRule
                  label="Time in office"
                  subtitle={`last ${stats?.window_days ?? statsDays} days`}
                />
                {ranking.some((entry) => entry.hours > 0) ? (
                  <View style={styles.rows}>
                    {ranking.slice(0, 10).map((entry, index) => {
                      const peak = Math.max(1, ...ranking.map((row) => row.hours));
                      return (
                        <View key={entry.person} style={styles.barRow}>
                          <View style={styles.personRow}>
                            <Text style={[font.mono, styles.rank, { color: color.textFaint }]}>
                              {index + 1}
                            </Text>
                            <Text
                              style={[font.body, styles.fill, { color: color.text }]}
                              numberOfLines={1}
                            >
                              {entry.person}
                            </Text>
                            <Text style={[font.mono, { color: color.textMuted }]}>
                              {entry.hours.toFixed(1)}h · {entry.days_present}d
                            </Text>
                          </View>
                          <View style={[styles.track, { backgroundColor: color.surfaceSunken }]}>
                            <View
                              style={[
                                styles.fillBar,
                                {
                                  backgroundColor: color.accentBright,
                                  width: `${Math.max(2, (entry.hours / peak) * 100)}%`,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  // Twenty rows of "0.0h · 0d" say nothing; one line says it.
                  <Hollow
                    text={`No time on site recorded in the last ${stats?.window_days ?? statsDays} days.`}
                  />
                )}
              </Panel>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Hollow({ text }: { text: string }) {
  const { color } = useTheme();
  return <Text style={[font.body, styles.hollow, { color: color.textFaint }]}>{text}</Text>;
}

function Panel({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: color.surface, borderColor: color.border }]}>
      <DotField />
      <View style={padded ? styles.panelBody : undefined}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayPick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  dayPickText: { flex: 1, gap: 2 },
  fill: { flex: 1 },
  controls: { flexDirection: 'row', gap: space.sm },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  },
  pulse: { width: 6, height: 6, borderRadius: radius.pill },
  tabs: { flexDirection: 'row', gap: space.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  },
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.xl, overflow: 'hidden' },
  panelBody: { padding: space.lg, gap: space.md },
  panelHead: { padding: space.lg },
  divider: { height: StyleSheet.hairlineWidth },
  figureRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  figureWord: { paddingBottom: space.sm },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  welcome: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  faces: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  face: { width: 58, alignItems: 'center', gap: space.xs },
  rows: { gap: space.md },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rank: { width: 22 },
  day: { width: 34 },
  count: { width: 30, textAlign: 'right' },
  barRow: { gap: space.xs },
  track: { height: 3, borderRadius: radius.pill, overflow: 'hidden' },
  fillBar: { height: '100%', borderRadius: radius.pill },
  hollow: { textAlign: 'center', paddingVertical: space.lg },
});
