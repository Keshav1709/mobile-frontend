import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { dashboardApi } from '@/api/dashboard';
import type { Alert, AlertsPage } from '@/api/types';
import type { LiveCamera } from '@/lib/cameraHealth';
import { useAuth } from '@/state/auth';
import { useConsole } from '@/state/console';
import { useLive } from '@/state/live';

/**
 * What needs looking at, in one place.
 *
 * `GET /alerts?status=active` already answers three questions at once: the open
 * alerts, how many there are, and which cameras have stopped sending. The tab
 * badge and the home screen both want all three, so they share one request
 * rather than each making their own on a timer.
 *
 * It refetches when the live socket says something happened, not on a clock.
 * A quiet site costs one request per app launch.
 */

type AttentionValue = {
  alerts: Alert[];
  activeCount: number;
  unavailableCameras: AlertsPage['unavailable_cameras'];
  /** Real camera health, keyed by camera id. Presence, not the stale column. */
  presence: Record<string, LiveCamera>;
  /**
   * Whether a picture could actually be fetched, keyed by camera id.
   *
   * Presence is not enough: it counts detections as well as frames, so a camera
   * with a broken stream still reports online. Undefined means not checked yet.
   */
  pictures: Record<string, boolean>;
  /** False until the first answer, so callers can tell empty from unknown. */
  loaded: boolean;
  refresh: () => Promise<void>;
};

const EMPTY: AttentionValue = {
  alerts: [],
  activeCount: 0,
  unavailableCameras: [],
  presence: {},
  pictures: {},
  loaded: false,
  refresh: async () => {},
};

const AttentionContext = createContext<AttentionValue>(EMPTY);

/** Enough for a home screen; the Alerts tab pages properly. */
const HOME_LIMIT = 20;
/** How often health is re-checked while the app is in front. */
const PRESENCE_MS = 30000;

export function AttentionProvider({ children }: { children: ReactNode }) {
  const { idToken, getToken } = useAuth();
  const { siteId, orgId, status: consoleStatus, can } = useConsole();
  const live = useLive();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [unavailableCameras, setUnavailable] = useState<AlertsPage['unavailable_cameras']>([]);
  const [presence, setPresence] = useState<Record<string, LiveCamera>>({});
  const [pictures, setPictures] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  const allowed = can('alerts.view');

  const refresh = useCallback(async () => {
    if (!idToken || consoleStatus !== 'ready' || !allowed) return;
    try {
      const token = (await getToken()) ?? idToken;
      const [page, rows] = await Promise.all([
        dashboardApi.alerts(token, 'active', { siteId, limit: HOME_LIMIT }),
        dashboardApi.liveCameras(token).catch(() => null),
      ]);
      setAlerts(page.alerts);
      setActiveCount(page.active_count);
      setUnavailable(page.unavailable_cameras ?? []);
      if (rows) {
        setPresence(Object.fromEntries(rows.map((row) => [row.id, row])));

        /**
         * Ask each camera for a picture. The stream endpoint answers an
         * unauthenticated or broken camera with 200 and an SVG placeholder
         * rather than an error, so the content type is the real answer.
         */
        const checked = await Promise.all(
          rows.map(async (row) => {
            try {
              const res = await fetch(dashboardApi.frameUrl(row.id, token), { method: 'GET' });
              const type = (res.headers.get('content-type') ?? '').toLowerCase();
              return [row.id, res.ok && type.startsWith('image/') && !type.includes('svg')] as const;
            } catch {
              return [row.id, false] as const;
            }
          }),
        );
        setPictures(Object.fromEntries(checked));
      }
    } catch {
      // Leave the last answer standing. A dropped request on factory wifi
      // should not empty the badge and make a live site look quiet.
    } finally {
      setLoaded(true);
    }
  }, [idToken, getToken, consoleStatus, allowed, siteId]);

  // On open, on a centre or site change, and whenever the socket reports an
  // alert or event. `revision` bumps on both.
  useEffect(() => {
    void refresh();
  }, [refresh, orgId, live.revision]);

  /**
   * A camera going quiet produces no socket message, so health needs a clock as
   * well. Thirty seconds, and only while the app is in front: a phone in a
   * pocket should cost nothing.
   */
  useEffect(() => {
    let active = AppState.currentState === 'active';
    const timer = setInterval(() => {
      if (active) void refresh();
    }, PRESENCE_MS);
    const sub = AppState.addEventListener('change', (next) => {
      const wasActive = active;
      active = next === 'active';
      if (active && !wasActive) void refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ alerts, activeCount, unavailableCameras, presence, pictures, loaded, refresh }),
    [alerts, activeCount, unavailableCameras, presence, pictures, loaded, refresh],
  );

  return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>;
}

export function useAttention(): AttentionValue {
  return useContext(AttentionContext);
}
