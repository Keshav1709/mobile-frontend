/**
 * go2rtc relay.
 *
 * iOS cannot play RTSP, so the camera's stream is registered with a go2rtc
 * instance on the local network which republishes it as WebRTC/MSE. The
 * authenticated RTSP URL goes only to that local relay — never to the cloud.
 */

import { joinUrl, query } from '@/lib/helpers';

const RELAY_URL = process.env.EXPO_PUBLIC_GO2RTC_URL ?? '';

export const relayConfigured = Boolean(RELAY_URL);

/** ONVIF returns a bare RTSP URL; the camera still wants credentials on it. */
export function withRtspCredentials(uri: string, username: string, password: string): string {
  if (/^rtsps?:\/\/[^/]*@/i.test(uri)) return uri;
  const auth = `${encodeURIComponent(username)}:${encodeURIComponent(password)}`;
  return uri.replace(/^(rtsps?:\/\/)/i, `$1${auth}@`);
}

/** Registers the stream under `name`. Returns false when the relay is absent. */
export async function publishStream(name: string, rtspUri: string): Promise<boolean> {
  if (!RELAY_URL) return false;
  const url = joinUrl(RELAY_URL, 'api/streams') + query({ name, src: rtspUri });
  try {
    const response = await fetch(url, { method: 'PUT' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function unpublishStream(name: string): Promise<void> {
  if (!RELAY_URL) return;
  try {
    await fetch(joinUrl(RELAY_URL, 'api/streams') + query({ name }), { method: 'DELETE' });
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
export function livePlayerUrl(name: string): string {
  return joinUrl(RELAY_URL, 'stream.html') + query({ src: name, mode: 'webrtc,mse,mjpeg' });
}

/** One still frame of a stream, for drawing areas on. go2rtc renders it on demand. */
export function frameUrl(name: string): string | null {
  if (!RELAY_URL) return null;
  return joinUrl(RELAY_URL, 'api/frame.jpeg') + query({ src: name, t: Date.now() });
}
