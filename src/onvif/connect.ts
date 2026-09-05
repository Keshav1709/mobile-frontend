import { getDeviceInformation, getProfiles, getStreamUri, OnvifDevice, OnvifProfile } from './device';
import { FoundCamera } from './scan';
import { Credentials, OnvifErrorCode } from './soap';

export type ConnectStage = 'found' | 'authenticating' | 'profile' | 'stream';

export type ConnectResult = {
  device: OnvifDevice;
  /** The highest-resolution profile: what the camera is recorded as. */
  profile: OnvifProfile;
  profiles: OnvifProfile[];
  /** Never rendered: these carry the camera password. */
  streamUri: string;
  /** Lowest-resolution stream, for smooth playback on a phone. */
  previewUri: string;
};

/** Copy for each way the connect sequence can fail. */
export const CONNECT_ERRORS: Record<OnvifErrorCode, string> = {
  UNAUTHORIZED: 'Username or password is incorrect.',
  UNREACHABLE:
    "We couldn't reach the camera. Make sure it is powered on and connected to this network.",
  NOT_ONVIF: "This camera doesn't support ONVIF.",
  FAULT: 'The camera rejected the request. Try again.',
  NO_PROFILES: "The camera didn't report any video profiles.",
  NO_STREAM_URI: "We read the camera's profile but it returned no stream address.",
};

/**
 * Authenticate, read the device details, pick the main profile and resolve its
 * RTSP URL — the same sequence the ONVIF spec defines, run from the phone.
 * `onStage` fires as each step completes so the UI shows real progress.
 */
export async function connectCamera(
  camera: FoundCamera,
  credentials: Credentials,
  onStage: (stage: ConnectStage) => void,
): Promise<ConnectResult> {
  onStage('found');

  const device = await getDeviceInformation(camera.ip, camera.port, credentials);
  onStage('authenticating');

  const profiles = await getProfiles(device, credentials);
  const profile = profiles[0];
  onStage('profile');

  const streamUri = await getStreamUri(device, profile.token, credentials);

  // The sub-stream is what the phone actually plays; falling back to the main
  // one keeps single-profile cameras working.
  const preview = profiles[profiles.length - 1];
  const previewUri =
    preview.token === profile.token
      ? streamUri
      : await getStreamUri(device, preview.token, credentials).catch(() => streamUri);

  onStage('stream');

  return { device, profile, profiles, streamUri, previewUri };
}

