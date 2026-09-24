import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { dashboardApi } from '@/api/dashboard';
import { Alert } from '@/api/types';
import { Banner } from '@/components/Banner';
import { ChipGroup } from '@/components/ChipGroup';
import { EmptyState } from '@/components/EmptyState';
import { ListGroup, ListRow } from '@/components/ListRow';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/Skeleton';
import { errorMessage } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useConsole } from '@/state/console';
import { useLive } from '@/state/live';
import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';

type Status = 'active' | 'acknowledged' | 'history';

const FILTERS: { label: string; status: Status }[] = [
  { label: 'Open', status: 'active' },
  { label: 'Acknowledged', status: 'acknowledged' },
  { label: 'History', status: 'history' },
];

function when(raw: string | null): string {
  if (!raw) return '';
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return '';
  const today = new Date();
  const sameDay = at.toDateString() === today.toDateString();
  return at.toLocaleString(undefined, {
    ...(sameDay ? {} : { day: 'numeric', month: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
  });
}

function severityTone(severity: string | null): 'live' | 'accent' | 'neutral' {
  if (severity === 'critical' || severity === 'high') return 'live';
  if (severity === 'medium') return 'accent';
  return 'neutral';
}

/**
 * The dashboard's alerts for the centre this login has open.
 *
 * The list is GET /alerts, exactly what the web console shows. It stays current two
 * ways: the live socket bumps `revision` whenever the dashboard pushes an `alert` or
 * `event`, and pull-to-refresh asks again. Acknowledging goes straight to the
 * dashboard and needs the `alerts.acknowledge` permission — a viewer sees the list but
 * no button, which is what the server would enforce anyway.
 */
export default function Alerts() {
  const { color } = useTheme();
  const { idToken } = useAuth();
  const { can, orgId, siteId, status: consoleStatus } = useConsole();
  const live = useLive();
  const [filter, setFilter] = useState<Status>('active');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [unavailable, setUnavailable] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const canView = can('alerts.view');
  const canAcknowledge = can('alerts.acknowledge');
  const liveHere = live.isConnected && (!live.forOrgId || live.forOrgId === orgId);

  const load = useCallback(
    async (quiet = false) => {
      if (!idToken || consoleStatus !== 'ready' || !canView) return;
      if (!quiet) setRefreshing(true);
      try {
        const page = await dashboardApi.alerts(idToken, filter, { siteId });
        setAlerts(page.alerts);
        setActiveCount(page.active_count);
        setUnavailable(page.unavailable_cameras);
        setError(null);
      } catch (cause) {
        setError(errorMessage(cause, "We couldn't load alerts."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [idToken, consoleStatus, canView, filter, siteId],
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, orgId]);

  // A pushed alert or event means the list on the dashboard just changed; ask for it
  // again rather than trying to reconstruct a row from the socket's summary. Skip the
  // first render — the mount load already covers it.
  const seen = useRef(live.revision);
  useEffect(() => {
    if (live.revision === seen.current) return;
    seen.current = live.revision;
    void load(true);
  }, [live.revision, load]);

  const acknowledge = async (alert: Alert) => {
    if (!idToken || busy) return;
    setBusy(alert.alert_id);
    try {
      await dashboardApi.acknowledgeAlert(idToken, alert.alert_id);
      // Already gone from "Open" as far as the server is concerned; reflect that now.
      setAlerts((prev) => (filter === 'active' ? prev.filter((a) => a.alert_id !== alert.alert_id) : prev));
      setActiveCount((n) => Math.max(0, n - 1));
    } catch (cause) {
      setError(errorMessage(cause, "We couldn't acknowledge that alert."));
    } finally {
      setBusy(null);
    }
  };

  const subtitle = !canView
    ? 'Your role does not include alerts here.'
    : activeCount
      ? `${activeCount} open${liveHere ? ' · live' : ''}`
      : liveHere
        ? 'Nothing open · live'
        : 'Nothing open';

  return (
    <Screen
      tabBar
      eyebrow="Activity"
      title="Alerts"
      subtitle={subtitle}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={color.accent} />
      }
    >
      {!canView ? (
        <EmptyState icon="alerts" title="Not available" hint="Ask your administrator for the alerts permission on the dashboard." />
      ) : (
        <>
          <ChipGroup
            label="Show"
            options={FILTERS.map((f) => f.label)}
            value={FILTERS.find((f) => f.status === filter)?.label ?? 'Open'}
            onChange={(label) => {
              const next = FILTERS.find((f) => f.label === label);
              if (next) setFilter(next.status);
            }}
          />

          {error ? <Banner tone="error" title="Couldn't load" message={error} /> : null}

          {unavailable.length ? (
            <Banner
              tone="error"
              title={`${unavailable.length} camera${unavailable.length === 1 ? '' : 's'} not heard from`}
              message={unavailable.map((c) => c.name).join(', ')}
            />
          ) : null}

          {loading ? (
            <SkeletonCard lines={3} />
          ) : alerts.length ? (
            <ListGroup title={`${alerts.length} alert${alerts.length === 1 ? '' : 's'}`}>
              {alerts.map((alert) => (
                <ListRow
                  key={alert.alert_id}
                  icon="alerts"
                  label={alert.label}
                  hint={[when(alert.created_at), alert.location, alert.centre?.name].filter(Boolean).join(' · ')}
                  tone={alert.severity === 'critical' || alert.severity === 'high' ? 'danger' : 'default'}
                  right={
                    alert.acknowledged ? (
                      <Pill label="Acknowledged" tone="idle" />
                    ) : (
                      <Pill label={alert.severity ?? 'alert'} tone={severityTone(alert.severity)} dot />
                    )
                  }
                  onPress={
                    canAcknowledge && !alert.acknowledged && filter === 'active'
                      ? () => void acknowledge(alert)
                      : undefined
                  }
                />
              ))}
            </ListGroup>
          ) : !error ? (
            <EmptyState
              icon="alerts"
              title={filter === 'active' ? 'Nothing open' : 'Nothing here'}
              hint={
                filter === 'active'
                  ? 'New alerts from your cameras appear here as they happen.'
                  : 'Alerts you have dealt with will be listed here.'
              }
            />
          ) : null}

          {canAcknowledge && filter === 'active' && alerts.length ? (
            <View style={styles.note}>
              <Text style={[font.caption, { color: color.textFaint }]}>
                Tap an alert to acknowledge it. This is the same action as on the dashboard.
              </Text>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: space.xs, paddingTop: space.sm },
});
