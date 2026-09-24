import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { dashboardApi } from '@/api/dashboard';
import { MiraCapabilities, MiraSession, MiraSessionDetail } from '@/api/types';
import { Banner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { ListGroup, ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { SkeletonCard } from '@/components/Skeleton';
import { errorMessage, goBack } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

function when(raw: string | null): string {
  if (!raw) return '';
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Mira's conversations.
 *
 * The registry reads the dashboard's chat history but holds no language model,
 * so past answers are here and new questions are asked on the dashboard. The
 * screen says which rather than offering a composer that could not send.
 */
export default function Mira() {
  const { color } = useTheme();
  const { idToken } = useAuth();
  const [sessions, setSessions] = useState<MiraSession[]>([]);
  const [open, setOpen] = useState<MiraSessionDetail | null>(null);
  const [capabilities, setCapabilities] = useState<MiraCapabilities | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!idToken) return;
    setRefreshing(true);
    try {
      const [list, caps] = await Promise.all([
        dashboardApi.miraSessions(idToken),
        dashboardApi.miraCapabilities(idToken).catch(() => null),
      ]);
      setSessions(list);
      setCapabilities(caps);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "We couldn't load Mira."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  const openSession = useCallback(
    async (id: string) => {
      if (!idToken) return;
      try {
        setOpen(await dashboardApi.miraSession(idToken, id));
      } catch (cause) {
        setError(errorMessage(cause, "We couldn't open that conversation."));
      }
    },
    [idToken],
  );

  if (open) {
    return (
      <Screen
        onBack={() => setOpen(null)}
        eyebrow="Mira"
        title={open.title}
        subtitle={when(open.updated_at)}
      >
        {open.messages_list.map((message) => (
          <View
            key={message.id}
            style={[
              styles.bubble,
              message.role === 'user'
                ? { alignSelf: 'flex-end', backgroundColor: color.accentSoft }
                : { alignSelf: 'flex-start', backgroundColor: color.surfaceRaised },
            ]}
          >
            <Text
              style={[
                font.body,
                { color: message.role === 'user' ? color.accent : color.text },
              ]}
            >
              {message.content ?? ''}
            </Text>
          </View>
        ))}
      </Screen>
    );
  }

  return (
    <Screen
      onBack={() => goBack('/(tabs)')}
      eyebrow="Intelligence"
      title="Mira"
      subtitle="What your cameras have been asked about."
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={color.accent} />
      }
    >
      {error ? <Banner tone="error" title="Couldn't load" message={error} /> : null}

      {capabilities && !capabilities.can_ask ? (
        <Card>
          <View style={styles.askRow}>
            <Icon name="info" size={18} color={color.textFaint} />
            <Text style={[font.caption, styles.askText, { color: color.textMuted }]}>
              {capabilities.reason}
            </Text>
          </View>
        </Card>
      ) : null}

      {loading ? (
        <SkeletonCard lines={3} />
      ) : sessions.length ? (
        <ListGroup title={`${sessions.length} conversation${sessions.length === 1 ? '' : 's'}`}>
          {sessions.map((session) => (
            <ListRow
              key={session.id}
              icon="ai"
              label={session.title}
              hint={`${session.messages} message${session.messages === 1 ? '' : 's'}${
                session.updated_at ? ` · ${when(session.updated_at)}` : ''
              }`}
              onPress={() => openSession(session.id)}
            />
          ))}
        </ListGroup>
      ) : !error ? (
        <EmptyState
          icon="ai"
          title="Nothing asked yet"
          hint="Conversations with Mira show up here once someone in your workspace starts one."
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '90%', borderRadius: radius.lg, padding: space.lg },
  askRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  askText: { flex: 1 },
});
