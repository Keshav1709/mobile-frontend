import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { dashboardApi } from '@/api/dashboard';
import { Clip } from '@/api/types';
import { Banner } from '@/components/Banner';
import { EmptyState } from '@/components/EmptyState';
import { ListGroup, ListRow } from '@/components/ListRow';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/Skeleton';
import { errorMessage, goBack } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';

function duration(seconds: number | null): string | null {
  if (!seconds || seconds < 0) return null;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
}

function started(raw: string | null): string {
  if (!raw) return 'Unknown time';
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return 'Unknown time';
  return at.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Clips the dashboard has saved, newest first. */
export default function Recordings() {
  const { color } = useTheme();
  const { idToken } = useAuth();
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!idToken) return;
    setRefreshing(true);
    try {
      setClips(await dashboardApi.recordings(idToken));
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "We couldn't load recordings."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen
      onBack={() => goBack('/(tabs)')}
      eyebrow="Activity"
      title="Recordings"
      subtitle="Clips saved from your cameras."
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={color.accent} />
      }
    >
      {error ? (
        <Banner tone="error" title="Couldn't load" message={error} onRetry={() => void load()} />
      ) : null}

      {loading ? (
        <SkeletonCard lines={3} />
      ) : clips.length ? (
        <ListGroup title={`${clips.length} clip${clips.length === 1 ? '' : 's'}`}>
          {clips.map((clip) => (
            <ListRow
              key={clip.id}
              icon="play"
              label={clip.camera_name ?? clip.camera_id ?? 'Camera'}
              hint={[started(clip.started_at), clip.event_type, clip.description]
                .filter(Boolean)
                .join(' · ')}
              right={
                <Pill
                  label={duration(clip.duration_seconds) ?? (clip.status ?? 'saved')}
                  tone={clip.playable ? 'accent' : 'idle'}
                />
              }
            />
          ))}
        </ListGroup>
      ) : !error ? (
        <EmptyState
          icon="play"
          title="No recordings yet"
          hint="Nothing has been saved for this workspace. Clips appear here once your cameras start recording them."
        />
      ) : null}

      <View style={styles.note}>
        <Text style={[font.caption, { color: color.textFaint }]}>
          The clip index is read from your workspace; the video itself is stored and streamed by
          the ZeroForg dashboard, so playback happens there.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: space.xs, paddingTop: space.sm },
});
