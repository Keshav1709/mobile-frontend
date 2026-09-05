import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { cloudApi } from '@/api/cloud';
import { Camera } from '@/api/types';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { GlassCarousel, GlassSlide } from '@/components/GlassCarousel';
import { IconButton } from '@/components/IconButton';
import { Pill } from '@/components/Pill';
import { PtzPad } from '@/components/PtzPad';
import { Screen } from '@/components/Screen';
import type { Direction } from '@/onvif/ptz';
import type { Credentials } from '@/onvif/soap';
import { move, stop } from '@/onvif/ptz';
import { livePlayerUrl, relayConfigured, streamNames, unpublishStream } from '@/onvif/relay';
import { errorMessage } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { forgetCredentials, loadCredentials } from '@/state/cameraCredentials';
import { ThemeMode, useTheme } from '@/state/theme';
import { font, hue, radius, space } from '@/theme';

const APPEARANCE: { label: string; mode: ThemeMode }[] = [
  { label: 'Light', mode: 'light' },
  { label: 'Dark', mode: 'dark' },
  { label: 'Automatic', mode: 'auto' },
];

export default function Live() {
  const { user } = useAuth();
  const { color, mode, setMode } = useTheme();

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [index, setIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [hd, setHd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [panning, setPanning] = useState<Direction | null>(null);
  const ptzSupported = useRef(true);
  const credentials = useRef<{ id: string; value: Credentials | null } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const list = await cloudApi.listCameras(user.tenant_id);
      setCameras(list);
      setIndex((current) => Math.min(current, Math.max(list.length - 1, 0)));
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't load cameras."));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const camera = cameras[index];
  const live = relayConfigured && !!camera?.stream_reference;

  /** Reads the keychain once per camera rather than on every press. */
  const credentialsFor = async (id: string) => {
    if (credentials.current?.id !== id) {
      credentials.current = { id, value: await loadCredentials(id) };
    }
    return credentials.current.value;
  };

  const startPan = async (direction: Direction) => {
    if (!camera?.onvif_xaddr || !ptzSupported.current) return;
    const secrets = await credentialsFor(camera.camera_id);
    if (!secrets) {
      ptzSupported.current = false;
      setError('Camera credentials are missing. Remove the camera and add it again.');
      return;
    }
    setPanning(direction);
    move(camera.onvif_xaddr, camera.selected_profile ?? '', direction, secrets).catch(() => {
      ptzSupported.current = false;
      setPanning(null);
    });
  };

  const endPan = async () => {
    setPanning(null);
    if (!camera?.onvif_xaddr) return;
    const secrets = await credentialsFor(camera.camera_id);
    if (secrets) {
      stop(camera.onvif_xaddr, camera.selected_profile ?? '', secrets).catch(() => undefined);
    }
  };

  const disconnect = async () => {
    if (!camera) return;
    const names = streamNames(camera.camera_id);
    await Promise.all([unpublishStream(names.preview), unpublishStream(names.high)]);

    await forgetCredentials(camera.camera_id);
    await cloudApi.deleteCamera(camera.camera_id).catch(() => undefined);
    setShowInfo(false);
    load();
  };

  if (loading) {
    return (
      <Screen glow={false}>
        <View style={styles.centre}>
          <ActivityIndicator color={color.accent} />
        </View>
      </Screen>
    );
  }

  if (!camera) {
    return (
      <Screen
        eyebrow="Live"
        title="No cameras yet"
        subtitle="Connect a camera on your Wi-Fi to see it here."
        footer={<Button label="Add a camera" onPress={() => router.push('/onboarding')} />}
      >
        {error ? <Banner tone="error" title="Couldn't load cameras" message={error} /> : null}
      </Screen>
    );
  }

  const streams = streamNames(camera.camera_id);

  const infoSlides: GlassSlide[] = [
    {
      key: 'device',
      title: 'Device',
      tint: hue.blue,
      rows: [
        { label: 'Manufacturer', value: camera.manufacturer },
        { label: 'Model', value: camera.model },
        { label: 'Firmware', value: camera.firmware },
        { label: 'Serial', value: camera.serial_number },
      ],
    },
    {
      key: 'stream',
      title: 'Stream',
      tint: hue.lime,
      rows: [
        { label: 'Resolution', value: camera.resolution },
        { label: 'Profile', value: camera.selected_profile },
        { label: 'Relay', value: camera.stream_reference ? 'Publishing' : 'Not published' },
        { label: 'Status', value: camera.connection_status },
      ],
    },
    {
      key: 'network',
      title: 'Network',
      tint: hue.violet,
      rows: [
        { label: 'IP address', value: camera.ip },
        { label: 'ONVIF service', value: camera.onvif_xaddr },
        { label: 'Last seen', value: camera.last_seen?.slice(0, 19).replace('T', ' ') },
      ],
      footer: <Button label="Disconnect camera" variant="danger" onPress={disconnect} />,
    },
  ];

  return (
    <Screen
      eyebrow="Live"
      title={camera.display_name}
      subtitle={camera.ip ?? undefined}
      scroll
      action={
        <IconButton
          glyph="⚙"
          label="Camera settings"
          active={showInfo}
          expanded={showInfo}
          onPress={() => setShowInfo((open) => !open)}
        />
      }
    >
      {error ? <Banner tone="error" title="Something went wrong" message={error} /> : null}

      {live ? (
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
        <Banner
          tone="info"
          title="Live view unavailable"
          message={
            relayConfigured
              ? "This camera's stream isn't published. Remove it and add it again."
              : 'No relay is configured, so RTSP cannot be converted for playback.'
          }
        />
      )}

      <View style={styles.controls}>
        <Pill label={live ? 'Live' : 'Offline'} tone={live ? 'live' : 'idle'} dot />
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
      </View>

      {showInfo ? (
        <>
          <View style={styles.info}>
            <GlassCarousel slides={infoSlides} />
          </View>
          <ChipGroup
            label="Appearance"
            options={APPEARANCE.map((option) => option.label)}
            value={APPEARANCE.find((option) => option.mode === mode)?.label ?? 'Dark'}
            onChange={(label) => {
              const chosen = APPEARANCE.find((option) => option.label === label);
              if (chosen) setMode(chosen.mode);
            }}
          />
        </>
      ) : (
        <PtzPad
          onStart={startPan}
          onStop={endPan}
          busy={panning}
          disabled={!ptzSupported.current}
        />
      )}

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
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  info: { marginHorizontal: -space.xl },
  switcher: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, paddingTop: space.sm },
  switchDot: { width: 8, height: 8, borderRadius: radius.pill },
});
