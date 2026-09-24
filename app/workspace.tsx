import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { dashboardApi } from '@/api/dashboard';
import { WorkspaceSettings } from '@/api/types';
import { Banner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { DetailList } from '@/components/DetailList';
import { Icon } from '@/components/Icon';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { SiteSwitcher } from '@/components/SiteSwitcher';
import { SectionRule } from '@/components/SectionRule';
import { SkeletonCard } from '@/components/Skeleton';
import { errorMessage, goBack } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useConsole } from '@/state/console';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

const title = (key: string) =>
  key.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase());

const when = (raw: string | null) => {
  if (!raw) return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime())
    ? null
    : at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * The workspace exactly as it is configured on the dashboard.
 *
 * Every panel here is a view. Changing any of it — a feature switch, an alert
 * rule, who is on the team — happens on the dashboard, and the banner at the
 * top says so rather than each row pretending to be tappable.
 */
export default function Workspace() {
  const { color } = useTheme();
  const { idToken } = useAuth();
  const { orgName, orgId } = useConsole();
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!idToken) return;
    setRefreshing(true);
    try {
      setSettings(await dashboardApi.settings(idToken));
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "We couldn't load your workspace."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // orgId: the switcher on this screen changes which workspace the panels describe.
  }, [idToken, orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const attendance = settings?.preferences.attendance ?? {};

  return (
    <Screen
      onBack={() => goBack('/(tabs)')}
      eyebrow="Admin"
      title="Workspace"
      subtitle={orgName ?? settings?.workspace.name ?? 'How this workspace is set up.'}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={color.accent} />
      }
    >
      {/* Above the panels: the switcher changes which workspace they describe. */}
      <SiteSwitcher />

      {error ? (
        <Banner tone="error" title="Couldn't load" message={error} onRetry={() => void load()} />
      ) : null}

      {loading ? (
        <SkeletonCard lines={4} />
      ) : !settings ? null : (
        <>
          {settings.access.read_only && settings.access.reason ? (
            <Card>
              <View style={styles.noteRow}>
                <Icon name="eye" size={18} color={color.textFaint} />
                <Text style={[font.caption, styles.fill, { color: color.textMuted }]}>
                  {settings.access.reason}
                </Text>
              </View>
            </Card>
          ) : null}

          <DetailList
            title="Workspace"
            rows={[
              { label: 'Name', value: settings.workspace.name },
              { label: 'Slug', value: settings.workspace.slug },
              { label: 'Type', value: settings.workspace.type },
              { label: 'Status', value: settings.workspace.status },
              { label: 'Your role', value: settings.access.role },
              { label: 'Timezone', value: settings.preferences.timezone },
              { label: 'Pack', value: settings.preferences.pack },
              { label: 'Created', value: when(settings.workspace.created_at) },
            ]}
          />

          <Card>
            <SectionRule label="Features" />
            <View style={styles.chips}>
              {Object.entries(settings.preferences.features).map(([key, on]) => (
                <Pill key={key} label={title(key)} tone={on ? 'live' : 'idle'} />
              ))}
              {settings.capabilities.map((capability) => (
                <Pill
                  key={capability.key}
                  label={title(capability.key)}
                  tone={capability.enabled ? 'accent' : 'idle'}
                />
              ))}
            </View>
          </Card>

          <Card>
            <SectionRule label="Cameras" meta={`${settings.cameras.length}`} />
            <View style={styles.list}>
              {settings.cameras.map((camera) => (
                <View key={camera.id} style={styles.row}>
                  <View style={styles.fill}>
                    <Text style={[font.body, { color: color.text }]}>{camera.name}</Text>
                    <Text style={[font.caption, { color: color.textFaint }]}>
                      {[
                        camera.detection_mode,
                        `${camera.zones} area${camera.zones === 1 ? '' : 's'}`,
                        camera.capabilities.map(title).join(', ') || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Pill
                    label={camera.status}
                    tone={camera.status === 'online' ? 'live' : 'idle'}
                  />
                </View>
              ))}
            </View>
          </Card>

          {settings.sites.length ? (
            <Card>
              <SectionRule label="Sites" />
              <View style={styles.list}>
                {settings.sites.map((site) => (
                  <View key={site.id} style={styles.row}>
                    <View style={styles.fill}>
                      <Text style={[font.body, { color: color.text }]}>{site.name}</Text>
                      {site.address ? (
                        <Text style={[font.caption, { color: color.textFaint }]}>
                          {site.address}
                        </Text>
                      ) : null}
                    </View>
                    <Pill label={`${site.cameras} cameras`} tone="accent" />
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {Object.keys(attendance).length ? (
            <DetailList
              title="Attendance board"
              rows={[
                { label: 'On-time cutoff', value: String(attendance.on_time_cutoff ?? 'Not set') },
                {
                  label: 'Active hours',
                  value: Array.isArray(attendance.active_hours)
                    ? `${attendance.active_hours[0]}:00 – ${attendance.active_hours[1]}:00`
                    : 'Not set',
                },
                { label: 'Match threshold', value: String(attendance.min_score ?? 'Not set') },
                {
                  label: 'Arrival cameras',
                  value: (attendance.arrival_camera_names as string[] | undefined)?.join(', ') ?? 'None',
                },
                {
                  label: 'Counts people in',
                  value:
                    (attendance.occupancy_in_camera_names as string[] | undefined)?.join(', ') ?? 'None',
                },
                {
                  label: 'Counts people out',
                  value:
                    (attendance.occupancy_out_camera_names as string[] | undefined)?.join(', ') ??
                    'None',
                },
              ]}
            />
          ) : null}

          <Card>
            <SectionRule label="Team" meta={`${settings.team.length}`} />
            <View style={styles.list}>
              {settings.team.map((member) => (
                <View key={member.user_id ?? member.email} style={styles.row}>
                  <View style={styles.fill}>
                    <Text style={[font.body, { color: color.text }]}>
                      {member.name || member.email}
                    </Text>
                    <Text style={[font.caption, { color: color.textFaint }]}>
                      {member.name ? member.email : member.status}
                    </Text>
                  </View>
                  <Pill label={member.role} tone="accent" />
                </View>
              ))}
            </View>
          </Card>

          {settings.alert_rules.length ? (
            <Card>
              <SectionRule label="Alert rules" />
              <View style={styles.list}>
                {settings.alert_rules.map((rule) => (
                  <View key={rule.id} style={styles.row}>
                    <View style={styles.fill}>
                      <Text style={[font.body, { color: color.text }]}>
                        {title(rule.alert_type)}
                      </Text>
                      <Text style={[font.caption, { color: color.textFaint }]}>
                        {[rule.severity, rule.channels.map(title).join(', ')]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Pill label={rule.enabled ? 'On' : 'Off'} tone={rule.enabled ? 'live' : 'idle'} />
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {settings.notifications.length ? (
            <Card>
              <SectionRule label="Who gets notified" />
              <View style={styles.list}>
                {settings.notifications.map((recipient) => (
                  <View key={`${recipient.kind}-${recipient.target}`} style={styles.row}>
                    <View style={styles.fill}>
                      <Text style={[font.body, { color: color.text }]}>{recipient.target}</Text>
                      <Text style={[font.caption, { color: color.textFaint }]}>
                        {recipient.kind}
                      </Text>
                    </View>
                    <View style={styles.tags}>
                      {recipient.reports ? <Pill label="Reports" tone="accent" /> : null}
                      {recipient.alerts ? <Pill label="Alerts" tone="live" /> : null}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { gap: space.md, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  tags: { flexDirection: 'row', gap: space.xs },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
});
