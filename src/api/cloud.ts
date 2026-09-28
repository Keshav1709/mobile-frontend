import { request } from './client';
import { RequestError } from './errors';
import { DASHBOARD_URL, headers as dashboardHeaders } from './console';
import type { ZonePolygon } from '@/lib/zones';

import {
  Camera,
  ProfileDraft,
  RegisterCamera,
  UserProfile,
} from './types';

const CLOUD_URL = process.env.EXPO_PUBLIC_CLOUD_URL ?? 'http://127.0.0.1:8000';

/**
 * Whether a registry address was actually configured for this build.
 *
 * Unset, `CLOUD_URL` falls back to a loopback address that means nothing on a
 * phone, and every call to it is a wait for a connection that cannot succeed.
 * The app is built to run without the registry, so when no address was given it
 * is not asked at all rather than asked and timed out — which makes deleting the
 * variable a clean way to turn it off, instead of a slow way.
 */
const REGISTRY_CONFIGURED = Boolean(
  (process.env.EXPO_PUBLIC_CLOUD_URL ?? '').trim() &&
    !/^https?:\/\/(127\.0\.0\.1|localhost)\b/i.test(process.env.EXPO_PUBLIC_CLOUD_URL ?? ''),
);

/**
 * The registry gets a short leash on anything in the sign-in path.
 *
 * It is optional by design: `AuthProvider` falls back to the dashboard manifest
 * when it cannot be reached, and everything but the app-only profile fields
 * keeps working. But the default fifteen seconds meant every launch sat on a
 * blank screen waiting for a service that was never going to answer, before
 * recovering perfectly well. It either replies quickly or it is not there.
 */
const AUTH_TIMEOUT_MS = 4000;

/**
 * The sign-in calls do not retry, and the short leash above is why.
 *
 * `AuthProvider.profileFor` asks the registry and the dashboard manifest at the
 * same time and takes whichever answers. Retrying the registry there would hold
 * sign-in open for three leashes instead of one, long after the dashboard had
 * already produced a usable profile. Everything else in the app keeps the
 * default retries — see `Options.retries` in ./client.
 */
const NO_RETRY = { retries: 0 } as const;

/**
 * How long the registry is left alone after it fails to answer at all.
 *
 * The registry is optional by design — `AuthProvider` builds the session from
 * the dashboard manifest when it is missing — but "optional" was still costing a
 * wait per call. Every launch asked it for `/api/auth/config`, then for a
 * session, and each of those sat through a DNS or connect failure before the
 * fallback started. When the configured host does not resolve at all, that is
 * the whole of the delay people see on sign-in, paid once per call rather than
 * once per launch.
 *
 * So a transport failure is remembered. The next call inside this window gives
 * up immediately with the same error, the fallback runs at once, and the
 * registry is tried again after it — a service that is merely restarting is back
 * within a minute, and one that was never deployed stops being asked.
 *
 * Only transport failures count. A refusal (no such account, read-only) is a
 * real answer from a service that is plainly up, and must not stop us asking.
 */
const UNREACHABLE_FOR_MS = 60000;

/** Codes that mean the registry did not answer, as opposed to answering "no". */
const TRANSPORT = new Set(['NETWORK_ERROR', 'TIMEOUT']);

let unreachableUntil = 0;

/** Tests and the diagnostics screen; also called when the address changes. */
export function resetRegistryHealth(): void {
  unreachableUntil = 0;
}

/** True while the registry is being skipped. */
export function registryUnreachable(): boolean {
  return Date.now() < unreachableUntil;
}

/** Whether this build has a registry to talk to at all. For diagnostics. */
export function registryConfigured(): boolean {
  return REGISTRY_CONFIGURED;
}

/**
 * Wraps a registry call with the circuit above.
 *
 * Rethrows the same `NETWORK_ERROR` a real attempt would have produced, so every
 * caller's existing handling is unchanged — they cannot tell a skipped call from
 * a failed one, which is the point.
 */
async function viaRegistry<T>(call: () => Promise<T>): Promise<T> {
  if (!REGISTRY_CONFIGURED || registryUnreachable()) {
    throw new RequestError({
      code: 'NETWORK_ERROR',
      message: 'The service could not be reached.',
    });
  }
  try {
    const answer = await call();
    unreachableUntil = 0;
    return answer;
  } catch (cause) {
    if (cause instanceof RequestError && TRANSPORT.has(cause.code)) {
      unreachableUntil = Date.now() + UNREACHABLE_FOR_MS;
    }
    throw cause;
  }
}

const bearer = (idToken: string) => ({ Authorization: `Bearer ${idToken}` });

/** Cloud registry: sign-in, workspace setup, box liveness, camera metadata. No camera secrets. */
export const cloudApi = {
  /** What the registry can do before anyone signs in, including whether it is
   *  a read-only view of the dashboard. */
  config: () =>
    viaRegistry(() =>
    request<{
      providers: string[];
      firebase_configured: boolean;
      dev_auth_enabled: boolean;
      environment: string;
      signup_enabled: boolean;
      read_only: boolean;
    }>(CLOUD_URL, '/api/auth/config', { timeoutMs: AUTH_TIMEOUT_MS, ...NO_RETRY })),

  createSession: (idToken: string, displayName?: string) =>
    viaRegistry(() =>
      request<{ ok: true; is_new: boolean; user: UserProfile }>(CLOUD_URL, '/api/auth/session', {
        method: 'POST',
        body: { id_token: idToken, display_name: displayName },
        timeoutMs: AUTH_TIMEOUT_MS,
        ...NO_RETRY,
      }),
    ),

  me: (idToken: string) =>
    viaRegistry(() =>
      request<UserProfile>(CLOUD_URL, '/api/auth/me', {
        headers: { Authorization: `Bearer ${idToken}` },
        timeoutMs: AUTH_TIMEOUT_MS,
        ...NO_RETRY,
      }),
    ),

  saveProfile: (idToken: string, draft: ProfileDraft) =>
    request<UserProfile>(CLOUD_URL, '/api/auth/me', {
      method: 'PATCH',
      body: draft,
      headers: { Authorization: `Bearer ${idToken}` },
    }),

  // Nothing about boxes. They are claimed, named and checked on the dashboard
  // by whoever installs them; the phone only adds cameras to the box a
  // workspace already has. GET /api/devices and POST /api/devices/claim both
  // still exist on the registry, and neither is called from here.

  /** Metadata only — no passwords, no authenticated RTSP URL. */
  registerCamera: (camera: RegisterCamera) =>
    request<{ ok: true; camera: Camera }>(CLOUD_URL, '/internal/cameras/sync', {
      method: 'POST',
      body: camera,
    }),

  // ── Cameras and areas — the dashboard's, scoped to the open centre ──────
  //
  // These read and write the dashboard's `cameras` rows through its own API, with the
  // centre the person has open sent as X-Org-ID (set by ConsoleProvider). Callers no
  // longer name a tenant: the profile's default org would silently override a switched
  // centre, which is the one thing a switcher must never do. The registry used
  // to serve the same rows read-only, which meant a zone drawn on the phone could never
  // be saved. Saving here bumps `config_version`, so the box re-syncs, and pushes the
  // change to every live viewer.

  listCameras: async (idToken: string) => {
    const rows = await request<DashboardCamera[]>(DASHBOARD_URL, '/vms/cameras', {
      headers: dashboardHeaders(idToken),
    });
    return rows.map(cameraFromDashboard);
  },

  getCamera: async (idToken: string, cameraId: string) =>
    cameraFromDashboard(
      await request<DashboardCamera>(DASHBOARD_URL, `/vms/cameras/config/${cameraId}`, {
        headers: dashboardHeaders(idToken),
      }),
    ),

  getCameraZones: async (idToken: string, cameraId: string) => {
    const row = await request<DashboardCamera>(DASHBOARD_URL, `/vms/cameras/config/${cameraId}`, {
      headers: dashboardHeaders(idToken),
    });
    return { camera_id: row.id, zones: row.zones_json ?? [], config_version: row.config_version ?? 1 };
  },

  updateCameraZones: async (idToken: string, cameraId: string, zones: ZonePolygon[]) => {
    const row = await request<DashboardCamera>(DASHBOARD_URL, `/vms/cameras/config/${cameraId}`, {
      method: 'PUT',
      body: { zones_json: zones },
      headers: dashboardHeaders(idToken),
    });
    return { camera_id: row.id, zones: row.zones_json ?? [], config_version: row.config_version ?? 1 };
  },

  deleteCamera: (cameraId: string) =>
    request<{ ok: true }>(CLOUD_URL, `/internal/cameras/${cameraId}`, { method: 'DELETE' }),
};

/** A camera row as GET /vms/cameras returns it. */
type DashboardCamera = {
  id: string;
  name: string;
  status: string | null;
  location: string | null;
  site_id: string | null;
  resolution: string | null;
  enabled: boolean;
  detection_mode: string | null;
  zones_json: ZonePolygon[] | null;
  config_version?: number | null;
  updated_at: string | null;
  last_event: string | null;
};

/**
 * The app's `Camera`, from a dashboard row. The ONVIF fields (manufacturer, model,
 * firmware, ONVIF address, profile) are the local agent's knowledge and have no
 * column on the dashboard; they were already null from the registry, and are null here
 * for the same reason. `connection_status` keeps the app's words for the dashboard's.
 */
function cameraFromDashboard(row: DashboardCamera): Camera {
  return {
    camera_id: row.id,
    tenant_id: '',
    display_name: row.name,
    manufacturer: null,
    model: null,
    firmware: null,
    serial_number: null,
    ip: null,
    onvif_xaddr: null,
    selected_profile: null,
    stream_reference: null,
    resolution: row.resolution ?? null,
    connection_status: row.status === 'online' ? 'CONNECTED' : 'DISCONNECTED',
    zones_json: row.zones_json ?? [],
    config_version: row.config_version ?? 1,
    last_seen: row.last_event ?? row.updated_at ?? null,
  };
}
