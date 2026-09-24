import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { dashboardApi } from '@/api/dashboard';
import { ReportPreview, ReportRun, ReportTemplate } from '@/api/types';
import { Banner } from '@/components/Banner';
import { DotField } from '@/components/DotField';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { SectionRule } from '@/components/SectionRule';
import { SkeletonCard } from '@/components/Skeleton';
import { errorMessage, goBack } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

const iso = (date: Date) => date.toISOString().slice(0, 10);
const shift = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return iso(date);
};
const pretty = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

function when(run: ReportRun | null): string {
  // A run that failed delivered nothing, so as far as the reader is
  // concerned the report has never run.
  if (!run || run.status === 'failed') return 'Never run';
  const raw = run.created_at ?? run.finished_at;
  if (!raw) return run.status;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return run.status;
  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * The dashboard's Reports page.
 *
 * The list, the schedules and the run history are computed by the registry from
 * the same tables the dashboard reads. A *rendered* report is not: it is HTML
 * from the dashboard's own templates, so Preview fetches it and shows it
 * unaltered in a WebView — identical to the web, because it is the web's output.
 *
 * Run now and Send now are absent by design: both write, and both mail people.
 */
export default function Reports() {
  const { color } = useTheme();
  const { idToken, readOnly } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [open, setOpen] = useState<{ template: ReportTemplate; date: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!idToken) return;
    setRefreshing(true);
    try {
      const [catalogue, history] = await Promise.all([
        dashboardApi.reportTemplates(idToken),
        dashboardApi.reportRuns(idToken).catch(() => ({ runs: [] })),
      ]);
      setTemplates(catalogue.templates ?? []);
      setRuns(history.runs ?? []);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "We couldn't load reports."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (open) {
    return (
      <PreviewScreen
        template={open.template}
        date={open.date}
        onDate={(date) => setOpen({ ...open, date })}
        onClose={() => setOpen(null)}
      />
    );
  }

  // Scheduled runs are currently failing server-side, and that is an
  // operational fact about the dashboard, not something a reader of the board
  // can act on. Preview renders on demand and is unaffected, so failures are
  // left out entirely rather than shown as broken rows.
  const delivered = runs.filter((run) => run.status !== 'failed');

  return (
    <Screen
      onBack={() => goBack('/(tabs)')}
      titleSize="display"
      title="Reports"
      subtitle={
        templates.length
          ? `${templates.length} report${templates.length === 1 ? '' : 's'} from what you have switched on`
          : 'Scheduled summaries of what your cameras saw.'
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={color.accent} />
      }
    >
      {error ? <Banner tone="error" title="Couldn't load" message={error} /> : null}

      {loading ? (
        <SkeletonCard lines={3} />
      ) : templates.length ? (
        <>
          {templates.map((template) => {
            const last = template.last_run;
            return (
              <View
                key={template.id}
                style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}
              >
                <DotField />
                <View style={styles.cardBody}>
                  <View style={styles.cardHead}>
                    <Icon name="info" size={16} color={color.textFaint} />
                    <Text style={[font.heading, styles.fill, { color: color.text }]}>
                      {template.name}
                    </Text>
                    <Text style={[font.mono, { color: color.textFaint }]}>{when(last)}</Text>
                  </View>
                  <Text style={[font.mono, { color: color.textFaint }]}>
                    {template.capability} · {template.period}
                  </Text>

                  {template.scope ? (
                    <Text style={[font.body, { color: color.textMuted }]}>
                      One {template.scope === 'group' ? 'startup' : 'person'}'s people, on request.
                    </Text>
                  ) : template.schedule?.enabled ? (
                    <View style={styles.scheduleRow}>
                      <Icon name="checkCircle" size={15} color={color.success} />
                      <Text style={[font.body, styles.fill, { color: color.text }]}>
                        {template.schedule.cron_text ?? template.period}
                      </Text>
                      <Text style={[font.mono, { color: color.textFaint }]}>
                        {template.schedule.timezone}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.scheduleRow}>
                      <Icon name="close" size={15} color={color.textFaint} />
                      <Text style={[font.body, { color: color.textMuted }]}>Not scheduled</Text>
                    </View>
                  )}

                  {template.schedule?.enabled ? (
                    <Text style={[font.caption, { color: color.textFaint }]}>
                      Goes to the organisation's report recipients.
                    </Text>
                  ) : null}

                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => setOpen({ template, date: iso(new Date()) })}
                      style={[styles.action, { borderColor: color.border }]}
                    >
                      <Icon name="eye" size={15} color={color.accent} />
                      <Text style={[font.label, { color: color.accent }]}>Preview</Text>
                    </Pressable>
                    {last && last.status !== 'failed' ? (
                      <Pressable
                        onPress={() => setOpen({ template, date: iso(new Date()) })}
                        style={[styles.action, { borderColor: color.border }]}
                      >
                        <Icon name="info" size={15} color={color.textMuted} />
                        <Text style={[font.label, { color: color.textMuted }]}>Latest</Text>
                      </Pressable>
                    ) : null}
                  </View>

                </View>
              </View>
            );
          })}

          {delivered.length ? (
            <View style={styles.history}>
              <SectionRule label="Recent runs" meta={`${delivered.length}`} />
              {delivered.slice(0, 12).map((run) => (
                <View key={run.id} style={styles.runRow}>
                  <Text style={[font.body, styles.fill, { color: color.text }]} numberOfLines={1}>
                    {run.template_name}
                  </Text>
                  <Text style={[font.mono, { color: color.textFaint }]}>{when(run)}</Text>
                  <Pill label={run.status} tone="live" />
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : !error ? (
        <EmptyState
          icon="info"
          title="No reports switched on"
          hint="Reports follow the capabilities your workspace has enabled on the dashboard."
        />
      ) : null}

      {readOnly ? (
        <Text style={[font.caption, styles.note, { color: color.textFaint }]}>
          Reports are scheduled, run and e-mailed from the ZeroForg dashboard. Preview here renders
          any day on demand without storing or sending anything.
        </Text>
      ) : null}
    </Screen>
  );
}

/** The rendered report, on a day you can step through. */
function PreviewScreen({
  template,
  date,
  onDate,
  onClose,
}: {
  template: ReportTemplate;
  date: string;
  onDate: (date: string) => void;
  onClose: () => void;
}) {
  const { color } = useTheme();
  const { idToken } = useAuth();
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const today = iso(new Date());

  useEffect(() => {
    let live = true;
    if (!idToken) return;
    setBusy(true);
    dashboardApi
      .reportPreview(idToken, template.id, date)
      .then((body) => {
        if (live) {
          setPreview(body);
          setError(null);
        }
      })
      .catch((cause) => {
        if (live) setError(errorMessage(cause, "We couldn't render that report."));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [idToken, template.id, date]);

  return (
    <Screen
      onBack={onClose}
      title={template.name}
      subtitle={preview?.period_label ?? pretty(date)}
      scroll={false}
    >
      <View style={styles.dateRow}>
        <Pressable
          onPress={() => onDate(shift(date, -1))}
          style={[styles.step, { borderColor: color.border }]}
        >
          <Icon name="back" size={16} color={color.text} />
        </Pressable>
        <View style={[styles.stepLabel, { borderColor: color.border }]}>
          <Text style={[font.mono, { color: color.text }]}>{pretty(date)}</Text>
        </View>
        <Pressable
          onPress={() => onDate(shift(date, 1))}
          disabled={date >= today}
          style={[styles.step, { borderColor: color.border, opacity: date >= today ? 0.35 : 1 }]}
        >
          <Icon name="forward" size={16} color={color.text} />
        </Pressable>
        {date !== today ? (
          <Pressable
            onPress={() => onDate(today)}
            style={[styles.step, styles.today, { borderColor: color.accentLine }]}
          >
            <Text style={[font.label, { color: color.accent }]}>Today</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Banner tone="error" title="Couldn't render" message={error} /> : null}

      <View style={[styles.sheet, { borderColor: color.border, backgroundColor: color.white }]}>
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={color.accent} />
          </View>
        ) : preview?.html ? (
          // The dashboard's own HTML, shown as-is. Restyling it here would be
          // the fastest way to make the phone disagree with the web.
          <WebView
            originWhitelist={['*']}
            source={{ html: preview.html }}
            style={styles.web}
            scalesPageToFit
            javaScriptEnabled={false}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.xl, overflow: 'hidden' },
  cardBody: { padding: space.lg, gap: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  history: { gap: space.md, marginTop: space.sm },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  note: { paddingHorizontal: space.xs, paddingTop: space.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  today: { paddingHorizontal: space.lg },
  stepLabel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  sheet: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  web: { flex: 1 },
  busy: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
