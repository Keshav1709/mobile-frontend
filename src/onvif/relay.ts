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
import { base64, joinUrl, query } from '@/lib/helpers';

/** A relay to use instead of whatever the agent reports. Development only. */
const OVERRIDE = process.env.EXPO_PUBLIC_GO2RTC_URL ?? '';

/** go2rtc's own default, used when the agent reports no port. */
const DEFAULT_PORT = '1984';

let relayUrl = OVERRIDE;

/**
 * The relay's basic-auth credentials, handed over by the agent once this phone
 * has paired with a box.
 *
 * The relay's API is not a read-only video service. Unauthenticated it lists
 * every camera on the site, serves the stack's own configuration out of
 * `/api/config`, and lets any caller re-point a camera's name at a source of
 * their choosing — a guard showing an attacker's chosen picture rather than the
 * room. So it runs closed, and every call from here presents credentials.
 *
 * They are never baked into the build: `EXPO_PUBLIC_*` is inlined at build time
 * and readable by anyone holding the APK, and one APK is installed at every
 * site. They arrive per-box, over the paired connection, and live only in memory.
 */
let relayAuth: { username: string; password: string } | null = null;

/** Called by AgentProvider with whatever the paired box reported. */
export function setRelayCredentials(next: { username: string; password: string } | null): void {
  relayAuth = next && next.username && next.password ? next : null;
}

/** True when this phone can actually talk to a closed relay. */
export function relayAuthenticated(): boolean {
  return relayAuth !== null;
}

/** The Basic header for the relay, or nothing when it has no credentials. */
export function relayHeaders(): Record<string, string> {
  if (!relayAuth) return {};
  return { Authorization: `Basic ${base64(`${relayAuth.username}:${relayAuth.password}`)}` };
}

/**
 * The same credentials as URL userinfo.
 *
 * Needed only for the WebView player, and only because a WebView can set headers
 * on the document request and on nothing else. The player page pulls a script of
 * its own and then opens a WebSocket to `/api/ws` to negotiate WebRTC; neither
 * carries our header, and both are refused by a closed relay. Authenticating the
 * document through userinfo instead puts the credentials in the engine's own
 * HTTP-auth cache for that origin, which is what gets replayed on the subresource
 * and the socket.
 */
function withUserinfo(url: string): string {
  if (!relayAuth) return url;
  const auth = `${encodeURIComponent(relayAuth.username)}:${encodeURIComponent(relayAuth.password)}`;
  return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)/i, `$1${auth}@`);
}

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
    const response = await fetch(url, { method: 'PUT', headers: relayHeaders() });
    return response.ok;
  } catch {
    return false;
  }
}

export async function unpublishStream(name: string): Promise<void> {
  if (!relayUrl) return;
  try {
    await fetch(joinUrl(relayUrl, 'api/streams') + query({ name }), {
      method: 'DELETE',
      headers: relayHeaders(),
    });
  } catch {
    // The camera is being removed either way.
  }
}

/** Stream names: the default is the low-res one a phone can keep up with. */
export const streamNames = (cameraId: string) => ({
  preview: cameraId,
  high: `${cameraId}_hd`,
});

/**
 * The player page for a stream. Private on purpose.
 *
 * A bare relay URL cannot be used against a closed relay, so the only exported
 * ways in are `livePlayerSource` and `frameSource`, which attach credentials.
 * Exporting this again is how an unauthenticated request gets built by accident.
 */
function livePlayerUrl(name: string): string | null {
  if (!relayUrl) return null;
  return joinUrl(relayUrl, 'stream.html') + query({ src: name, mode: 'webrtc,mse,mjpeg' });
}

/**
 * Everything a WebView needs to play a stream from a closed relay.
 *
 * `headers` authenticates the document; `uri` carries the same credentials as
 * userinfo so the page's own script and its WebSocket are covered too — see
 * `withUserinfo`. `injectedJavaScript` is a belt-and-braces shim for engines
 * that decline to replay cached credentials on a WebSocket handshake: it adds
 * the userinfo to the socket URL the player builds from `location`.
 */
export function livePlayerSource(name: string): {
  uri: string;
  headers: Record<string, string>;
  injectedJavaScript: string;
} | null {
  const url = livePlayerUrl(name);
  if (!url) return null;
  return {
    uri: withUserinfo(url),
    headers: relayHeaders(),
    injectedJavaScript: websocketAuthShim(),
  };
}

/**
 * Patches `WebSocket` inside the player page so its handshake carries the relay
 * credentials. Injected before the page's own script runs.
 *
 * A browser cannot set headers on a WebSocket, so the only channel is userinfo
 * in the socket URL — which the constructor does accept and send as Basic auth.
 * go2rtc's player builds that URL from `location`, and `location` never exposes
 * userinfo, so it would otherwise build an unauthenticated one.
 */
export function websocketAuthShim(): string {
  if (!relayAuth) return 'true;';
  const user = JSON.stringify(encodeURIComponent(relayAuth.username));
  const pass = JSON.stringify(encodeURIComponent(relayAuth.password));
  // Plain string surgery rather than a regular expression: this source has to
  // survive being embedded in a template literal and then parsed again inside
  // the WebView, and a regex's backslashes are one escaping layer too many to
  // be confident about.
  return `(function(){try{
  var U=${user},P=${pass},N=window.WebSocket;
  if(!N)return;
  function authed(url){
    var s=String(url), i=s.indexOf('://');
    if(i<0)return s;
    var rest=s.slice(i+3);
    var slash=rest.indexOf('/');
    var host=slash<0?rest:rest.slice(0,slash);
    if(host.indexOf('@')>=0)return s;
    return s.slice(0,i+3)+U+':'+P+'@'+rest;
  }
  function Patched(url,protocols){
    return protocols===undefined?new N(authed(url)):new N(authed(url),protocols);
  }
  Patched.prototype=N.prototype;
  ['CONNECTING','OPEN','CLOSING','CLOSED'].forEach(function(k,i){Patched[k]=i;});
  window.WebSocket=Patched;
}catch(e){}})();true;`;
}

/**
 * One still frame of a stream, for drawing areas on. go2rtc renders it on demand.
 * Private for the same reason as `livePlayerUrl` — use `frameSource`.
 */
function frameUrl(name: string): string | null {
  if (!relayUrl) return null;
  return joinUrl(relayUrl, 'api/frame.jpeg') + query({ src: name, t: Date.now() });
}

/**
 * A still frame as an `<Image>` source.
 *
 * React Native's image loader sends `headers` from the source object, so this
 * needs no userinfo — a single request with nothing loaded afterwards.
 */
export function frameSource(name: string): { uri: string; headers: Record<string, string> } | null {
  const url = frameUrl(name);
  if (!url) return null;
  return { uri: url, headers: relayHeaders() };
}
