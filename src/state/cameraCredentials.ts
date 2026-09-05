import * as SecureStore from 'expo-secure-store';

import type { Credentials } from '@/onvif/soap';

/**
 * Camera credentials, kept in the device keychain.
 *
 * Pan/tilt and reconnect authenticate on every call, so the credentials have to
 * outlive the onboarding flow. SecureStore is hardware-backed and never leaves
 * the device — they are still never sent to the cloud.
 */
const key = (cameraId: string) => `zeroforg.camera.${cameraId}`;

export async function saveCredentials(cameraId: string, credentials: Credentials): Promise<void> {
  await SecureStore.setItemAsync(key(cameraId), JSON.stringify(credentials));
}

export async function loadCredentials(cameraId: string): Promise<Credentials | null> {
  const raw = await SecureStore.getItemAsync(key(cameraId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export async function forgetCredentials(cameraId: string): Promise<void> {
  await SecureStore.deleteItemAsync(key(cameraId));
}
