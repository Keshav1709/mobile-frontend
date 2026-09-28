import * as SecureStore from 'expo-secure-store';
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

import {
  ConsoleManifest,
  ManifestSite,
  RealmOrg,
  consoleApi,
  fetchManifest,
  forgetManifest,
  setActiveOrgId,
} from '@/api/console';
import { hasPermission } from '@/lib/access';
import { errorMessage } from '@/lib/helpers';
import { useAuth } from '@/state/auth';

/**
 * Which organisation this login is looking at, and what it may do there.
 *
 * The whole multi-tenant picture comes from the dashboard, never from app state:
 *
 *   - `organizations` is GET /realm — the orgs this login may open, membership-filtered
 *     by the server (direct memberships plus anything inherited from a group above).
 *     The switcher exists only when there is more than one. That, and nothing in the
 *     app, is what stops someone reaching a centre they were not given.
 *
 *   - `manifest` is GET /console/manifest for the selected org — its sites, and this
 *     login's effective permissions in THAT org. Permissions are per-organisation: a
 *     member in one centre may be an admin in another, so everything here is re-read on
 *     a switch and nothing is cached across orgs.
 *
 * A site is a location inside one centre. It narrows what a screen asks for; it is
 * never identity, and it is only ever sent as a query parameter.
 */

const ORG_KEY = 'zeroforg.org_id';
const SITE_PREFIX = 'zeroforg.site.';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type ConsoleValue = {
  status: Status;
  error: string | null;
  manifest: ConsoleManifest | null;
  /** Orgs this login may open — tenants only; a group holds no cameras of its own. */
  organizations: RealmOrg[];
  orgId: string | null;
  orgName: string | null;
  /** True only when the server says this login may open more than one centre. */
  canSwitchOrg: boolean;
  sites: ManifestSite[];
  siteId: string | null;
  /** True only when the selected org actually has more than one site. */
  canSwitchSite: boolean;
  /** `can("alerts.acknowledge")` — the one permission check screens should use. */
  can: (permission: string) => boolean;
  /** Set when this login is limited to one people group or one person. */
  scoped: boolean;
  selectOrg: (orgId: string) => Promise<void>;
  selectSite: (siteId: string | null) => void;
  reload: () => Promise<void>;
};

const ConsoleContext = createContext<ConsoleValue | null>(null);

async function readStored(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  const done = value ? SecureStore.setItemAsync(key, value) : SecureStore.deleteItemAsync(key);
  done.catch(() => undefined);
}

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, getToken } = useAuth();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ConsoleManifest | null>(null);
  const [organizations, setOrganizations] = useState<RealmOrg[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);

  // Guards an out-of-order response from overwriting a newer one: switching org twice
  // quickly must not land on the first switch's manifest.
  const generation = useRef(0);

  const loadManifest = useCallback(
    async (token: string, wanted: string | null, force: boolean) => {
      const mine = ++generation.current;
      const { manifest: next, denied } = await fetchManifest(token, wanted, { force });
      if (generation.current !== mine) return null;

      setManifest(next);
      setOrgId(next.org.id);
      setActiveOrgId(next.org.id);
      writeStored(ORG_KEY, next.org.id);

      // The site choice belongs to the org it was made in, and may not exist in the
      // one we just landed on.
      const stored = await readStored(SITE_PREFIX + next.org.id);
      const valid = stored && next.sites.some((s) => s.id === stored) ? stored : null;
      if (generation.current !== mine) return null;
      setSiteId(valid);

      return denied ? next : null;
    },
    [],
  );

  /**
   * @param force Always ask the server, rather than reusing the manifest the
   *   sign-in path just fetched. True for anything the person asked for.
   */
  const load = useCallback(async (force = false) => {
    const token = await getToken();
    if (!token) {
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      // Tenants only. A group organisation owns no cameras, people or alerts — opening
      // one on a phone would show a set of empty screens.
      const reachable = (await consoleApi.realm(token)).filter((o) => (o.type ?? 'tenant') !== 'group');
      setOrganizations(reachable);

      const stored = await readStored(ORG_KEY);
      const wanted =
        stored && reachable.some((o) => (o.orgId ?? o.id) === stored)
          ? stored
          : (reachable[0]?.orgId ?? reachable[0]?.id ?? null);

      await loadManifest(token, wanted, force);
      setStatus('ready');
    } catch (cause) {
      setError(errorMessage(cause, "We couldn't load your workspace."));
      setStatus('error');
    }
  }, [getToken, loadManifest]);

  useEffect(() => {
    if (authStatus === 'signedIn') void load();
    if (authStatus === 'signedOut') {
      generation.current += 1;
      forgetManifest();
      setActiveOrgId(null);
      setManifest(null);
      setOrganizations([]);
      setOrgId(null);
      setSiteId(null);
      setStatus('idle');
      setError(null);
    }
  }, [authStatus, load]);

  const selectOrg = useCallback(
    async (next: string) => {
      const token = await getToken();
      if (!token) return;
      setStatus('loading');
      setError(null);
      try {
        const refused = await loadManifest(token, next, true);
        if (refused) {
          // The server answered 200 with a different organisation rather than an error.
          // Say so: silently showing another centre's data under the name the person
          // tapped is the one outcome worse than a refusal.
          const name = organizations.find((o) => (o.orgId ?? o.id) === next)?.name ?? 'that site';
          setError(`You no longer have access to ${name}. Showing ${refused.org.name} instead.`);
          void load(true);
          return;
        }
        setStatus('ready');
      } catch (cause) {
        setError(errorMessage(cause, "We couldn't switch to that site."));
        setStatus('error');
      }
    },
    [getToken, loadManifest, organizations, load],
  );

  const selectSite = useCallback(
    (next: string | null) => {
      setSiteId(next);
      if (orgId) writeStored(SITE_PREFIX + orgId, next);
    },
    [orgId],
  );

  const value = useMemo<ConsoleValue>(() => {
    const sites = manifest?.sites ?? [];
    return {
      status,
      error,
      manifest,
      organizations,
      orgId,
      orgName: manifest?.org.name ?? null,
      canSwitchOrg: organizations.length > 1,
      sites,
      siteId,
      canSwitchSite: sites.length > 1,
      can: (permission: string) => hasPermission(manifest?.user, permission),
      scoped: Boolean(manifest?.user?.scope),
      selectOrg,
      selectSite,
      reload: () => load(true),
    };
  }, [status, error, manifest, organizations, orgId, siteId, selectOrg, selectSite, load]);

  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole(): ConsoleValue {
  const value = useContext(ConsoleContext);
  if (!value) throw new Error('useConsole must be used inside ConsoleProvider.');
  return value;
}
