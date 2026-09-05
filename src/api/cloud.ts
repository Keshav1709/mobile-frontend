import { request } from './client';
import { Camera, ProfileDraft, RegisterCamera, UserProfile } from './types';

const CLOUD_URL = process.env.EXPO_PUBLIC_CLOUD_URL ?? 'http://127.0.0.1:8000';

/** Cloud registry: sign-in exchange and camera metadata. No camera secrets. */
export const cloudApi = {
  createSession: (idToken: string, displayName?: string) =>
    request<{ ok: true; user: UserProfile }>(CLOUD_URL, '/api/auth/session', {
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

  completeOnboarding: (idToken: string) =>
    request<UserProfile>(CLOUD_URL, '/api/auth/me', {
      method: 'PATCH',
      body: { onboarding_completed: true },
      headers: { Authorization: `Bearer ${idToken}` },
    }),

  /** Metadata only — no passwords, no authenticated RTSP URL. */
  registerCamera: (camera: RegisterCamera) =>
    request<{ ok: true; camera: Camera }>(CLOUD_URL, '/internal/cameras/sync', {
      method: 'POST',
      body: camera,
    }),

  listCameras: (tenantId: string) =>
    request<Camera[]>(CLOUD_URL, '/api/cameras', { headers: { 'X-Org-ID': tenantId } }),

  getCamera: (cameraId: string) => request<Camera>(CLOUD_URL, `/api/cameras/${cameraId}`),

  deleteCamera: (cameraId: string) =>
    request<{ ok: true }>(CLOUD_URL, `/internal/cameras/${cameraId}`, { method: 'DELETE' }),
};
