import { router } from 'expo-router';
import { useState } from 'react';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { isOnvifDevice, ONVIF_PORTS, serviceUrl } from '@/onvif/device';
import { useOnboarding } from '@/state/onboarding';

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

export default function Manual() {
  const { select } = useOnboarding();
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const address = ip.trim();
    // Cameras rarely tell you which port ONVIF is on, so try the usual ones.
    const candidates = port.trim() ? [Number(port)] : ONVIF_PORTS;

    setError(null);
    setBusy(true);
    try {
      for (const candidate of candidates) {
        if (await isOnvifDevice(address, candidate, 6000)) {
          select({
            ip: address,
            port: candidate,
            serviceUrl: serviceUrl(address, candidate),
            label: address,
          });
          router.push('/onboarding/credentials');
          return;
        }
      }
      setError(
        `No ONVIF camera answered at ${address} on ${candidates.join(', ')}. ` +
          'Check the phone is on the same Wi-Fi as the camera.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      onBack={() => router.back()}
      eyebrow="Manual entry"
      title="Add manually"
      subtitle="Enter the camera's IP address, shown in its own app under ONVIF settings."
      footer={
        <>
          <Button
            label="Continue"
            onPress={submit}
            disabled={!IPV4.test(ip.trim())}
            loading={busy}
          />
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      {error ? <Banner tone="error" title="Couldn't reach it" message={error} /> : null}
      <TextField
        label="IP address"
        required
        value={ip}
        onChangeText={setIp}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
      <TextField
        label="ONVIF port"
        value={port}
        onChangeText={(value) => setPort(value.replace(/\D/g, ''))}
        keyboardType="number-pad"
        hint={`Leave blank to try ${ONVIF_PORTS.join(', ')}.`}
      />
    </Screen>
  );
}
