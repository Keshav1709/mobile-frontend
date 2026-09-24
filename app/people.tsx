import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { dashboardApi } from '@/api/dashboard';
import { FaceCluster, PeopleIndex, UnknownFaces } from '@/api/types';
import { Banner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { SectionRule } from '@/components/SectionRule';
import { SkeletonCard } from '@/components/Skeleton';
import { errorMessage, goBack } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

const initials = (name: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const seen = (raw: string | null) => {
  if (!raw) return '';
  const at = new Date(raw);
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

type Tab = 'enrolled' | 'unknown' | 'groups';
const TABS: { key: Tab; label: string }[] = [
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'unknown', label: 'Unknown' },
  { key: 'groups', label: 'Groups' },
];

const PAGE = 60;

/**
 * Who the cameras know, and who they do not.
 *
 * Unknown faces carry their crop in the row, so they are shown as pictures.
 * Enrolled people do not — those stills are in cloud storage the app cannot
 * reach — so they get initials. Naming a face is done on the dashboard.
 */
export default function People() {
  const { color } = useTheme();
  const { idToken } = useAuth();
  const [index, setIndex] = useState<PeopleIndex | null>(null);
  const [unknown, setUnknown] = useState<UnknownFaces | null>(null);
  const [clusters, setClusters] = useState<FaceCluster[]>([]);
  const [tab, setTab] = useState<Tab>('enrolled');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    if (!idToken) return;
    setRefreshing(true);
    try {
      const [register, queue, groups] = await Promise.all([
        dashboardApi.people(idToken),
        dashboardApi.unknownFaces(idToken, PAGE, 0).catch(() => null),
        dashboardApi.faceClusters(idToken).catch(() => []),
      ]);
      setIndex(register);
      setUnknown(queue);
      setClusters(groups);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "We couldn't load people."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  const more = useCallback(async () => {
    if (!idToken || !unknown || loadingMore) return;
    const next = unknown.offset + unknown.faces.length;
    if (next >= unknown.total) return;
    setLoadingMore(true);
    try {
      const page = await dashboardApi.unknownFaces(idToken, PAGE, next);
      // Keep the page we already showed and append; the offset stays at the
      // start of the whole list so "more" keeps counting from there.
      setUnknown({ ...page, offset: unknown.offset, faces: [...unknown.faces, ...page.faces] });
    } catch {
      // A failed page is not worth clearing the ones already on screen.
    } finally {
      setLoadingMore(false);
    }
  }, [idToken, unknown, loadingMore]);

  return (
    <Screen
      onBack={() => goBack('/(tabs)')}
      eyebrow="People"
      title="Faces"
      subtitle="Everyone enrolled, and everyone still unrecognised."
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={color.accent} />
      }
    >
      {error ? <Banner tone="error" title="Couldn't load" message={error} /> : null}

      <View style={styles.tabs}>
        {TABS.map((entry) => (
          <Pressable
            key={entry.key}
            onPress={() => setTab(entry.key)}
            style={[
              styles.tab,
              {
                backgroundColor: tab === entry.key ? color.accentSoft : color.surfaceRaised,
                borderColor: tab === entry.key ? color.accentLine : color.border,
              },
            ]}
          >
            <Text
              style={[font.label, { color: tab === entry.key ? color.accent : color.textMuted }]}
            >
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? <SkeletonCard lines={4} /> : null}

      {!loading && tab === 'enrolled' && index ? (
        <>
          <View style={styles.counts}>
            {Object.entries(index.by_category).map(([category, count]) => (
              <Pill key={category} label={`${count} ${category}`} tone="accent" />
            ))}
          </View>
          <Card>
            <SectionRule label="Enrolled" meta={`${index.total}`} />
            <View style={styles.list}>
              {index.people.map((person) => (
                <View key={person.id} style={styles.personRow}>
                  <View style={[styles.avatar, { backgroundColor: color.accentSoft }]}>
                    <Text style={[font.caption, { color: color.accent }]}>
                      {initials(person.name)}
                    </Text>
                  </View>
                  <View style={styles.fill}>
                    <Text style={[font.body, { color: color.text }]}>{person.name}</Text>
                    <Text style={[font.caption, { color: color.textFaint }]}>
                      {[person.category, person.startup_name ?? person.group]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {!loading && tab === 'unknown' ? (
        unknown && unknown.faces.length ? (
          <>
            <View style={styles.counts}>
              {Object.entries(unknown.by_status).map(([status, count]) => (
                <Pill
                  key={status}
                  label={`${count} ${status}`}
                  tone={status === 'promoted' ? 'live' : 'idle'}
                />
              ))}
            </View>

            {clusters.length ? (
              <Card>
                <SectionRule label="Probably the same person" />
                <Text style={[font.caption, { color: color.textMuted }]}>
                  Grouped by the face engine and waiting for a name on the dashboard.
                </Text>
                <View style={styles.list}>
                  {clusters.slice(0, 8).map((cluster) => (
                    <View key={cluster.id} style={styles.personRow}>
                      {cluster.photo ? (
                        <Image
                          source={{ uri: cluster.photo }}
                          style={styles.thumb}
                        />
                      ) : (
                        <View style={[styles.thumb, { backgroundColor: color.surfaceSunken }]} />
                      )}
                      <View style={styles.fill}>
                        <Text style={[font.body, { color: color.text }]}>
                          {cluster.label ?? `${cluster.faces} sightings`}
                        </Text>
                        <Text style={[font.caption, { color: color.textFaint }]}>
                          {cluster.cameras} camera{cluster.cameras === 1 ? '' : 's'} ·{' '}
                          {seen(cluster.last_seen)}
                        </Text>
                      </View>
                      <Pill label={cluster.status ?? '—'} tone="idle" />
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            <Card>
              <SectionRule label="Unrecognised" meta={`${unknown.total}`} />
              <View style={styles.grid}>
                {unknown.faces.map((face) => (
                  <View key={face.id} style={styles.gridItem}>
                    {face.photo ? (
                      <Image
                        source={{ uri: face.photo }}
                        style={styles.crop}
                      />
                    ) : (
                      <View style={[styles.crop, { backgroundColor: color.surfaceSunken }]} />
                    )}
                    <Text
                      numberOfLines={1}
                      style={[font.caption, { color: color.textFaint }]}
                    >
                      {face.camera}
                    </Text>
                  </View>
                ))}
              </View>
              {unknown.offset + unknown.faces.length < unknown.total ? (
                <Pressable
                  onPress={more}
                  style={[styles.more, { borderColor: color.border }]}
                >
                  <Text style={[font.label, { color: color.accent }]}>
                    {loadingMore ? 'Loading…' : 'Show more'}
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          </>
        ) : !error ? (
          <EmptyState
            icon="profile"
            title="No unknown faces"
            hint="Every face the cameras have seen has been recognised."
          />
        ) : null
      ) : null}

      {!loading && tab === 'groups' && index ? (
        index.groups.length ? (
          <Card>
            <SectionRule label="Groups" meta={`${index.groups.length}`} />
            <View style={styles.list}>
              {index.groups.map((group) => (
                <View key={group.id} style={styles.groupRow}>
                  <View style={styles.fill}>
                    <Text style={[font.body, { color: color.text }]}>{group.name}</Text>
                    {group.kind ? (
                      <Text style={[font.caption, { color: color.textFaint }]}>{group.kind}</Text>
                    ) : null}
                  </View>
                  <Pill
                    label={`${group.members} member${group.members === 1 ? '' : 's'}`}
                    tone={group.active ? 'accent' : 'idle'}
                  />
                </View>
              ))}
            </View>
          </Card>
        ) : (
          <EmptyState icon="profile" title="No groups" hint="Nobody has been grouped yet." />
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  tabs: { flexDirection: 'row', gap: space.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { gap: space.md, marginTop: space.md },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 44, height: 44, borderRadius: radius.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  gridItem: { width: 72, gap: space.xs },
  crop: { width: 72, height: 72, borderRadius: radius.md },
  more: {
    marginTop: space.lg,
    paddingVertical: space.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  },
});
