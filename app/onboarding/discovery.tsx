import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AgentDevice } from '@/agent/client';
import { cloudApi } from '@/api/cloud';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { errorMessage, finishFlow, goBack } from '@/lib/helpers';
import { serviceUrl } from '@/onvif/device';
import { FoundCamera, localSubnet, scanForCameras } from '@/onvif/scan';
import { useAgent } from '@/state/agent';
import { useAuth } from '@/state/auth';
import { useOnboarding } from '@/state/onboarding';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

const POLL_MS = 800;

/** A result from either search path, in one shape the list can render. */
type Result = FoundCamera & {
  label: string;
  detail: string | null;
  onvif: boolean;
  temporaryId?: string;
};

export default function Discovery() {
  const { color } = useTheme();
  const { api: agent } = useAgent();
  const { select } = useOnboarding();
  const { user, idToken } = useAuth();
  const [connectedIps, setConnectedIps] = useState<string[]>([]);

  const [results, setResults] = useState<Result[]>([]);
  const [progress, setProgress] = useState({ checked: 0, total: 254 });
  const [subnet, setSubnet] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef({ cancelled: false });
  const fill = useRef(new Animated.Value(0)).current;

  // Cameras already in the registry are shown as connected, not offered again.
  useEffect(() => {
    if (!user || !idToken) return;
    cloudApi
      .listCameras(idToken)
      .then((cameras) => setConnectedIps(cameras.map((c) => c.ip).filter((ip): ip is string => !!ip)))
      .catch(() => setConnectedIps([]));
  }, [user, idToken]);

  useEffect(() => {
    const signal = cancel.current;
    signal.cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    /** The agent finds cameras by multicast, so it is faster and sees NVRs. */
    const viaAgent = async () => {
      const { scan_id } = await agent!.startScan();

      const poll = async () => {
        if (signal.cancelled) return;
        const scan = await agent!.scan(scan_id);
        setResults(scan.devices.filter((d) => d.onvif || d.rtsp_detected).map(fromAgent));
        const steps = Object.values(scan.progress).filter(Boolean).length;
        setProgress({ checked: steps, total: 3 });

        if (scan.status === 'completed' || scan.status === 'failed') {
          if (scan.error) setError(scan.error.message);
          setDone(true);
          return;
        }
        timer = setTimeout(poll, POLL_MS);
      };

      await poll();
    };

    const viaPhone = async () => {
      const local = await localSubnet();
      if (!local) {
        setError('Connect this phone to Wi-Fi to scan for cameras.');
        setDone(true);
        return;
      }
      setSubnet(`${local.ip.split('.').slice(0, 3).join('.')}.0/24`);

      await scanForCameras((update) => {
        if (signal.cancelled) return;
        setResults(update.found.map(fromPhone));
        setProgress({ checked: update.checked, total: update.total });
      }, signal);

      if (!signal.cancelled) setDone(true);
    };

    (agent ? viaAgent() : viaPhone()).catch((cause) => {
      if (signal.cancelled) return;
      setError(errorMessage(cause, "The search couldn't be completed."));
      setDone(true);
    });

    return () => {
      signal.cancelled = true;
      clearTimeout(timer);
    };
  }, [agent]);

  const choose = (result: Result) => {
    if (connectedIps.includes(result.ip)) {
      finishFlow('/(tabs)/live');
      return;
    }
    cancel.current.cancelled = true;
    select({
      ip: result.ip,
      port: result.port,
      serviceUrl: result.serviceUrl,
      label: result.label,
      temporaryId: result.temporaryId,
    });
    router.push('/onboarding/credentials');
  };

  const percent = Math.round((progress.checked / Math.max(progress.total, 1)) * 100);

  useEffect(() => {
    Animated.timing(fill, {
      toValue: percent,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent, fill]);

  return (
    <Screen
      onBack={() => {
        cancel.current.cancelled = true;
        goBack('/onboarding');
      }}
      eyebrow={agent ? 'Discovery · local agent' : 'Discovery'}
      title={done ? heading(results.length) : 'Searching for cameras…'}
      subtitle={
        done
          ? results.length
            ? 'Choose one to connect.'
            : 'No cameras answered on this network.'
          : agent
            ? 'The agent is listening for cameras that announce themselves.'
            : `Checking ${subnet ?? 'your network'} · ${percent}%`
      }
      footer={
        <>
          {done ? (
            <Button
              label="Search again"
              variant="secondary"
              onPress={() => router.replace('/onboarding/discovery')}
            />
          ) : null}
          <Button
            label="Add manually instead"
            variant="ghost"
            onPress={() => {
              cancel.current.cancelled = true;
              router.replace('/onboarding/manual');
            }}
          />
        </>
      }
    >
      {error ? <Banner tone="error" title="Search failed" message={error} /> : null}

      {!done ? (
        <View style={[styles.progress, { backgroundColor: color.surface, borderColor: color.border }]}>
          <View style={[styles.track, { backgroundColor: color.surfaceRaised }]}>
            <Animated.View
              style={[
                styles.fill,
                {
                  backgroundColor: color.accent,
                  width: fill.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={[font.caption, { color: color.textMuted }]}>
            {agent
              ? `${progress.checked} of ${progress.total} steps complete`
              : `${progress.checked} of ${progress.total} addresses checked`}
          </Text>
        </View>
      ) : null}

      {results.map((result) => {
        const already = connectedIps.includes(result.ip);
        return (
          <Card key={result.id} glow={result.onvif} onPress={() => choose(result)}>
            <View style={styles.cardTop}>
              <Text
                numberOfLines={1}
                style={[font.heading, styles.cardTitle, { color: color.text }]}
              >
                {result.label}
              </Text>
              <Text style={[font.label, styles.connect, { color: color.accent }]}>
                {already ? 'View ↗' : 'Connect ↗'}
              </Text>
            </View>
            {result.detail ? (
              <Text style={[font.caption, { color: color.textMuted }]}>{result.detail}</Text>
            ) : null}
            <View style={styles.tags}>
              {already ? <Pill label="Connected" tone="live" dot /> : null}
              <Pill
                label={result.onvif ? 'ONVIF' : 'RTSP only'}
                tone={result.onvif ? 'accent' : 'idle'}
              />
              <Pill label={`Port ${result.port}`} tone="neutral" />
            </View>
          </Card>
        );
      })}

      {done && results.length === 0 && !error ? (
        <Banner
          tone="info"
          title="Nothing found"
          message="Check the camera is powered on, joined to this same Wi-Fi, and has ONVIF enabled in its settings."
        />
      ) : null}
    </Screen>
  );
}

const fromAgent = (device: AgentDevice): Result => ({
  id: device.temporary_id,
  temporaryId: device.temporary_id,
  ip: device.ip,
  port: 80,
  serviceUrl: serviceUrl(device.ip, 80),
  label: device.manufacturer ?? device.ip,
  detail: [device.model, device.ip, device.mac].filter(Boolean).join(' · ') || null,
  onvif: device.onvif,
});

const fromPhone = (camera: FoundCamera): Result => ({
  ...camera,
  label: camera.ip,
  detail: null,
  onvif: true,
});

function heading(count: number): string {
  if (count === 0) return 'No cameras found';
  return count === 1 ? '1 camera found' : `${count} cameras found`;
}

const styles = StyleSheet.create({
  progress: { gap: space.md, padding: space.lg, borderRadius: radius.xl, borderWidth: 1 },
  track: { height: 4, borderRadius: radius.pill },
  fill: { height: 4, borderRadius: radius.pill },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  cardTitle: { flex: 1 },
  connect: { fontSize: 13 },
  tags: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});
