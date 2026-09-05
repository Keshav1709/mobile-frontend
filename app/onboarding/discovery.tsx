import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { FoundCamera, localSubnet, scanForCameras } from '@/onvif/scan';
import { useOnboarding } from '@/state/onboarding';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

export default function Discovery() {
  const { color } = useTheme();
  const { select } = useOnboarding();
  const [subnet, setSubnet] = useState<string | null>(null);
  const [cameras, setCameras] = useState<FoundCamera[]>([]);
  const [progress, setProgress] = useState({ checked: 0, total: 254 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef({ cancelled: false });

  useEffect(() => {
    const signal = cancel.current;
    signal.cancelled = false;

    (async () => {
      const local = await localSubnet();
      if (!local) {
        setError('Connect this phone to Wi-Fi to scan for cameras.');
        setDone(true);
        return;
      }
      setSubnet(`${local.ip.split('.').slice(0, 3).join('.')}.0/24`);

      await scanForCameras((update) => {
        if (signal.cancelled) return;
        setCameras(update.found);
        setProgress({ checked: update.checked, total: update.total });
      }, signal);

      if (!signal.cancelled) setDone(true);
    })();

    return () => {
      signal.cancelled = true;
    };
  }, []);

  const choose = (camera: FoundCamera) => {
    cancel.current.cancelled = true;
    select(camera);
    router.push('/onboarding/credentials');
  };

  const percent = Math.round((progress.checked / Math.max(progress.total, 1)) * 100);

  return (
    <Screen
      onBack={() => {
        cancel.current.cancelled = true;
        router.replace('/onboarding');
      }}
      eyebrow="Discovery"
      title={done ? heading(cameras.length) : 'Scanning your network…'}
      subtitle={
        done
          ? cameras.length
            ? 'Choose one to connect.'
            : 'No ONVIF cameras answered on this network.'
          : `Checking ${subnet ?? 'your network'} · ${percent}%`
      }
      footer={
        <>
          {done ? (
            <Button
              label="Scan again"
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
      {error ? <Banner tone="error" title="Can't scan" message={error} /> : null}

      {!done ? (
        <View style={[styles.progress, { backgroundColor: color.surface, borderColor: color.border }]}>
          <View style={[styles.track, { backgroundColor: color.surfaceRaised }]}>
            <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color.accent }]} />
          </View>
          <Text style={[font.caption, { color: color.textMuted }]}>
            {progress.checked} of {progress.total} addresses checked
          </Text>
        </View>
      ) : null}

      {cameras.map((camera) => (
        <Card key={camera.id} glow onPress={() => choose(camera)}>
          <View style={styles.cardTop}>
            <Text style={[font.heading, { color: color.text }]}>{camera.ip}</Text>
            <Text style={[font.label, styles.connect, { color: color.accent }]}>Connect ↗</Text>
          </View>
          <View style={styles.tags}>
            <Pill label="ONVIF" tone="accent" dot />
            <Pill label={`Port ${camera.port}`} tone="neutral" />
          </View>
        </Card>
      ))}

      {done && cameras.length === 0 && !error ? (
        <Banner
          tone="info"
          title="Nothing found"
          message="Check the camera is powered on, joined to this same Wi-Fi, and has ONVIF enabled in its settings."
        />
      ) : null}
    </Screen>
  );
}

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
    gap: space.sm,
  },
  connect: { fontSize: 13 },
  tags: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});
