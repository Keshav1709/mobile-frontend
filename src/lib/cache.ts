import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What the app remembers between launches, so a cold start has something to
 * show before the network answers.
 *
 * Nothing here is authoritative and nothing here is secret. It is the last
 * answer a service gave, kept so the operator sees their cameras immediately
 * instead of a skeleton, and still sees them when the site wifi is down.
 * Secrets stay in SecureStore; this is deliberately the unencrypted store.
 *
 * Every read is defensive: a cache that is missing, truncated or written by an
 * older build must never be the reason a screen fails to render.
 */

const PREFIX = 'zeroforg.cache.';

/** Bumped when a cached shape changes, which retires every older entry. */
const VERSION = 1;

type Entry<T> = { v: number; at: number; data: T };

export type Cached<T> = { data: T; at: number };

export async function readCache<T>(key: string): Promise<Cached<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (!entry || entry.v !== VERSION || entry.data === undefined) return null;
    return { data: entry.data, at: entry.at };
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  const entry: Entry<T> = { v: VERSION, at: Date.now(), data };
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // A cache that cannot be written is not worth failing a request over.
  }
}

/** Everything this login cached. Cleared on sign-out so the next account starts clean. */
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((key) => key.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // Same reasoning as above.
  }
}

/**
 * Cache keys. Anything scoped to one account or one centre carries that id, so
 * a switch never shows the previous one's data.
 */
export const cacheKey = {
  profile: 'profile',
  cameras: (orgId: string | null) => `cameras.${orgId ?? 'default'}`,
  lastCamera: (orgId: string | null) => `last_camera.${orgId ?? 'default'}`,
  alerts: (orgId: string | null, siteId: string | null) =>
    `alerts.${orgId ?? 'default'}.${siteId ?? 'all'}`,
  frame: (cameraId: string) => `frame.${cameraId}`,
};

/** "2 minutes ago", for the line that tells someone what they are looking at. */
export function agoLabel(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
