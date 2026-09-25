import { request } from './client';
import { DASHBOARD_URL, headers as dashboardHeaders } from './console';
import type { ZonePolygon } from '@/lib/zones';

import {
  Camera,
  Device,
  ProfileDraft,
  RegisterCamera,
  UserProfile,
} from './types';

const CLOUD_URL = process.env.EXPO_PUBLIC_CLOUD_URL ?? 'http://127.0.0.1:8000';

const bearer = (idToken: string) => ({ Authorization: `Bearer ${idToken}` });

/** Cloud registry: sign-in, workspace setup, box liveness, camera metadata. No camera secrets. */
export const cloudApi = {
  /** What the registry can do before anyone signs in, including whether it is
   *  a read-only view of the dashboard. */
  config: () =>
    request<{
      providers: string[];
      firebase_configured: boolean;
      dev_auth_enabled: boolean;
      environment: string;
      signup_enabled: boolean;
      read_only: boolean;
    }>(CLOUD_URL, '/api/auth/config'),

  createSession: (idToken: string, displayName?: string) =>
    request<{ ok: true; is_new: boolean; user: UserProfile }>(CLOUD_URL, '/api/auth/session', {
      method: 'POST',
      body: { id_token: idToken, display_name: displayName },
    }),

  me: (idToken: string) =>
    request<UserProfile>(CLOUD_URL, '/api/auth/me', {
      headers: { Authorization: `Bearer ${idToken}` },
    }),

  saveProfile: (idToken: string, draft: ProfileDraft) =>
    request<UserProfile>(CLOUD_URL, '/api/auth/me', {
      method: 'PATCH',
      body: draft,
      headers: { Authorization: `Bearer ${idToken}` },
    }),

  // No bindDevice. A box is claimed on the dashboard by whoever installs it,
  // and POST /api/devices/claim stays there. The app reads which box the
  // workspace has and adds cameras to it; it never adopts a new one.

  /** Boxes bound to the workspace, with the connect-box checks already decided. */
  listDevices: (idToken: string) =>
    request<Device[]>(CLOUD_URL, '/api/devices', { headers: bearer(idToken), timeoutMs: 6000 }),

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
