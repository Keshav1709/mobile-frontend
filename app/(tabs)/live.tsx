import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { cloudApi } from '@/api/cloud';
import { Camera } from '@/api/types';
import { Banner } from '@/components/Banner';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { ListGroup, ListRow } from '@/components/ListRow';
import { LiveStream } from '@/components/LiveStream';
import { Skeleton } from '@/components/Skeleton';
import { Pill } from '@/components/Pill';
import { PtzPad } from '@/components/PtzPad';
import { Screen } from '@/components/Screen';
import type { Direction } from '@/onvif/ptz';
import type { Credentials } from '@/onvif/soap';
import { move, stop } from '@/onvif/ptz';
import { livePlayerUrl, relayConfigured, streamNames, unpublishStream } from '@/onvif/relay';
import { haptic } from '@/lib/haptics';
import { errorMessage } from '@/lib/helpers';
import { useAgent } from '@/state/agent';
import { useAuth } from '@/state/auth';
import { forgetCredentials, loadCredentials } from '@/state/cameraCredentials';
import { useTheme } from '@/state/theme';
import { useToast } from '@/state/toast';
import { font, radius, space } from '@/theme';

export default function Live() {
  const { user, idToken, readOnly } = useAuth();
  const { api: agent, info: agentInfo } = useAgent();
  const { color } = useTheme();
  const toast = useToast();

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [index, setIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [hd, setHd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [panning, setPanning] = useState<Direction | null>(null);
  const [removing, setRemoving] = useState(false);
  const ptzSupported = useRef(true);
  const credentials = useRef<{ id: string; value: Credentials | null } | null>(null);

  const load = useCallback(async () => {
    if (!user || !idToken) return;
    try {
      const list = await cloudApi.listCameras(idToken);
      setCameras(list);
      setIndex((current) => Math.min(current, Math.max(list.length - 1, 0)));
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't load cameras."));
    } finally {
      setLoading(false);
    }
  }, [user, idToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const camera = cameras[index];
  // On the site's own network with the box relaying this camera, the phone can play
  // the relay's WebRTC stream directly; everywhere else the picture comes through the
  // dashboard (see LiveStream), exactly as the web console shows it.
  const lan = relayConfigured && !!camera?.stream_reference;

  /** Reads the keychain once per camera rather than on every press. */
  const credentialsFor = async (id: string) => {
    if (credentials.current?.id !== id) {
      credentials.current = { id, value: await loadCredentials(id) };
    }
    return credentials.current.value;
  };

  const startPan = async (direction: Direction) => {
    if (!camera || !ptzSupported.current) return;
    haptic.select();
    setPanning(direction);

    if (agent) {
      agent.pan(camera.camera_id, direction).catch(() => {
        ptzSupported.current = false;
        setPanning(null);
      });
      return;
    }

    if (!camera.onvif_xaddr) return;
    const secrets = await credentialsFor(camera.camera_id);
    if (!secrets) {
      ptzSupported.current = false;
      setPanning(null);
      setError('Camera credentials are missing. Remove the camera and add it again.');
      return;
    }
    move(camera.onvif_xaddr, camera.selected_profile ?? '', direction, secrets).catch(() => {
      ptzSupported.current = false;
      setPanning(null);
    });
  };

  const endPan = async () => {
    setPanning(null);
    if (!camera) return;

    if (agent) {
      agent.pan(camera.camera_id, null).catch(() => undefined);
      return;
    }

    if (!camera.onvif_xaddr) return;
    const secrets = await credentialsFor(camera.camera_id);
    if (secrets) {
      stop(camera.onvif_xaddr, camera.selected_profile ?? '', secrets).catch(() => undefined);
    }
  };

  const confirmDisconnect = () => {
    if (!camera) return;
    haptic.warning();
    Alert.alert(
      'Disconnect this camera?',
      `${camera.display_name} will be removed from your account and its live view will stop. You can add it again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: disconnect },
      ],
    );
  };

  const disconnect = async () => {
    if (!camera) return;
    setRemoving(true);

    if (agent) {
      await agent.remove(camera.camera_id).catch(() => undefined);
    } else {
      const names = streamNames(camera.camera_id);
      await Promise.all([unpublishStream(names.preview), unpublishStream(names.high)]);
      await forgetCredentials(camera.camera_id);
    }

    await cloudApi.deleteCamera(camera.camera_id).catch(() => undefined);
    setRemoving(false);
    setShowInfo(false);
    toast.show(`${camera.display_name} disconnected`, 'info');
    load();
  };

  if (loading) {
    return (
      <Screen tabBar eyebrow="Live" title="Cameras">
        <Skeleton height={0} style={styles.playerSkeleton} />
        <View style={styles.controls}>
          <Skeleton width={72} height={28} style={styles.pillSkeleton} />
          <Skeleton width={150} height={36} style={styles.pillSkeleton} />
        </View>
      </Screen>
    );
  }

  if (!camera) {
    return (
      <Screen tabBar eyebrow="Live" title="Cameras">
        {error ? (
          <EmptyState
            tone="error"
            icon="offline"
            title="Couldn't load cameras"
            hint={error}
            action={<Button label="Try again" variant="secondary" onPress={load} />}
          />
        ) : (
          <EmptyState
            icon="camera"
            title="No cameras yet"
            hint="Connect a camera on your Wi-Fi to see it here."
            action={<Button label="Add a camera" onPress={() => router.push('/onboarding')} />}
          />
        )}
      </Screen>
    );
  }

  const streams = streamNames(camera.camera_id);

  const areaCount = camera.zones_json?.length ?? 0;
  const lastSeen = camera.last_seen?.slice(0, 19).replace('T', ' ');

  return (
    <Screen
      tabBar
      eyebrow="Live"
      title={camera.display_name}
      subtitle={camera.ip ?? undefined}
      scroll
      action={
        <IconButton
          icon="settings"
          label="Camera settings"
          active={showInfo}
          expanded={showInfo}
          onPress={() => setShowInfo((open) => !open)}
        />
      }
    >
      {error ? <Banner tone="error" title="Something went wrong" message={error} /> : null}

      {lan ? (
        <View style={[styles.player, { borderColor: color.border }]}>
          <WebView
            key={`${camera.camera_id}-${hd ? 'hd' : 'preview'}`}
            source={{
              uri: livePlayerUrl(hd ? streams.high : streams.preview),
            }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            style={styles.webview}
          />
        </View>
      ) : (
        <LiveStream key={camera.camera_id} cameraId={camera.camera_id} />
      )}

      <View style={styles.controls}>
        <Pill
          label={lan ? 'On site' : camera.connection_status === 'CONNECTED' ? 'Via cloud' : 'Camera offline'}
          tone={camera.connection_status === 'CONNECTED' ? 'live' : 'idle'}
          dot
        />
        {lan ? (
        <View style={[styles.quality, { backgroundColor: color.surface, borderColor: color.border }]}>
          {(
            [
              { label: 'Smooth', high: false },
              { label: 'HD', high: true },
            ] as const
          ).map(({ label, high }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityState={{ selected: high === hd }}
              onPress={() => setHd(high)}
              style={[
                styles.qualityTab,
                high === hd && { backgroundColor: color.accentSoft },
              ]}
            >
              <Text
                style={[
                  font.label,
                  styles.qualityText,
                  { color: high === hd ? color.accent : color.textMuted },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        ) : null}
      </View>

      <PtzPad
        onStart={startPan}
        onStop={endPan}
        busy={panning}
        disabled={!ptzSupported.current}
      />

      <BottomSheet
        visible={showInfo}
        onClose={() => setShowInfo(false)}
        title={camera.display_name}
        subtitle={[camera.manufacturer, camera.model].filter(Boolean).join(' ') || camera.ip || undefined}
        footer={
          // Disconnecting deletes the camera from the workspace, which is the
          // dashboard's to do.
          readOnly ? null : (
            <Button
              label="Disconnect this camera"
              variant="danger"
              onPress={confirmDisconnect}
              loading={removing}
            />
          )
        }
      >
        <ListGroup>
          <ListRow
            icon="areas"
            label="Areas"
            hint={areaCount ? `${areaCount} outlined on this camera` : 'Outline entrances, docks, restricted areas'}
            onPress={() => {
              setShowInfo(false);
              router.push(`/zones/${camera.camera_id}`);
            }}
          />
          <ListRow
            icon="cameras"
            label="Add another camera"
            onPress={() => {
              setShowInfo(false);
              router.push('/onboarding');
            }}
          />
        </ListGroup>
        <ListGroup title="Stream">
          <ListRow icon="live" label="Status" value={camera.connection_status === 'CONNECTED' ? 'Online' : 'Offline'} />
          <ListRow label="Resolution" value={camera.resolution} />
          <ListRow label="Profile" value={camera.selected_profile} />
          <ListRow label="Relay" value={lan ? 'Publishing on site' : 'Through the dashboard'} />
        </ListGroup>
        <ListGroup title="Device">
          <ListRow label="Manufacturer" value={camera.manufacturer} />
          <ListRow label="Model" value={camera.model} />
          <ListRow label="Firmware" value={camera.firmware} />
          <ListRow label="Serial" value={camera.serial_number} />
        </ListGroup>
        <ListGroup title="Network">
          <ListRow icon="wifi" label="IP address" value={camera.ip} />
          <ListRow label="ONVIF service" value={camera.onvif_xaddr} />
          <ListRow label="Last seen" value={lastSeen} />
        </ListGroup>
        <ListGroup title="Setup">
          <ListRow icon="box" label="Managed by" value={agent ? 'ZeroForg Box' : 'This phone'} />
          <ListRow label="Box address" value={agentInfo?.agent_url ?? 'None on this network'} />
          <ListRow icon="key" label="Passwords" value={agent ? 'Held by the box' : 'In this phone'} />
        </ListGroup>
      </BottomSheet>

      {cameras.length > 1 ? (
        <View style={styles.switcher}>
          {cameras.map((item, position) => (
            <Pressable
              key={item.camera_id}
              accessibilityRole="button"
              accessibilityLabel={item.display_name}
              onPress={() => setIndex(position)}
              style={[
                styles.switchDot,
                {
                  backgroundColor: position === index ? color.accent : color.borderStrong,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  playerSkeleton: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.xl },
  pillSkeleton: { borderRadius: radius.pill },
  // 16:9 across the full content width, so the picture gets the horizontal space.
  player: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webview: { backgroundColor: '#000' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quality: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, borderWidth: 1 },
  qualityTab: { paddingHorizontal: space.lg, paddingVertical: 7, borderRadius: radius.pill },
  qualityText: { fontSize: 13 },
  switcher: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, paddingTop: space.sm },
  switchDot: { width: 8, height: 8, borderRadius: radius.pill },
});
