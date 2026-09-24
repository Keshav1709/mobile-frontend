import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { cloudApi } from '@/api/cloud';
import { Device } from '@/api/types';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ListGroup, ListRow } from '@/components/ListRow';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { haptic } from '@/lib/haptics';
import { errorMessage, goBack } from '@/lib/helpers';
import { useAgent } from '@/state/agent';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { useToast } from '@/state/toast';
import { font, space } from '@/theme';

const POLL_MS = 4000;
const CODE_LENGTH = 6;

/** What the person types, as the registry reads it: upper-case, no spaces or dashes. */
const cleanCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

/**
 * The ZeroForg Box in this workspace: bind one by the code on its screen, and
 * see whether it is online, on the factory network, and talking to the cloud.
 * Reached from Settings; not part of any first-run flow.
 */
export default function BoxScreen() {
  const { color } = useTheme();
  const { idToken } = useAuth();
  const { info: agentInfo } = useAgent();
  const toast = useToast();

  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);
  const [boundCode, setBoundCode] = useState<string | null>(null);

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

  const thisCodeBound = boundCode !== null && cleanCode(code) === boundCode;
  const codeComplete = cleanCode(code).length === CODE_LENGTH;

  const bind = async () => {
    if (!idToken) return;
    setBindError(null);
    setBinding(true);
    try {
      const typed = cleanCode(code);
      const device = await cloudApi.bindDevice(idToken, typed);
      setBoundCode(typed);
      haptic.success();
      toast.show(`${device.label || 'ZeroForg Box'} bound to your workspace`);
      await load();
    } catch (cause) {
      haptic.error();
      setBindError(errorMessage(cause, "We couldn't bind that box."));
    } finally {
      setBinding(false);
    }
  };

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
      eyebrow="Admin"
      title="ZeroForg Box"
      subtitle="Power on the box. It shows a 6-character code. Enter it here to bind the box to this workspace."
    >
      <View style={styles.claimRow}>
        <View style={styles.claimField}>
          <TextField
            label="Claim code"
            value={code}
            onChangeText={(value) => setCode(cleanCode(value))}
            placeholder="6 characters"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!binding}
            maxLength={CODE_LENGTH}
            style={styles.codeInput}
            hint={thisCodeBound ? 'Bound. Enter another code to add a second box.' : 'Shown on the box screen and in its journal'}
          />
        </View>
        <View style={styles.claimButton}>
          <Button
            label={thisCodeBound ? 'Bound' : 'Bind box'}
            variant={thisCodeBound ? 'secondary' : 'primary'}
            onPress={bind}
            disabled={thisCodeBound || !codeComplete}
            loading={binding}
          />
        </View>
      </View>

      {bindError ? <Banner tone="error" title="Couldn't bind" message={bindError} /> : null}
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
        <ListGroup title="No box yet">
          <ListRow
            icon="box"
            label="Nothing bound to this workspace"
            hint="Type the code from the box to bind it."
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
  claimRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  claimField: { flex: 1 },
  // Sits level with the field, below its eyebrow label.
  claimButton: { width: 118, paddingTop: 22 },
  codeInput: { ...font.mono, fontSize: 18, letterSpacing: 3 },
  skeletons: { gap: space.sm },
});
