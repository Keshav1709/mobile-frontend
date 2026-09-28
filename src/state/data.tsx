import { ReactNode, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import useSWR, { SWRConfig, useSWRConfig, type SWRConfiguration } from 'swr';

import { dashboardGet } from '@/api/dashboard';
import { readCache, writeCache } from '@/lib/cache';
import { useAuth } from '@/state/auth';
import { useConsole } from '@/state/console';
import { useLive } from '@/state/live';

/**
 * One cache for every screen's data, instead of one fetch per screen per visit.
 *
 * This is the pattern the web console already uses — `zeroforg-frontend`'s
 * ConsoleProvider wraps everything in SWR with a single fetcher and keys of
 * `"orgId::/path"` — and it is the reason that console feels immediate where
 * this app did not. Nine of the app's ten screens held their data in `useState`
 * and fetched it in `useEffect`, so every tap on a tab threw the last answer
 * away and paid for a fresh round trip behind a skeleton. Against a dashboard
 * several hundred milliseconds away, on a phone, that was the latency.
 *
 * Four properties do the work:
 *
 *   **Shared** — the cache is module-global, so leaving a screen and coming back
 *   paints from what is already there and revalidates behind it.
 *
 *   **Deduped** — two screens asking for the same key inside `dedupingInterval`
 *   make one request between them, not one each.
 *
 *   **Persistent** — it is written to disk and read back at launch, so a cold
 *   start opens on real content. `lib/cache.ts` already existed for this; it now
 *   backs every screen rather than only the camera list.
 *
 *   **Previous-data-preserving** — changing a date or a site swaps the numbers
 *   when the new ones land instead of blanking the screen first.
 *
 * Keys carry the organisation because data and permissions are per-organisation:
 * a response arriving after a centre switch has to land in the cache for the
 * centre it was asked for, never the one now on screen. `useOrgKey` builds them.
 */

/** How long the same key is served without asking again. */
const DEDUPE_MS = 4000;

/** Where the cache lives on disk, as one entry. */
const CACHE_KEY = 'swr';

/** Coalesces a burst of writes into one disk write. */
const FLUSH_DELAY_MS = 800;

/**
 * Keys never written to disk.
 *
 * Two reasons to leave something out: it is big enough that reading it back
 * costs more than re-fetching, or it is a snapshot whose staleness would
 * mislead. Frames are both — a saved JPEG of a doorway shown as the present is,
 * on a security product, worse than an empty panel.
 */
const NEVER_PERSIST = [/frame/i, /\/stream\b/, /\/preview\b/];

const persistable = (key: string) => !NEVER_PERSIST.some((pattern) => pattern.test(key));

type Entry = { data?: unknown; error?: unknown; isValidating?: boolean; isLoading?: boolean };

/**
 * The token, for the fetcher.
 *
 * The fetcher is not a hook and cannot call `useAuth`, so the provider pushes
 * the current getter here — the same shape `api/console.ts` uses for the active
 * org and `onvif/relay.ts` for the relay address.
 */
let tokenSource: (() => Promise<string | null>) | null = null;

/** Splits `"orgId::/path"` and fetches it as the signed-in user. */
async function globalFetcher(key: string): Promise<unknown> {
  const separator = key.indexOf('::');
  const path = separator >= 0 ? key.slice(separator + 2) : key;
  // The org baked into the key is the org the request is for. Sending it
  // explicitly, rather than reading the module default, keeps a response that
  // races an organisation switch out of the new organisation's cache.
  const orgId = separator >= 0 ? key.slice(0, separator) : '';
  const token = tokenSource ? await tokenSource() : null;
  if (!token) throw new Error('Not signed in.');
  return dashboardGet<unknown>(path, token, orgId && orgId !== 'self' ? orgId : undefined);
}

/**
 * A Map that writes itself to disk.
 *
 * Only `data` is saved. An error or an in-flight flag from a previous launch
 * describes a request that is already over, and restoring either would show
 * somebody a failure that is not happening.
 */
function createCache(): Map<string, Entry> {
  const map = new Map<string, Entry>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const out: Record<string, unknown> = {};
    for (const [key, value] of map) {
      if (value && value.data !== undefined && persistable(key)) out[key] = value.data;
    }
    void writeCache(CACHE_KEY, out);
  };

  const set = map.set.bind(map);
  map.set = (key: string, value: Entry) => {
    const result = set(key, value);
    if (!timer) timer = setTimeout(flush, FLUSH_DELAY_MS);
    return result;
  };
  return map;
}

// Created once for the life of the process, so the cache survives every
// navigation. Re-creating it per render would defeat the whole point.
const cache = createCache();

/**
 * Revalidation driven by the app coming back to the foreground.
 *
 * SWR's own focus tracking listens for browser events that React Native does
 * not have, so `revalidateOnFocus` would simply never fire. AppState is the
 * equivalent signal: someone returning to the app is exactly when the numbers
 * in front of them should be checked.
 */
function initFocus(callback: () => void): () => void {
  let previous: AppStateStatus = AppState.currentState;
  const subscription = AppState.addEventListener('change', (next) => {
    if (previous.match(/inactive|background/) && next === 'active') callback();
    previous = next;
  });
  return () => subscription.remove();
}

const config: SWRConfiguration = {
  fetcher: globalFetcher,
  provider: () => cache as never,
  initFocus,
  // On by default now that `initFocus` is a signal that actually exists here.
  revalidateOnFocus: true,
  // Don't re-ask for something fetched moments ago.
  dedupingInterval: DEDUPE_MS,
  focusThrottleInterval: 10000,
  keepPreviousData: true,
  // `api/client.ts` already retries transport failures under its own budget;
  // a second retry loop on top of that turns one slow call into a long one.
  errorRetryCount: 1,
  shouldRetryOnError: false,
};

export function DataProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={config}>
      <Hydrate>{children}</Hydrate>
    </SWRConfig>
  );
}

/**
 * What a live socket message invalidates.
 *
 * The socket already knows the moment something changes; it just had no way to
 * tell the screens. Polling is the alternative and it is a bad trade at both
 * ends: long enough to be cheap means figures that are minutes old, short enough
 * to feel live means every phone asking the dashboard for the same board every
 * second whether or not anything happened.
 *
 * So each signal re-reads only what it could have changed. A detection is not in
 * here at all — those arrive many times a second on a working site, and
 * refetching a board on each one would be slower than never caching.
 */
const INVALIDATES: { on: 'revision' | 'peopleRevision'; match: RegExp }[] = [
  // An alert or a camera event: the alert list and the event feed.
  { on: 'revision', match: /(^|::|\/)(alerts|events|clips)\b/ },
  // A person arrived, left, or a counter moved: the boards built on that.
  // Matched after the `orgId::` prefix as well as mid-path, because a key may be
  // a route (`/attendance/overview`) or a label for a composite (`people`).
  { on: 'peopleRevision', match: /(^|::|\/)(attendance|people|face-gallery|face-clusters)\b/ },
];

/**
 * Re-reads cached data when the live socket says it has changed.
 *
 * Mounted inside `DataProvider` so it shares the cache, and below `LiveProvider`
 * so it can watch it. Skips the first run of each revision: a freshly mounted
 * socket has not told us anything new yet, and refetching on connect would
 * double every request at launch.
 */
function LiveSync() {
  const { mutate } = useSWRConfig();
  const { revision, peopleRevision } = useLive();
  const seen = useRef<{ revision: number; peopleRevision: number } | null>(null);

  useEffect(() => {
    const now = { revision, peopleRevision };
    const before = seen.current;
    seen.current = now;
    if (!before) return;

    for (const rule of INVALIDATES) {
      if (now[rule.on] === before[rule.on]) continue;
      // Every key for this organisation whose path this signal could affect.
      void mutate((key) => typeof key === 'string' && rule.match.test(key));
    }
  }, [revision, peopleRevision, mutate]);

  return null;
}

/**
 * The live bridge, as its own export.
 *
 * Separate from `DataProvider` because it has to sit below `LiveProvider`, and
 * `LiveProvider` sits below the cache — mount this once, anywhere inside both.
 */
export function LiveCacheSync() {
  return <LiveSync />;
}

/**
 * Fills the cache from disk, and keeps the fetcher's token current.
 *
 * Hydration does not gate rendering. Reading a few kilobytes back is quick, but
 * holding the first frame on it would trade one blank moment for another; the
 * screens are built to show what they have and fill in, so the sequence is
 * render, hydrate, repaint. Writing straight into the cache would not notify
 * anything already mounted, so each entry is announced through `mutate`.
 */
function Hydrate({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();
  const { getToken, status } = useAuth();
  const [, setReady] = useState(false);
  const done = useRef(false);

  // Kept current rather than captured once: `getToken` refreshes an expiring
  // Firebase token, and the fetcher must always call the live one.
  useEffect(() => {
    tokenSource = getToken;
    return () => {
      if (tokenSource === getToken) tokenSource = null;
    };
  }, [getToken]);

  useEffect(() => {
    if (done.current || status !== 'signedIn') return;
    done.current = true;
    void (async () => {
      const saved = await readCache<Record<string, unknown>>(CACHE_KEY);
      if (!saved?.data) return setReady(true);
      await Promise.all(
        Object.entries(saved.data).map(([key, value]) =>
          // `revalidate: false` because every mounted hook will revalidate on
          // its own; asking here as well would double every request at launch.
          mutate(key, value, { revalidate: false }),
        ),
      );
      setReady(true);
    })();
  }, [status, mutate]);

  // A new account must not read the previous one's cache.
  useEffect(() => {
    if (status !== 'signedOut') return;
    cache.clear();
    done.current = false;
  }, [status]);

  return <>{children}</>;
}

/**
 * An org-scoped key for the shared fetcher: `"orgId::/path"`.
 *
 * Returns null — which tells SWR not to fetch at all — until the console knows
 * which organisation is open. A request sent before then carries no `X-Org-ID`
 * and is answered against whichever org the server guesses, which is how the
 * camera list used to paint an error on launch.
 */
export function useOrgKey(path: string | null): string | null {
  const { orgId } = useConsole();
  return orgId && path ? `${orgId}::${path}` : null;
}

/**
 * The same caching for a typed call that is not one path.
 *
 * Several of `dashboardApi`'s methods fan out — `people` reads three endpoints
 * and merges them, `settings` reads four and tolerates each failing — and that
 * merging is real logic worth keeping. So the key here is a label rather than a
 * route, and the typed method stays the fetcher. Everything else is identical:
 * shared across screens, deduped, persisted, previous data kept.
 *
 * ```ts
 * const { data } = useDashboardCall('people', (token) => dashboardApi.people(token));
 * ```
 *
 * Pass a key of null to hold off until a dependency exists.
 */
export function useDashboardCall<T>(
  key: string | null,
  load: (token: string) => Promise<T>,
  options?: SWRConfiguration,
) {
  const orgKey = useOrgKey(key);
  // Held in a ref so a closure rebuilt on every render does not look like a new
  // fetcher to SWR; the key is what decides when to re-ask.
  const loader = useRef(load);
  loader.current = load;

  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    orgKey,
    async () => {
      const token = tokenSource ? await tokenSource() : null;
      if (!token) throw new Error('Not signed in.');
      return loader.current(token);
    },
    options,
  );

  return {
    data,
    error: error as unknown,
    isLoading: isLoading && data === undefined,
    isValidating,
    refresh: () => mutate(),
    mutate,
  };
}

/**
 * The hook screens use: a dashboard path, cached and shared.
 *
 * ```ts
 * const { data, error, isLoading, refresh } = useDashboard<Board>('/attendance/overview');
 * ```
 *
 * `isLoading` is true only when there is nothing to show yet, so a screen that
 * has cached content renders it and never flashes a skeleton. Use `isValidating`
 * for the quieter "checking" indicator.
 */
export function useDashboard<T>(path: string | null, options?: SWRConfiguration) {
  const key = useOrgKey(path);
  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(key, options);
  return {
    data,
    error: error as unknown,
    /** Nothing cached and a request in flight. */
    isLoading: isLoading && data === undefined,
    /** A request in flight behind content that is already on screen. */
    isValidating,
    refresh: () => mutate(),
    mutate,
  };
}
