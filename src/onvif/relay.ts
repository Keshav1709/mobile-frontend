/**
 * go2rtc relay.
 *
 * iOS cannot play RTSP, so the camera's stream is registered with a go2rtc
 * instance on the local network which republishes it as WebRTC/MSE. The
 * authenticated RTSP URL goes only to that local relay — never to the cloud.
 *
 * Where that relay *is* cannot be decided when the app is built. Every site
 * runs its own, on its own network, and one APK is installed at all of them —
 * so a baked-in `EXPO_PUBLIC_GO2RTC_URL` is right for exactly one site and
 * silently wrong, pointing at a stranger's address, everywhere else. The
 * address is resolved from the agent the phone found instead, and
 * `AgentProvider` pushes it here as soon as it has one.
 */

import { AgentInfo } from '@/agent/client';
import { joinUrl, query } from '@/lib/helpers';

/** A relay to use instead of whatever the agent reports. Development only. */
const OVERRIDE = process.env.EXPO_PUBLIC_GO2RTC_URL ?? '';

/** go2rtc's own default, used when the agent reports no port. */
const DEFAULT_PORT = '1984';

let relayUrl = OVERRIDE;

const authority = (url: string) => url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0];
const hostOf = (url: string) => authority(url).split(':')[0];
const portOf = (url: string) => authority(url).match(/:(\d+)$/)?.[1] ?? null;
const schemeOf = (url: string) => url.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1] ?? 'http';

/**
 * The relay's address as seen *from this phone*.
 *
 * The agent reports `go2rtc_url` from its own config, which defaults to
 * `http://127.0.0.1:1984` — its loopback, and meaningless anywhere but on the
 * box itself. Only the scheme and port of it can be trusted; the host has to
 * be the address this phone actually reached the agent on, whatever route
 * that took.
 */
export function resolveRelayUrl(info: AgentInfo | null): string {
  if (OVERRIDE) return OVERRIDE;
  if (!info) return '';

  const host = hostOf(info.agent_url || '') || info.host || '';
  if (!host) return '';

  const reported = info.go2rtc_url || '';
  return `${schemeOf(reported)}://${host}:${portOf(reported) ?? DEFAULT_PORT}`;
}

/** Called by AgentProvider whenever the agent it can see changes. */
export function setRelayUrl(url: string): void {
  relayUrl = url;
}

/** ONVIF returns a bare RTSP URL; the camera still wants credentials on it. */
export function withRtspCredentials(uri: string, username: string, password: string): string {
  if (/^rtsps?:\/\/[^/]*@/i.test(uri)) return uri;
  const auth = `${encodeURIComponent(username)}:${encodeURIComponent(password)}`;
  return uri.replace(/^(rtsps?:\/\/)/i, `$1${auth}@`);
}

/** Registers the stream under `name`. Returns false when the relay is absent. */
export async function publishStream(name: string, rtspUri: string): Promise<boolean> {
  if (!relayUrl) return false;
  const url = joinUrl(relayUrl, 'api/streams') + query({ name, src: rtspUri });
  try {
    const response = await fetch(url, { method: 'PUT' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function unpublishStream(name: string): Promise<void> {
  if (!relayUrl) return;
  try {
    await fetch(joinUrl(relayUrl, 'api/streams') + query({ name }), { method: 'DELETE' });
  } catch {
    // The camera is being removed either way.
  }
}

/** Stream names: the default is the low-res one a phone can keep up with. */
export const streamNames = (cameraId: string) => ({
  preview: cameraId,
  high: `${cameraId}_hd`,
});

/** The player page for a stream. Loaded in a WebView — it is plain HTML. */
export function livePlayerUrl(name: string): string | null {
  if (!relayUrl) return null;
  return joinUrl(relayUrl, 'stream.html') + query({ src: name, mode: 'webrtc,mse,mjpeg' });
}

/** One still frame of a stream, for drawing areas on. go2rtc renders it on demand. */
export function frameUrl(name: string): string | null {
  if (!relayUrl) return null;
  return joinUrl(relayUrl, 'api/frame.jpeg') + query({ src: name, t: Date.now() });
}
