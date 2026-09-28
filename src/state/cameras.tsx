import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cloudApi } from '@/api/cloud';
import { Camera } from '@/api/types';
import { cacheKey, readCache, writeCache } from '@/lib/cache';
import { errorMessage } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useConsole } from '@/state/console';

/**
 * The camera list, once, for every screen that needs it.
 *
 * Home, Live, Areas and onboarding each used to fetch this themselves, so a
 * cold start asked for the same list three times and every one of them opened
 * on a skeleton. This holds it in one place and, more importantly, serves the
 * last known list from disk on the very first render. An operator starting a
 * shift sees their cameras immediately and the network answer replaces them a
 * moment later, rather than watching placeholders while the site wifi decides.
 *
 * The cached list is also what the app falls back to when the network is gone,
 * which is the difference between a degraded screen and an empty one.
 */

/** How long a freshly fetched list is treated as current when a screen refocuses. */
const FRESH_FOR_MS = 20000;

type Status = 'loading' | 'ready' | 'error';

type CamerasValue = {
  cameras: Camera[];
  status: Status;
  error: string | null;
  /** When the list on screen was fetched, or null when it is fresh from the network. */
  cachedAt: number | null;
  /** True while a refresh is in flight behind content that is already showing. */
  refreshing: boolean;
  refresh: () => Promise<void>;
  /**
   * Refresh only if what is on screen has had time to go out of date. Screens
   * call this when they come back into focus: a camera added in onboarding has
   * to appear, but flicking between two tabs should not re-ask every time.
   */
  refreshIfStale: () => void;
  /** The camera the person was last looking at, restored across launches. */
  selectedId: string | null;
  selected: Camera | null;
  select: (cameraId: string) => void;
};

const CamerasContext = createContext<CamerasValue | null>(null);

export function CamerasProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, idToken } = useAuth();
  const { orgId, status: consoleStatus, error: consoleError } = useConsole();

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Guards a slow response for the previous org from landing on the new one.
  const generation = useRef(0);
  // When the list on screen was last accepted from the network.
  const fetchedAt = useRef(0);

  // Serve whatever this device already knows before asking anyone.
  useEffect(() => {
    let live = true;
    if (authStatus !== 'signedIn') return;
    (async () => {
      const [list, last] = await Promise.all([
        readCache<Camera[]>(cacheKey.cameras(orgId)),
        readCache<string>(cacheKey.lastCamera(orgId)),
      ]);
      if (!live) return;
      if (list && list.data.length) {
        setCameras(list.data);
        setCachedAt(list.at);
        setStatus('ready');
      }
      if (last) setSelectedId(last.data);
    })();
    return () => {
      live = false;
    };
  }, [authStatus, orgId]);

  const refresh = useCallback(async () => {
    /**
     * Not until the console knows which organisation this is.
     *
     * `orgId` starts null, so firing as soon as a token existed sent the first
     * request with no X-Org-ID, against an org the server had to guess. It
     * failed often enough to paint a full screen error on launch, which the
     * retry a second later then replaced with the real list. Waiting costs
     * nothing: the cached list is already on screen by then.
     */
    if (authStatus !== 'signedIn' || !idToken || consoleStatus !== 'ready') return;
    const mine = ++generation.current;
    setRefreshing(true);
    try {
      const list = await cloudApi.listCameras(idToken);
      if (generation.current !== mine) return;
      setCameras(list);
      setCachedAt(null);
      setError(null);
      setStatus('ready');
      fetchedAt.current = Date.now();
      void writeCache(cacheKey.cameras(orgId), list);
    } catch (cause) {
      if (generation.current !== mine) return;
      setError(errorMessage(cause, "We couldn't load your cameras."));
      // Keep whatever is already on screen. A failed refresh is a reason to
      // say so, not a reason to take the cameras away.
      setStatus((current) => (current === 'ready' ? 'ready' : 'error'));
    } finally {
      if (generation.current === mine) setRefreshing(false);
    }
  }, [authStatus, idToken, orgId, consoleStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * The workspace never loaded, so the camera list never will either.
   *
   * `refresh` waits for the console to be ready before it asks for anything,
   * which is right — a request with no centre on it is answered against a guess.
   * But when the console ends in failure that wait has no end, and the screens
   * sat on skeletons indefinitely with nothing to read and nothing to tap. The
   * console has already said what went wrong; this passes it on so there is a
   * retry on screen instead of a spinner with no way out.
   */
  useEffect(() => {
    if (consoleStatus !== 'error') return;
    setError(consoleError ?? "We couldn't load your workspace.");
    setStatus((current) => (current === 'ready' ? 'ready' : 'error'));
  }, [consoleStatus, consoleError]);

  // Signing out must not leave the next account looking at these.
  useEffect(() => {
    if (authStatus === 'signedOut') {
      generation.current += 1;
      fetchedAt.current = 0;
      setCameras([]);
      setSelectedId(null);
      setCachedAt(null);
      setError(null);
      setStatus('loading');
    }
  }, [authStatus]);

  const refreshIfStale = useCallback(() => {
    if (Date.now() - fetchedAt.current < FRESH_FOR_MS) return;
    void refresh();
  }, [refresh]);

  const select = useCallback(
    (cameraId: string) => {
      setSelectedId(cameraId);
      void writeCache(cacheKey.lastCamera(orgId), cameraId);
    },
    [orgId],
  );

  const value = useMemo<CamerasValue>(() => {
    // A remembered camera that has since been removed must not leave the Live
    // screen blank; fall through to the first one the account still has.
    const selected = cameras.find((c) => c.camera_id === selectedId) ?? cameras[0] ?? null;
    return {
      cameras,
      status,
      error,
      cachedAt,
      refreshing,
      refresh,
      refreshIfStale,
      selectedId: selected?.camera_id ?? null,
      selected,
      select,
    };
  }, [cameras, status, error, cachedAt, refreshing, refresh, refreshIfStale, selectedId, select]);

  return <CamerasContext.Provider value={value}>{children}</CamerasContext.Provider>;
}

export function useCameras(): CamerasValue {
  const value = useContext(CamerasContext);
  if (!value) throw new Error('useCameras must be used inside CamerasProvider.');
  return value;
}
