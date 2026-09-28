import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { dashboardApi } from '@/api/dashboard';
import type { Alert, AlertsPage, AttendanceOverview } from '@/api/types';
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
  /**
   * Today's real people count, straight from the attendance board.
   *
   * Null when the workspace has no attendance, or the role cannot see it. The
   * home screen leaves the numbers out entirely rather than showing zeros,
   * which would read as a quiet day rather than a missing feature.
   */
  attendance: AttendanceOverview | null;
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
  attendance: null,
  loaded: false,
  refresh: async () => {},
};

const AttentionContext = createContext<AttentionValue>(EMPTY);

/** Enough for a home screen; the Alerts tab pages properly. */
const HOME_LIMIT = 20;
/** How often health is re-checked while the app is in front. */
const PRESENCE_MS = 30000;
/**
 * The soonest a socket event may trigger another refetch.
 *
 * `revision` bumps on every event the edge reports, which on a working site is
 * constant. Refetching on each one meant three API calls and a picture per
 * camera, several times a minute, which saturated the phone's connection and
 * left everything else queued behind it.
 */
const EVENT_THROTTLE_MS = 15000;
/** Pictures are the expensive check, so they run on their own slower clock. */
const PICTURE_MS = 60000;

export function AttentionProvider({ children }: { children: ReactNode }) {
  const { idToken, getToken } = useAuth();
  const { siteId, orgId, status: consoleStatus, can } = useConsole();
  const live = useLive();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [unavailableCameras, setUnavailable] = useState<AlertsPage['unavailable_cameras']>([]);
  const [presence, setPresence] = useState<Record<string, LiveCamera>>({});
  const [pictures, setPictures] = useState<Record<string, boolean>>({});
  const [attendance, setAttendance] = useState<AttendanceOverview | null>(null);
  /** Read by the picture check without making it depend on presence. */
  const presenceRef = useRef<Record<string, LiveCamera>>({});
  const [loaded, setLoaded] = useState(false);

  const allowed = can('alerts.view');
  const canSeePeople = can('people.view');

  const refresh = useCallback(async () => {
    if (!idToken || consoleStatus !== 'ready' || !allowed) return;
    try {
      const token = (await getToken()) ?? idToken;
      const [page, rows, board] = await Promise.all([
        dashboardApi.alerts(token, 'active', { siteId, limit: HOME_LIMIT }),
        dashboardApi.liveCameras(token).catch(() => null),
        canSeePeople ? dashboardApi.attendanceOverview(token).catch(() => null) : null,
      ]);
      if (board) setAttendance(board);
      setAlerts(page.alerts);
      setActiveCount(page.active_count);
      setUnavailable(page.unavailable_cameras ?? []);
      if (rows) {
        const next = Object.fromEntries(rows.map((row) => [row.id, row]));
        presenceRef.current = next;
        setPresence(next);
      }
    } catch {
      // Leave the last answer standing. A dropped request on factory wifi
      // should not empty the badge and make a live site look quiet.
    } finally {
      setLoaded(true);
    }
  }, [idToken, getToken, consoleStatus, allowed, canSeePeople, siteId]);

  /**
   * Ask each camera for a picture, on its own clock.
   *
   * Presence counts detections as well as frames, so this is the only way to
   * know a camera can actually be watched. It is also the expensive check: one
   * image per camera. A minute apart, and never while backgrounded.
   */
  const checkPictures = useCallback(async () => {
    if (!idToken || consoleStatus !== 'ready') return;
    const ids = Object.keys(presenceRef.current);
    if (!ids.length) return;
    const token = (await getToken()) ?? idToken;
    const checked = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(dashboardApi.frameUrl(id, token));
          const type = (res.headers.get('content-type') ?? '').toLowerCase();
          return [id, res.ok && type.startsWith('image/') && !type.includes('svg')] as const;
        } catch {
          return [id, false] as const;
        }
      }),
    );
    setPictures(Object.fromEntries(checked));
  }, [idToken, getToken, consoleStatus]);

  // Open, centre change, or a site change: always.
  useEffect(() => {
    void refresh();
  }, [refresh, orgId]);

  /**
   * Socket events, throttled. Without this a busy site refetches everything
   * several times a minute and leaves no room for the screen someone opened.
   */
  const lastEventRefresh = useRef(0);
  useEffect(() => {
    if (!live.revision) return;
    const now = Date.now();
    if (now - lastEventRefresh.current < EVENT_THROTTLE_MS) return;
    lastEventRefresh.current = now;
    void refresh();
  }, [live.revision, refresh]);

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
    const pictureTimer = setInterval(() => {
      if (active) void checkPictures();
    }, PICTURE_MS);
    void checkPictures();
    const sub = AppState.addEventListener('change', (next) => {
      const wasActive = active;
      active = next === 'active';
      if (active && !wasActive) void refresh();
    });
    return () => {
      clearInterval(timer);
      clearInterval(pictureTimer);
      sub.remove();
    };
  }, [refresh, checkPictures]);

  const value = useMemo(
    () => ({
      alerts,
      activeCount,
      unavailableCameras,
      presence,
      pictures,
      attendance,
      loaded,
      refresh,
    }),
    [alerts, activeCount, unavailableCameras, presence, pictures, attendance, loaded, refresh],
  );

  return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>;
}

export function useAttention(): AttentionValue {
  return useContext(AttentionContext);
}
