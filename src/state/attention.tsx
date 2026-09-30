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
 * The soonest a socket event may trigger a *full* refetch.
 *
 * `revision` bumps on every event the edge reports, which on a working site is
 * constant. Refetching everything on each one meant three API calls and a picture
 * per camera, several times a minute, which saturated the phone's connection and
 * left everything else queued behind it.
 *
 * The throttle is still needed, but it used to apply to the alert count too, and
 * that was the wrong trade: the one number people watch could be fifteen seconds
 * behind the building because it shared a clock with the expensive checks. The
 * two are separated below — alerts on their own short throttle, presence and the
 * attendance board on this one.
 */
/**
 * The capabilities that mean this workspace has an attendance board.
 *
 * Kept in step with `AppMenu`'s `needs` for the same entry; a workspace with
 * neither has no board to show and no endpoint that will answer.
 */
const ATTENDANCE_KEYS = ['attendance_board', 'attendance'];

const EVENT_THROTTLE_MS = 15000;

/**
 * The soonest a socket event may re-read the alerts.
 *
 * One request, and it is the one that decides whether the screen says anything
 * needs a person. Worth asking for almost immediately; still throttled, because a
 * burst of detections should not become a burst of requests.
 */
const ALERT_THROTTLE_MS = 1200;
/** Pictures are the expensive check, so they run on their own slower clock. */
const PICTURE_MS = 60000;

export function AttentionProvider({ children }: { children: ReactNode }) {
  const { idToken, getToken, user } = useAuth();
  const { siteId, orgId, status: consoleStatus, can, manifest } = useConsole();
  /**
   * Whether this site's video comes from its own go2rtc rather than pushed frames.
   *
   * It decides whether the picture check below means anything. A go2rtc site does
   * not feed the edge frame endpoint at all — it answers with an "OFFLINE"
   * placeholder for every camera — so checking it there does not report a camera
   * with no picture, it reports the wrong endpoint. CoE Gandhinagar had six live
   * cameras and every one of them marked as not sending.
   */
  const siteRunsGo2rtc = Boolean(manifest?.live?.go2rtc);
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
  /**
   * Whether this workspace has an attendance board at all.
   *
   * Two separate questions, and only one of them used to be asked. `people.view`
   * is a *permission* — an owner has every permission, including on a workspace
   * that has never had the attendance product. TRZ is exactly that: its
   * capabilities are `intrusion` and `loading_unloading`, its dashboard is a
   * dock view, and the server answers this endpoint with
   * "Attendance board is not enabled for this organization". Asking anyway
   * bought a guaranteed 403 on every refresh.
   *
   * The capability is the first question and the permission the second. These
   * are the same keys the menu already gates its Attendance entry on, which is
   * why the entry was correctly hidden while Home showed the figures anyway.
   */
  const features = new Set(user?.features ?? []);
  const hasAttendance = ATTENDANCE_KEYS.some((key) => features.has(key));
  const canSeePeople = hasAttendance && can('people.view');

  const refresh = useCallback(async () => {
    if (!idToken || consoleStatus !== 'ready' || !allowed) return;
    try {
      const token = (await getToken()) ?? idToken;
      const [page, rows, board] = await Promise.all([
        dashboardApi.alerts(token, 'active', { siteId, limit: HOME_LIMIT }),
        dashboardApi.liveCameras(token).catch(() => null),
        canSeePeople ? dashboardApi.attendanceOverview(token).catch(() => null) : null,
      ]);
      // Set unconditionally. This used to be `if (board)`, which looks like it
      // is protecting good data from a failed request and is in fact how one
      // organisation's figures end up displayed under another's name: the call
      // is caught to null when the board is unavailable, the guard skips the
      // write, and whatever was last loaded stays on screen through an
      // organisation switch. Signing in to a workspace with no attendance then
      // showed the previous workspace's headcount.
      setAttendance(board ?? null);
      setAlerts(page.alerts);
      setActiveCount(page.active_count);
      setUnavailable(page.unavailable_cameras ?? []);
      // Same reasoning as the board above: a failed read must not leave the
      // previous workspace's cameras being reported as this one's health.
      const next = rows ? Object.fromEntries(rows.map((row) => [row.id, row])) : {};
      presenceRef.current = next;
      setPresence(next);
    } catch {
      // Leave the last answer standing. A dropped request on factory wifi
      // should not empty the badge and make a live site look quiet.
    } finally {
      setLoaded(true);
    }
  }, [idToken, getToken, consoleStatus, allowed, canSeePeople, siteId]);

  /**
   * Just the alerts, for when the socket says something happened.
   *
   * The full `refresh` also reads every camera's presence and the attendance
   * board, which is why it cannot run often. This is one request, so it can —
   * and it is what makes the badge and the alert list move with the site rather
   * than on the next slow cycle.
   */
  const refreshAlerts = useCallback(async () => {
    if (!idToken || consoleStatus !== 'ready' || !allowed) return;
    try {
      const token = (await getToken()) ?? idToken;
      const page = await dashboardApi.alerts(token, 'active', { siteId, limit: HOME_LIMIT });
      setAlerts(page.alerts);
      setActiveCount(page.active_count);
      setUnavailable(page.unavailable_cameras ?? []);
    } catch {
      // Same reasoning as `refresh`: keep the last answer rather than emptying
      // the badge because one request did not land.
    }
  }, [idToken, getToken, consoleStatus, allowed, siteId]);

  /**
   * Ask each camera for a picture, on its own clock.
   *
   * Presence counts detections as well as frames, so this is the only way to
   * know a camera can actually be watched. It is also the expensive check: one
   * image per camera. A minute apart, and never while backgrounded.
   */
  const checkPictures = useCallback(async () => {
    if (!idToken || consoleStatus !== 'ready') return;
    if (siteRunsGo2rtc) {
      // Nothing to learn here: the answer would be a placeholder for every
      // camera. Health falls back to presence, which these sites do report.
      setPictures({});
      return;
    }
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
  }, [idToken, getToken, consoleStatus, siteRunsGo2rtc]);

  /**
   * Drop the previous centre's figures the instant the centre changes.
   *
   * Clearing on the way in rather than waiting for the next response to
   * overwrite: the request takes a moment, and for that moment the numbers on
   * screen belong to the workspace that was open before.
   */
  useEffect(() => {
    setAttendance(null);
    setAlerts([]);
    setActiveCount(0);
    setUnavailable([]);
    presenceRef.current = {};
    setPresence({});
    setPictures({});
  }, [orgId]);

  // Open, centre change, or a site change: always.
  useEffect(() => {
    void refresh();
  }, [refresh, orgId]);

  /**
   * Socket events, throttled. Without this a busy site refetches everything
   * several times a minute and leaves no room for the screen someone opened.
   */
  const lastEventRefresh = useRef(0);
  const lastAlertRefresh = useRef(0);

  // The cheap half, on a short leash: an alert or an event means the count on
  // screen may already be wrong, and that is the number people are watching.
  useEffect(() => {
    if (!live.revision) return;
    const now = Date.now();
    if (now - lastAlertRefresh.current < ALERT_THROTTLE_MS) return;
    lastAlertRefresh.current = now;
    void refreshAlerts();
  }, [live.revision, refreshAlerts]);

  // The expensive half, unchanged: presence for every camera and the attendance
  // board, which no single detection makes stale enough to be worth re-reading.
  useEffect(() => {
    if (!live.revision) return;
    const now = Date.now();
    if (now - lastEventRefresh.current < EVENT_THROTTLE_MS) return;
    lastEventRefresh.current = now;
    void refresh();
  }, [live.revision, refresh]);

  /**
   * A person arriving or leaving moves the attendance figures on Home, and those
   * come from the full refresh. Its own signal, so a crossing updates the counts
   * without waiting for whatever else happens to be on the slow clock.
   */
  useEffect(() => {
    if (!live.peopleRevision) return;
    const now = Date.now();
    if (now - lastEventRefresh.current < EVENT_THROTTLE_MS) return;
    lastEventRefresh.current = now;
    void refresh();
  }, [live.peopleRevision, refresh]);

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
