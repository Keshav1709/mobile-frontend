import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { cloudApi } from '@/api/cloud';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Stage, StageList, StageState } from '@/components/StageList';
import { connectCamera, CONNECT_ERRORS, ConnectStage } from '@/onvif/connect';
import { publishStream, streamNames, withRtspCredentials } from '@/onvif/relay';
import { saveCredentials } from '@/state/cameraCredentials';
import { OnvifError } from '@/onvif/soap';
import { useAuth } from '@/state/auth';
import { useOnboarding } from '@/state/onboarding';

const LABELS: Record<ConnectStage, string> = {
  found: 'Camera found',
  authenticating: 'Authenticating',
  profile: 'Getting camera profile',
  stream: 'Resolving video stream',
};

const ORDER: ConnectStage[] = ['found', 'authenticating', 'profile', 'stream'];

export default function Connecting() {
  const { camera, takeCredentials, clear } = useOnboarding();
  const { user } = useAuth();
  const [reached, setReached] = useState<ConnectStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !camera || !user) return;
    started.current = true;
    let live = true;

    (async () => {
      try {
        const credentials = takeCredentials();
        const result = await connectCamera(camera, credentials, (stage) => {
          if (live) setReached(stage);
        });

        const cameraId = `cam_${camera.ip.replace(/\./g, '_')}_${camera.port}`;

        // The relay gets the authenticated RTSP URLs; the cloud never does.
        const authed = (uri: string) =>
          withRtspCredentials(uri, credentials.username, credentials.password);
        const names = streamNames(cameraId);
        const [streaming] = await Promise.all([
          publishStream(names.preview, authed(result.previewUri)),
          publishStream(names.high, authed(result.streamUri)),
        ]);
        await cloudApi.registerCamera({
          camera_id: cameraId,
          tenant_id: user.tenant_id,
          user_id: user.user_id,
          display_name:
            [result.device.manufacturer, result.device.model].filter(Boolean).join(' ') ||
            `Camera ${camera.ip}`,
          manufacturer: result.device.manufacturer,
          model: result.device.model,
          firmware: result.device.firmware,
          serial_number: result.device.serialNumber,
          ip: camera.ip,
          onvif_xaddr: camera.serviceUrl,
          // The token, not the name: PTZ and stream calls address profiles by token.
          selected_profile: result.profile.token,
          resolution: result.profile.resolution,
          connection_status: 'CONNECTED',
          stream_reference: streaming ? cameraId : null,
        });

        // Pan/tilt and reconnect authenticate on every call, so the credentials
        // have to outlive this flow. They stay in the device keychain.
        await saveCredentials(cameraId, credentials);

        clear();
        if (live) router.replace({ pathname: '/onboarding/success', params: { id: cameraId } });
      } catch (cause) {
        if (!live) return;
        setError(
          cause instanceof OnvifError
            ? CONNECT_ERRORS[cause.code]
            : 'Something went wrong while connecting the camera.',
        );
      }
    })();

    return () => {
      live = false;
    };
    // Runs once: the credentials are consumed on the first attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, user]);

  if (error) {
    return (
      <Screen
        onBack={() => router.replace('/onboarding')}
        eyebrow="Connecting"
        title="We couldn't connect"
        footer={
          <>
            <Button label="Try again" onPress={() => router.replace('/onboarding/credentials')} />
            <Button label="Back" variant="ghost" onPress={() => router.replace('/onboarding')} />
          </>
        }
      >
        <Banner tone="error" title="Connection failed" message={error} />
      </Screen>
    );
  }

  return (
    <Screen
      onBack={() => router.replace('/onboarding')}
      eyebrow="Connecting"
      title="Connecting…"
      subtitle="Talking to the camera over Wi-Fi."
    >
      <StageList stages={stages(reached)} />
    </Screen>
  );
}

/** Each step flips to done only once the camera has actually answered it. */
function stages(reached: ConnectStage | null): Stage[] {
  const index = reached ? ORDER.indexOf(reached) : -1;
  return ORDER.map((key, position) => {
    const state: StageState =
      position <= index ? 'done' : position === index + 1 ? 'active' : 'pending';
    return { key, label: LABELS[key], state };
  });
}
