import { request } from '@/api/client';
import { Camera } from '@/api/types';
import type { Direction } from '@/onvif/ptz';

/**
 * The local agent's API. Present only when an agent is running on the LAN.
 *
 * Everything but `/api/health` and `/api/pair` needs the box's token. The agent
 * used to answer any caller on the network, which meant anything that could
 * reach port 8765 could list the cameras, move them, or delete them. `info` is
 * still open — it is how a box is found at all — but it now reports
 * `auth_required`, and the claim code it used to hand out is only included for a
 * caller that is already paired.
 */

export type AgentInfo = {
  service: string;
  agent_url: string;
  host: string;
  port: number;
  go2rtc_url: string;
  capabilities: string[];
  /** True when the camera endpoints need a token. Absent on older agents. */
  auth_required?: boolean;
  /**
   * The video relay's credentials, present only for a paired caller.
   *
   * The relay runs closed — unauthenticated it lists every camera, serves the
   * stack's configuration, and lets anyone re-point a camera at another source.
   * Absent means the relay has none set and is open, which the app should treat
   * as a problem with the box rather than as normal.
   */
  relay?: { username: string; password: string };
  /**
   * Whether the box is bound to a workspace. `claim_code` is present only for a
   * paired caller or one on the box itself; read it off the box's own /pair page.
   */
  cloud?: {
    enabled: boolean;
    registered: boolean;
    connected: boolean;
    last_error: string | null;
    device_id?: string;
    org_id?: string;
    claim_code?: string;
    claim_expires_at?: string;
  };
};

export type AgentDevice = {
  temporary_id: string;
  ip: string;
  mac: string | null;
  manufacturer: string | null;
  model: string | null;
  onvif: boolean;
  rtsp_detected: boolean;
  rtsp_scheme: string | null;
  ports: number[];
};

export type AgentScan = {
  scan_id: string;
  status: 'scanning' | 'completed' | 'failed' | string;
  stage: string;
  progress: { network?: boolean; onvif?: boolean; identifying?: boolean };
  devices: AgentDevice[];
  error: { code: string; message: string } | null;
};

export type AgentConnectJob = {
  job_id: string;
  status: string;
  stage: string;
  stages: Record<'found' | 'authenticating' | 'profile' | 'stream', 'pending' | 'active' | 'done'>;
  camera_id: string | null;
  camera: (Camera & { streaming: string }) | null;
  error: { code: string; message: string } | null;
};

/**
 * @param token The box's API token, where this phone has been paired with one.
 *   Omitted for the discovery probe, which needs no token and must stay cheap.
 */
export function agentApi(baseUrl: string, token?: string | null) {
  const call = <T>(path: string, options?: Parameters<typeof request>[2]) =>
    request<T>(baseUrl, `/api${path}`, {
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });

  return {
    baseUrl,
    /**
     * Who this box is. The timeout is a parameter because discovery probes
     * many addresses that will never answer, and those should give up fast.
     */
    info: (timeoutMs = 3000) => call<AgentInfo>('/pair', { timeoutMs }),

    startScan: () => call<{ scan_id: string }>('/cameras/discover', { timeoutMs: 8000 }),
    scan: (scanId: string) => call<AgentScan>(`/cameras/discover/${scanId}`),

    /**
     * The password is sent once and kept encrypted on the agent, not here.
     * `tenant_id` decides which account the agent files the camera under when
     * it syncs to the cloud — without it the agent falls back to its own
     * default and the camera never appears in the user's list.
     */
    startConnect: (body: {
      temporary_id?: string;
      ip?: string;
      port?: number;
      username: string;
      password: string;
      tenant_id: string;
      user_id: string;
    }) => call<{ job_id: string }>('/cameras/connect', { method: 'POST', body }),
    connectJob: (jobId: string) => call<AgentConnectJob>(`/cameras/connect/${jobId}`),

    pan: (cameraId: string, direction: Direction | null) =>
      call<{ camera_id: string }>(`/cameras/${cameraId}/pan`, {
        method: 'POST',
        body: { direction },
        timeoutMs: 5000,
      }),

    remove: (cameraId: string) => call<void>(`/cameras/${cameraId}`, { method: 'DELETE' }),
  };
}

export type AgentApi = ReturnType<typeof agentApi>;
