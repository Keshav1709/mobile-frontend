import { request } from '@/api/client';
import { Camera } from '@/api/types';
import type { Direction } from '@/onvif/ptz';

/** The local agent's API. Present only when an agent is running on the LAN. */

export type AgentInfo = {
  service: string;
  agent_url: string;
  host: string;
  port: number;
  go2rtc_url: string;
  capabilities: string[];
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

export function agentApi(baseUrl: string) {
  const call = <T>(path: string, options?: Parameters<typeof request>[2]) =>
    request<T>(baseUrl, `/api${path}`, options);

  return {
    baseUrl,
    info: () => call<AgentInfo>('/pair', { timeoutMs: 3000 }),

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
