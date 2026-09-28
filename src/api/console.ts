/**
 * The ZeroForg dashboard's own API (`zeroforge-backend`, /api/v1).
 *
 * The app and the dashboard share one Firebase project, so the token the phone already
 * holds is accepted here as-is — there is no second sign-in and no second session.
 *
 * Two endpoints carry the whole multi-tenant picture, and they answer different
 * questions. Confusing them is the trap this module exists to prevent:
 *
 *   GET /realm            — the organisations this login MAY OPEN. Membership-filtered
 *                           (org_members + owned orgs), including membership inherited
 *                           from a group. This is what the centre switcher is built from.
 *
 *   GET /console/manifest — everything about ONE organisation: its sites, this login's
 *                           permissions, nav, capabilities, cameras. Its
 *                           `org.group.centres` is NOT access-filtered — it comes from
 *                           `federation.peer_orgs`, "every tenant under this org's root",
 *                           which is a data-sharing list (who shares CoE staff). It
 *                           lists all three NASSCOM centres to someone who is a member
 *                           of one. Never build a switcher from it.
 */

import { request } from './client';

/** Base already includes /api/v1. */
const DASHBOARD_URL = process.env.EXPO_PUBLIC_DASHBOARD_URL ?? 'https://dashboard.zeroforg.com/api/v1';

export const dashboardConfigured = Boolean(DASHBOARD_URL);

/** A day of aggregation is slower than a list read. */
const SLOW = 30000;

// The organisation every dashboard call is scoped to — set by ConsoleProvider once the
// manifest confirms which centre was actually opened. Same pattern as the web console's
// `lib/api/client.ts`: one place, read by every request, so screens never carry it.
let activeOrg: string | null = null;

export function setActiveOrgId(orgId: string | null): void {
  activeOrg = orgId;
}

export function activeOrgId(): string | null {
  return activeOrg;
}

/** Bearer plus X-Org-ID: the explicit org when given, else the active one. */
export function headers(token: string, orgId?: string | null): Record<string, string> {
  const org = orgId === undefined ? activeOrg : orgId;
  return {
    Authorization: `Bearer ${token}`,
    ...(org ? { 'X-Org-ID': org } : {}),
  };
}

export { DASHBOARD_URL };

// ── Types (mirror zeroforg-frontend/src/lib/console/manifest.ts) ──────────────

export interface OrgRef {
  id: string;
  name: string;
  slug: string;
  type?: 'group' | 'tenant';
  parent_id?: string | null;
}

/** A row of GET /realm — an organisation this login may open. */
export interface RealmOrg {
  id: string;
  orgId?: string;
  name: string;
  slug: string;
  role: string;
  type?: 'group' | 'tenant';
  parentId?: string | null;
  parent_id?: string | null;
}

export interface ManifestSite {
  id: string;
  name: string;
  is_default: boolean;
}

export interface ManifestUser {
  id: string;
  email: string;
  role: string;
  permissions?: string[] | null;
  grants?: Record<string, boolean> | null;
  /** Set when this login is limited to one people group or one person. */
  scope?: { group_id?: string; person_id?: string } | null;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  badge?: number | null;
}

export interface NavSection {
  section: 'MONITOR' | 'INSIGHTS' | 'ADMIN' | 'BOTTOM';
  items: NavItem[];
}

export interface ManifestCamera {
  id: string;
  name: string;
  status: string | null;
  location: string | null;
  zones: number;
  last_frame_at?: string | null;
  site_id?: string | null;
}

/**
 * One panel on Home, as the server composed it for this organisation.
 *
 * Home is not the same page everywhere and must not be built as though it were.
 * A footwear plant's is its loading bay — trucks today, time at the dock, what is
 * in the bay now; a CoE's is its people. The dashboard already decides this per
 * organisation from its capabilities and hands over the answer, so the app reads
 * the same list rather than keeping its own opinion that drifts.
 *
 * `kind` chooses the renderer; `id` also names the endpoint its numbers come
 * from (`/console/home/tiles/{id}/data`).
 */
export interface HomeTile {
  id: string;
  capability: string;
  kind: string;
  params: Record<string, unknown>;
  default_size: { w: number; h: number };
}

export interface ConsoleManifest {
  version: number;
  etag: string;
  org: {
    id: string;
    slug: string;
    name: string;
    timezone: string;
    type?: 'group' | 'tenant';
    parent?: OrgRef | null;
    /** Centres under this org when it IS a group. Empty for a tenant. */
    centres?: OrgRef[];
    /** Peer tenants sharing this org's root. NOT access-filtered — see the note above. */
    group?: { centres: OrgRef[] } | null;
    plan?: { tier: string; max_cameras: number; max_sites: number };
  };
  sites: ManifestSite[];
  user: ManifestUser;
  nav: NavSection[];
  enabled_keys: string[];
  /** The panels this organisation's Home is made of, in order. */
  home?: { tiles: HomeTile[]; available_tiles: HomeTile[] };
  alerts?: { types: unknown[]; active_count: number };
  live?: { layers: string[]; frame_interval_ms: number; go2rtc: boolean };
  cameras?: ManifestCamera[];
}

// ── Calls ─────────────────────────────────────────────────────────────────────

export const consoleApi = {
  /** The organisations this login may open. Membership-filtered by the server. */
  realm: (token: string) => request<RealmOrg[]>(DASHBOARD_URL, '/realm', { headers: headers(token) }),

  /**
   * One organisation's read model. `orgId` selects a centre via X-Org-ID.
   *
   * The server accepts that header only for an org the caller holds an active
   * membership in — and when it does not, it returns 200 with the caller's OWN org
   * rather than an error. Callers must compare `org.id` against what they asked for;
   * `fetchManifest` below does it for you.
   */
  manifest: (token: string, orgId?: string | null) =>
    request<ConsoleManifest>(DASHBOARD_URL, '/console/manifest', {
      headers: headers(token, orgId),
      timeoutMs: SLOW,
    }),
};

export type ManifestResult = {
  manifest: ConsoleManifest;
  /** True when a centre was requested and the server answered with a different one. */
  denied: boolean;
};

/**
 * The manifest is the slowest call the app makes, and launch used to make it twice.
 *
 * `AuthProvider` asks for one so a sign-in can complete even when the registry is
 * unreachable; `ConsoleProvider` then asks for the same organisation's manifest a
 * moment later, because it is the thing that decides which centre is open. Both are
 * needed, and both were paying the full round trip — against a tunnelled database
 * that is several seconds each, back to back, before the camera list is even
 * requested.
 *
 * So one in-flight request is shared, and its answer is reusable for a few seconds
 * after it lands. That is long enough to cover the gap between the two callers on a
 * cold start and short enough that nothing goes stale in a way anyone would notice.
 * Anything the person actually asked for — switching centre, pull to refresh — passes
 * `force` and always goes to the server.
 */
const MANIFEST_REUSE_MS = 10000;

let pending: { key: string; at: number; result: Promise<ManifestResult> } | null = null;

/** Drops any shared manifest. Called on sign-out so the next account starts clean. */
export function forgetManifest(): void {
  pending = null;
}

/**
 * The manifest, with the silent cross-org fallback made loud.
 *
 * Verified against production: asking for a centre you are not a member of returns
 * HTTP 200 carrying your own organisation instead. Nothing leaks — the server refuses
 * correctly — but it refuses without saying so, and a switcher that trusts the request
 * would show one centre's data under another centre's name.
 */
export async function fetchManifest(
  token: string,
  orgId?: string | null,
  { force = false }: { force?: boolean } = {},
): Promise<ManifestResult> {
  // Keyed on the centre asked for, never on the token: a refreshed token is the
  // same session and must not miss a manifest that is already on its way.
  const key = orgId ?? 'default';
  if (!force && pending && pending.key === key && Date.now() - pending.at < MANIFEST_REUSE_MS) {
    try {
      return await pending.result;
    } catch {
      // A shared failure is not cached: fall through and ask properly.
    }
  }

  const result = (async () => {
    const manifest = await consoleApi.manifest(token, orgId);
    const denied = Boolean(orgId) && manifest.org?.id !== orgId;
    return { manifest, denied };
  })();

  pending = { key, at: Date.now(), result };
  // A rejected promise nobody is awaiting yet is an unhandled rejection in
  // React Native; this keeps it attached without swallowing it for callers.
  result.catch(() => undefined);
  try {
    return await result;
  } catch (cause) {
    if (pending?.result === result) pending = null;
    throw cause;
  }

}
