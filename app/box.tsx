import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { cloudApi } from '@/api/cloud';
import { Device } from '@/api/types';
import { Banner } from '@/components/Banner';
import { ListGroup, ListRow } from '@/components/ListRow';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { errorMessage, goBack } from '@/lib/helpers';
import { useAgent } from '@/state/agent';
import { useAuth } from '@/state/auth';
import { space } from '@/theme';

const POLL_MS = 4000;

/**
 * The ZeroForg Box in this workspace: whether it is online, on the factory
 * network, and talking to the cloud.
 *
 * Read-only on purpose. A box is claimed during onboarding on the dashboard,
 * by whoever installs it, and an account that reaches this screen already has
 * one. Offering to bind another here put a second box on the workspace of
 * anyone who mistyped, and the phone is the wrong place to notice that. Adding
 * cameras to the box it already has stays in the app (Settings, Add a camera).
 */
export default function BoxScreen() {
  const { idToken } = useAuth();
  const { info: agentInfo } = useAgent();

  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!idToken) return;
    try {
      setDevices(await cloudApi.listDevices(idToken));
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "We couldn't reach ZeroForg Cloud."));
    }
  }, [idToken]);

  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    return () => clearInterval(poll);
  }, [load]);

  const primary = useMemo(() => {
    const list = devices ?? [];
    return list.find((device) => device.checks.online) ?? list[0] ?? null;
  }, [devices]);

  const checks = primary
    ? [
        { label: 'Box online', ready: primary.checks.online },
        { label: 'On your factory network', ready: primary.checks.factory_network },
        { label: 'Connected to ZeroForg Cloud', ready: primary.checks.cloud },
      ]
    : [];
  const allReady = checks.length > 0 && checks.every((check) => check.ready);

  return (
    <Screen
      onBack={() => goBack('/settings')}
      eyebrow="Facility"
      title="ZeroForg Box"
      subtitle="The box that watches your cameras and sends what it sees to ZeroForg."
    >
      {error ? (
        <Banner
          tone="error"
          title="Couldn't check the box"
          message={error}
          onRetry={() => void load()}
        />
      ) : null}
      {allReady ? <Banner tone="success" title="ZeroForg Box connected" /> : null}

      {devices === null && !error ? (
        <View style={styles.skeletons}>
          <Skeleton height={52} />
          <Skeleton height={52} />
          <Skeleton height={52} />
        </View>
      ) : primary ? (
        <ListGroup title={primary.label || primary.device_id}>
          {checks.map((check) => (
            <ListRow
              key={check.label}
              label={check.label}
              right={
                <Pill
                  label={check.ready ? 'Ready' : 'Waiting'}
                  tone={check.ready ? 'live' : 'accent'}
                  icon={check.ready ? 'checkCircle' : undefined}
                  dot={!check.ready}
                />
              }
            />
          ))}
        </ListGroup>
      ) : (
        <ListGroup title="No box on this workspace">
          <ListRow
            icon="box"
            label="Nothing to show yet"
            hint="A box is set up on the ZeroForg dashboard when it is installed. Ask your administrator if you expected one here."
          />
        </ListGroup>
      )}

      {primary ? (
        <ListGroup title="Details">
          <ListRow label="Device" value={primary.device_id} />
          <ListRow label="Local address" value={primary.local_ip} />
          <ListRow label="Last seen" value={primary.last_seen ? ago(primary.last_seen) : null} />
          <ListRow label="Status" value={primary.status} />
          <ListRow label="Agent version" value={primary.agent_version} />
          <ListRow label="Boxes in workspace" value={devices ? String(devices.length) : null} />
          <ListRow label="Box on this Wi-Fi" value={agentInfo?.host ?? 'None found'} />
        </ListGroup>
      ) : null}
    </Screen>
  );
}

function ago(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

const styles = StyleSheet.create({
  skeletons: { gap: space.sm },
});
