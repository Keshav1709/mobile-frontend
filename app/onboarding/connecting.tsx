import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { cloudApi } from '@/api/cloud';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Stage, StageList, StageState } from '@/components/StageList';
import { backTo, errorMessage } from '@/lib/helpers';
import { connectCamera, CONNECT_ERRORS, ConnectStage } from '@/onvif/connect';
import { publishStream, streamNames, withRtspCredentials } from '@/onvif/relay';
import { OnvifError } from '@/onvif/soap';
import { useAgent } from '@/state/agent';
import { useAuth } from '@/state/auth';
import { useConsole } from '@/state/console';
import { saveCredentials } from '@/state/cameraCredentials';
import { useOnboarding } from '@/state/onboarding';

const POLL_MS = 800;

const LABELS: Record<ConnectStage, string> = {
  found: 'Camera found',
  authenticating: 'Authenticating',
  profile: 'Getting camera profile',
  stream: 'Checking the video stream',
};

const ORDER: ConnectStage[] = ['found', 'authenticating', 'profile', 'stream'];

export default function Connecting() {
  const { target, takeCredentials, clear } = useOnboarding();
  const { api: agent } = useAgent();
  const { user } = useAuth();
  const { orgId } = useConsole();

  const [stages, setStages] = useState<Record<ConnectStage, StageState>>({
    found: 'active',
    authenticating: 'pending',
    profile: 'pending',
    stream: 'pending',
  });
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !target || !user) return;
    started.current = true;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reach = (stage: ConnectStage) => {
      if (!live) return;
      const index = ORDER.indexOf(stage);
      setStages(
        Object.fromEntries(
          ORDER.map((key, position) => [
            key,
            position <= index ? 'done' : position === index + 1 ? 'active' : 'pending',
          ]),
        ) as Record<ConnectStage, StageState>,
      );
    };

    /**
     * The agent authenticates, validates the stream by decoding a frame and
     * keeps the password encrypted on its own host. Nothing is stored here.
     */
    const viaAgent = async () => {
      const credentials = takeCredentials();
      const { job_id } = await agent!.startConnect({
        temporary_id: target.temporaryId,
        ip: target.ip,
        port: target.port,
        tenant_id: orgId ?? user.tenant_id,
        user_id: user.user_id,
        ...credentials,
      });

      const poll = async () => {
        if (!live) return;
        const job = await agent!.connectJob(job_id);
        setStages(job.stages as Record<ConnectStage, StageState>);

        if (job.error) return setError(job.error.message);
        if (job.status === 'connected' && job.camera_id) {
          clear();
          router.replace({ pathname: '/onboarding/success', params: { id: job.camera_id } });
          return;
        }
        timer = setTimeout(poll, POLL_MS);
      };

      await poll();
    };

    /** No agent: the phone does the whole sequence and holds the credentials. */
    const viaPhone = async () => {
      const credentials = takeCredentials();
      const result = await connectCamera(
        { id: `${target.ip}:${target.port}`, ...target },
        credentials,
        reach,
      );

      const cameraId = `cam_${target.ip.replace(/\./g, '_')}_${target.port}`;
      const authed = (uri: string) =>
        withRtspCredentials(uri, credentials.username, credentials.password);
      const names = streamNames(cameraId);
      const [streaming] = await Promise.all([
        publishStream(names.preview, authed(result.previewUri)),
        publishStream(names.high, authed(result.streamUri)),
      ]);

      await cloudApi.registerCamera({
        camera_id: cameraId,
        tenant_id: orgId ?? user.tenant_id,
        user_id: user.user_id,
        display_name:
          [result.device.manufacturer, result.device.model].filter(Boolean).join(' ') ||
          `Camera ${target.ip}`,
        manufacturer: result.device.manufacturer,
        model: result.device.model,
        firmware: result.device.firmware,
        serial_number: result.device.serialNumber,
        ip: target.ip,
        onvif_xaddr: target.serviceUrl,
        selected_profile: result.profile.token,
        resolution: result.profile.resolution,
        connection_status: 'CONNECTED',
        stream_reference: streaming ? cameraId : null,
      });

      await saveCredentials(cameraId, credentials);
      clear();
      if (live) router.replace({ pathname: '/onboarding/success', params: { id: cameraId } });
    };

    (agent ? viaAgent() : viaPhone()).catch((cause) => {
      if (!live) return;
      setError(
        cause instanceof OnvifError
          ? CONNECT_ERRORS[cause.code]
          : errorMessage(cause, 'Something went wrong while connecting the camera.'),
      );
    });

    return () => {
      live = false;
      clearTimeout(timer);
    };
    // Runs once: the credentials are consumed on the first attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, user, agent]);

  if (error) {
    return (
      <Screen
        onBack={() => backTo('/onboarding')}
        eyebrow="Connecting"
        title="We couldn't connect"
        footer={
          <>
            <Button label="Try again" onPress={() => backTo('/onboarding/credentials')} />
            <Button label="Back" variant="ghost" onPress={() => backTo('/onboarding')} />
          </>
        }
      >
        <Banner tone="error" title="Connection failed" message={error} />
      </Screen>
    );
  }

  return (
    <Screen
      onBack={() => backTo('/onboarding')}
      eyebrow={agent ? 'Connecting · local agent' : 'Connecting'}
      title="Connecting…"
      subtitle={
        agent
          ? 'The agent is authenticating and testing the video.'
          : 'Talking to the camera over Wi-Fi.'
      }
    >
      <StageList stages={list(stages)} />
    </Screen>
  );
}

const list = (stages: Record<ConnectStage, StageState>): Stage[] =>
  ORDER.map((key) => ({ key, label: LABELS[key], state: stages[key] ?? 'pending' }));
