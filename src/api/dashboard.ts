import { request } from './client';
import { DASHBOARD_URL, activeOrgId, consoleApi, headers } from './console';
import { RequestError } from './errors';
import type { LiveCamera } from '@/lib/cameraHealth';
import type {
  Alert,
  AlertsPage,
  AttendanceOverview,
  AttendanceRanking,
  AttendanceStats,
  Clip,
  FaceCluster,
  MiraCapabilities,
  MiraSession,
  MiraSessionDetail,
  PeopleIndex,
  Person,
  ReportPreview,
  ReportRun,
  ReportTemplates,
  UnknownFace,
  UnknownFaces,
  WorkspaceSettings,
} from './types';

/**
 * Attendance, reports, recordings, people and Mira — read from the ZeroForg dashboard's
 * own API, as the web console reads them.
 *
 * These used to be computed by the app's registry from the dashboard's tables. That was
 * a second implementation of every one of them, and it ran read-only, so nothing here
 * could ever be changed from the phone. Now each call is the dashboard's endpoint with
 * the phone's own Firebase token, scoped to the centre the person has open
 * (`X-Org-ID`, set by ConsoleProvider). A change on the dashboard reaches the app
 * without a second code path to update.
 *
 * Where the dashboard's shape differs from what the screens already render, the
 * difference is absorbed here, once, so the screens did not have to change. Each
 * adapter says what it maps and what it cannot.
 *
 * Nothing here reaches the registry any more. Mira's session history — once thought
 * to have no dashboard endpoint — lives at /agents/sessions, which the Mira router
 * itself delegates to.
 */

/** A day of events is a real aggregation; give it longer than a list read. */
/**
 * Reports and face clustering are genuinely slow server-side, so reads get more
 * than the transport default. Not thirty seconds though: that was long enough
 * that a failed call looked like a frozen screen rather than a failed call.
 */
const SLOW = 10000;

const q = (params: Record<string, string | number | null | undefined>) => {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
};

const get = <T>(path: string, token: string, timeoutMs = SLOW) =>
  request<T>(DASHBOARD_URL, path, { headers: headers(token), timeoutMs });

/**
 * The same GET, by path, for the shared cache's fetcher.
 *
 * `state/data.tsx` keys everything as `"<orgId>::<path>"` and resolves it
 * through this, which is how the web console is built too — one fetcher, keys
 * that carry their own org. Typed callers keep using `dashboardApi` below; this
 * exists so a screen can name a path and get caching, deduping and revalidation
 * without a bespoke hook per endpoint.
 */
export function dashboardGet<T>(path: string, token: string, orgId?: string | null): Promise<T> {
  return request<T>(DASHBOARD_URL, path, {
    headers: headers(token, orgId === undefined ? undefined : orgId),
    timeoutMs: SLOW,
  });
}

// ── Dashboard shapes this module adapts from ──────────────────────────────────

type DashPerson = {
  id: string;
  name: string | null;
  category: string | null;
  category_label?: string | null;
  group?: string | null;
  group_id?: string | null;
  startup?: string | null;
  home_site_id?: string | null;
};

type DashGalleryPerson = {
  id: string;
  thumb_url: string | null;
  created_at: string | null;
  photo_count?: number;
};

type DashPeople = {
  people: DashPerson[];
  groups: { id: string; name: string; kind: string | null; active: boolean; people?: number }[];
  categories?: { id: string; label: string }[];
};

type DashUnknown = {
  event_id: string;
  camera_id: string | null;
  occurred_at: string | null;
  photo_url: string | null;
};

type DashCluster = {
  id: string;
  label: string | null;
  status: string | null;
  face_count: number;
  camera_count: number;
  person_id: string | null;
  first_seen: string | null;
  last_seen: string | null;
  thumb: string | null;
};

type DashClip = {
  clip_id: string;
  camera_id: string;
  timestamp: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  event_type: string | null;
  event_id: string | null;
  url: string;
};

type DashRun = Omit<ReportRun, 'template_name' | 'downloadable'> & {
  has_html?: boolean;
  has_pdf?: boolean;
};

type DashMember = {
  uid: string | null;
  email: string | null;
  display_name: string | null;
  role: string;
  role_name?: string | null;
  status: string;
  joined_at: string | null;
  last_active: string | null;
};

type DashSite = {
  id: string;
  name: string;
  address: string | null;
  status: string | null;
  cameras: number;
};

type DashRule = {
  alert_type: string;
  enabled: boolean;
  severity: string | null;
  channels: string[];
  quiet_hours: unknown;
  camera_ids: string[];
  zone_types: string[];
  cooldown_seconds: number | null;
  updated_at: string | null;
};

type DashOrgConfig = {
  timezone: string | null;
  pack: string | null;
  site_hours: Record<string, unknown> | null;
  features: Record<string, boolean> | null;
  effective_features?: Record<string, boolean> | null;
  attendance: Record<string, unknown> | null;
  created_at: string | null;
};

type DashCapability = { key: string; enabled: boolean; state?: string | null };

type DashSession = {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  updatedAt: string | null;
};

type DashSessionDetail = {
  session_id: string;
  messages: { role: string; content: string | null; timestamp: string | null }[];
  created_at: string | null;
  updated_at: string | null;
};

// ── Adapters ─────────────────────────────────────────────────────────────────

const titleCase = (key: string) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * Something an <Image> can show, from whatever the dashboard sends: a signed GCS URL
 * (persons), a path on the dashboard (edge photos), or a raw base64 JPEG held in the
 * row (cluster thumbs). Screens get one shape and never guess.
 */
function photoUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;
  if (raw.startsWith('/')) return `${DASHBOARD_URL.replace(/\/api\/v1\/?$/, '')}${raw}`;
  return `data:image/jpeg;base64,${raw}`;
}

function person(row: DashPerson, gallery: Map<string, DashGalleryPerson>): Person {
  const enrolled = gallery.get(row.id);
  return {
    id: row.id,
    name: row.name ?? null,
    category: row.category ?? null,
    startup_name: row.startup ?? null,
    group: row.group ?? null,
    // The directory carries no photo; the face gallery does, per enrolled person.
    photo: photoUri(enrolled?.thumb_url),
    enrolled_at: enrolled?.created_at ?? null,
  };
}

function unknownFace(row: DashUnknown): UnknownFace {
  return {
    id: row.event_id,
    cluster_id: null,
    camera: row.camera_id ?? null,
    seen_at: row.occurred_at ?? null,
    status: 'active',
    outlier_score: null,
    photo: photoUri(row.photo_url),
  };
}

function cluster(row: DashCluster): FaceCluster {
  return {
    id: row.id,
    label: row.label ?? null,
    status: row.status ?? null,
    faces: row.face_count ?? 0,
    cameras: row.camera_count ?? 0,
    person_id: row.person_id ?? null,
    first_seen: row.first_seen ?? null,
    last_seen: row.last_seen ?? null,
    seen_on: [],
    photo: photoUri(row.thumb),
  };
}

function clip(row: DashClip, cameraNames: Record<string, string>): Clip {
  return {
    id: row.clip_id,
    clip_id: row.clip_id,
    camera_id: row.camera_id,
    camera_name: cameraNames[row.camera_id] ?? row.camera_id,
    event_id: row.event_id ?? null,
    event_type: row.event_type ?? null,
    started_at: row.timestamp ?? null,
    duration_seconds: row.duration_seconds ?? null,
    size_bytes: row.file_size_bytes ?? null,
    status: null,
    description: null,
    // The dashboard resolves a playable URL (signed GCS or its own /clips/stream).
    // The registry never could — this is the first time a phone can play one.
    url: row.url ?? null,
    playable: Boolean(row.url),
  };
}

function run(row: DashRun, names: Record<string, string>): ReportRun {
  return {
    ...row,
    template_name: names[row.template_id] ?? titleCase(row.template_id),
    downloadable: Boolean(row.has_pdf || row.has_html),
  };
}

export const dashboardApi = {
  // ── Attendance ─────────────────────────────────────────────────────────
  // The dashboard's payload is a superset of the app's (it adds a centre `scope`
  // and `local_*` variants); the one field it lacks, `active_hours`, is filled from
  // org config by the screen that shows it.
  attendanceOverview: (idToken: string, date?: string | null) =>
    get<AttendanceOverview>(`/attendance/overview${q({ date })}`, idToken),

  attendanceStats: (idToken: string, days = 30) =>
    get<AttendanceStats>(`/attendance/stats${q({ days })}`, idToken),

  attendanceRanking: (idToken: string, days = 7) =>
    get<AttendanceRanking[]>(`/attendance/ranking${q({ days })}`, idToken),

  // ── Reports ────────────────────────────────────────────────────────────
  reportTemplates: (idToken: string) => get<ReportTemplates>('/reports/templates', idToken),

  reportRuns: async (idToken: string, limit = 50) => {
    const [runs, templates] = await Promise.all([
      get<{ runs: DashRun[] }>(`/reports/runs${q({ limit })}`, idToken),
      get<ReportTemplates>('/reports/templates', idToken).catch(() => null),
    ]);
    const names = Object.fromEntries((templates?.templates ?? []).map((t) => [t.id, t.name]));
    return { runs: runs.runs.map((r) => run(r, names)) };
  },

  /** A report rendered for a day. Nothing is stored or sent by asking. */
  reportPreview: (idToken: string, templateId: string, date?: string | null) =>
    get<ReportPreview>(`/reports/${templateId}/preview${q({ date })}`, idToken, 90000),

  /** The HTML of a finished run, as it was sent. */
  reportRun: (idToken: string, runId: string) =>
    get<ReportRun & { html: string | null }>(`/reports/runs/${runId}/html`, idToken, 90000),

  // ── Recordings ─────────────────────────────────────────────────────────
  recordings: async (idToken: string, limit = 50) => {
    const [clips, manifest] = await Promise.all([
      get<DashClip[]>(`/clips/${q({ limit })}`, idToken),
      consoleApi.manifest(idToken, activeOrgId()).catch(() => null),
    ]);
    const names = Object.fromEntries((manifest?.cameras ?? []).map((c) => [c.id, c.name]));
    return clips.map((c) => clip(c, names));
  },

  // ── Mira ───────────────────────────────────────────────────────────────
  /** Whether this login may ask Mira here: the `mira.use` permission, per organisation. */
  miraCapabilities: async (idToken: string): Promise<MiraCapabilities> => {
    const manifest = await consoleApi.manifest(idToken, activeOrgId());
    const allowed = (manifest.user.permissions ?? []).includes('mira.use');
    return {
      can_ask: allowed,
      can_read_history: allowed,
      reason: allowed ? '' : "Your role doesn't include Mira in this organisation.",
    };
  },

  // ── People and faces ───────────────────────────────────────────────────
  people: async (idToken: string): Promise<PeopleIndex> => {
    const [body, enrolled] = await Promise.all([
      get<DashPeople>('/console/people', idToken),
      // Photos and enrolment dates live with the faces, not the directory. Optional:
      // a workspace without face enrolment still lists its people.
      get<DashGalleryPerson[]>('/face-gallery/persons', idToken).catch(() => [] as DashGalleryPerson[]),
    ]);
    const gallery = new Map(enrolled.map((g) => [g.id, g]));
    const people = body.people.map((row) => person(row, gallery));
    const by_category: Record<string, number> = {};
    for (const p of people) {
      const key = p.category ?? 'other';
      by_category[key] = (by_category[key] ?? 0) + 1;
    }
    return {
      total: people.length,
      by_category,
      groups: body.groups.map((g) => ({
        id: g.id,
        name: g.name,
        kind: g.kind ?? null,
        active: Boolean(g.active),
        members: g.people ?? 0,
      })),
      people,
    };
  },

  unknownFaces: async (idToken: string, limit = 60, offset = 0): Promise<UnknownFaces> => {
    const rows = await get<DashUnknown[]>(`/face-gallery/unknown${q({ limit, offset })}`, idToken);
    const faces = rows.map(unknownFace);
    // The gallery returns a page, not a count. `total` is what this page proves exists.
    return { total: offset + faces.length, offset, limit, by_status: { active: faces.length }, faces };
  },

  faceClusters: async (idToken: string, limit = 50) => {
    const rows = await get<DashCluster[]>(`/face-clusters${q({ limit })}`, idToken);
    return rows.map(cluster);
  },

  // ── Workspace settings ─────────────────────────────────────────────────
  /**
   * The workspace as the dashboard has it, composed from the endpoints the web
   * console's Organization pages use. Each part that this login may not read (team
   * needs `org.view`, rules need `alerts.rules`) simply comes back empty rather than
   * failing the whole screen.
   */
  settings: async (idToken: string): Promise<WorkspaceSettings> => {
    const manifest = await consoleApi.manifest(idToken, activeOrgId());
    const quiet = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    const [config, members, sites, rules] = await Promise.all([
      quiet(get<DashOrgConfig>('/org-config/', idToken), null),
      quiet(get<DashMember[]>('/realm/members', idToken), []),
      quiet(get<DashSite[]>('/realm/sites', idToken), []),
      quiet(get<{ rules: DashRule[] }>('/alert-rules', idToken), { rules: [] }),
    ]);
    const perms = manifest.user.permissions ?? [];
    const canWrite = perms.some((p) => p.endsWith('.manage') || p === 'org.configure');
    const capabilities = ((manifest as { capabilities?: DashCapability[] }).capabilities ?? []).map(
      (c) => ({ key: c.key, enabled: c.enabled, state: c.state ?? null }),
    );
    return {
      workspace: {
        id: manifest.org.id,
        name: manifest.org.name,
        slug: manifest.org.slug,
        type: manifest.org.type ?? 'tenant',
        status: 'active',
        created_at: config?.created_at ?? null,
      },
      preferences: {
        timezone: config?.timezone ?? manifest.org.timezone ?? null,
        pack: config?.pack ?? null,
        site_hours: config?.site_hours ?? {},
        features: config?.effective_features ?? config?.features ?? {},
        attendance: config?.attendance ?? {},
      },
      capabilities,
      cameras: (manifest.cameras ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        enabled: true,
        status: c.status ?? 'offline',
        site_id: c.site_id ?? null,
        detection_mode: '',
        zones: c.zones ?? 0,
        capabilities: [],
      })),
      sites: sites.map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address ?? null,
        status: s.status ?? null,
        cameras: s.cameras ?? 0,
      })),
      team: members.map((m) => ({
        user_id: m.uid ?? null,
        email: m.email ?? null,
        name: m.display_name ?? null,
        role: m.role_name ?? m.role,
        status: m.status,
        joined_at: m.joined_at ?? null,
        last_active: m.last_active ?? null,
      })),
      alert_rules: rules.rules.map((r) => ({
        id: r.alert_type,
        alert_type: r.alert_type,
        enabled: Boolean(r.enabled),
        severity: r.severity ?? null,
        channels: r.channels ?? [],
        quiet_hours: r.quiet_hours ?? null,
        cameras: (r.camera_ids ?? []).length,
        zone_types: r.zone_types ?? [],
        cooldown_seconds: r.cooldown_seconds ?? null,
        updated_at: r.updated_at ?? null,
      })),
      // Recipients live inside each rule's channels on the dashboard; there is no
      // separate list to show.
      notifications: [],
      access: {
        read_only: !canWrite,
        role: manifest.user.role,
        reason: canWrite ? null : 'Your role in this organisation is view-only.',
      },
    };
  },

  // ── Alerts ─────────────────────────────────────────────────────────────
  // `status` is the dashboard's: active (open and recent), acknowledged, or history.
  // `siteId` narrows to one location inside the centre; it is a filter, not identity.
  alerts: (idToken: string, status: 'active' | 'acknowledged' | 'history' = 'active', opts: { siteId?: string | null; cursor?: string | null; limit?: number } = {}) =>
    get<AlertsPage>(`/alerts${q({ status, site_id: opts.siteId, cursor: opts.cursor, limit: opts.limit ?? 50 })}`, idToken),

  /** Needs `alerts.acknowledge`; the server refuses a viewer. Idempotent. */
  acknowledgeAlert: (idToken: string, alertId: string) =>
    request<{ success: boolean; alert: Alert; already?: boolean }>(DASHBOARD_URL, `/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: headers(idToken),
    }),

  // ── Live video ─────────────────────────────────────────────────────────
  // Exactly the two ways the web's Live wall plays a camera, both served by the
  // dashboard itself — no LAN, no relay on the phone:
  //
  //   frameUrl  GET /vms/cameras/{id}/stream — the newest annotated JPEG (edge-pushed,
  //             detections burned in). Every tenant has this; the wall polls it at
  //             manifest.live.frame_interval_ms. Needs the bearer and X-Org-ID as
  //             headers, which a native <Image> can send.
  //
  //   liveUrl   GET /vms/cameras/{id}/live-url — where the site box runs go2rtc
  //             (manifest.live.go2rtc), a short-lived signed MJPEG URL plus a matching
  //             single-frame URL. 409 everywhere else; callers fall back to frames.

  /**
   * Absolute URL of the camera's newest JPEG; cache-busted so each poll is a new fetch.
   *
   * The token rides on the URL because a native image loader cannot be relied on to
   * send `source.headers`, and this endpoint answers an unauthenticated request with
   * 200 and an SVG placeholder rather than a 401 — so a dropped header looks exactly
   * like a camera with no picture. The web console's camera player does the same.
   */
  frameUrl: (cameraId: string, idToken?: string | null) =>
    `${DASHBOARD_URL}/vms/cameras/${cameraId}/stream?t=${Date.now()}` +
    (idToken ? `&token=${encodeURIComponent(idToken)}` : ''),

  /**
   * Per-camera health, from presence rather than the stale `cameras.status`
   * column. `live.view` gated, same as the Live wall. See lib/cameraHealth.
   */
  liveCameras: (idToken: string) =>
    request<{ cameras: LiveCamera[] }>(DASHBOARD_URL, '/console/live/cameras', {
      headers: headers(idToken),
    }).then((body) => body.cameras ?? []),

  /** Headers a native image loader should send for `frameUrl`, where it honours them. */
  frameHeaders: (idToken: string) => headers(idToken),

  /** Signed MJPEG + frame URLs, or null when this site has no go2rtc. */
  liveUrl: async (idToken: string, cameraId: string): Promise<{ url: string; frame: string } | null> => {
    try {
      const body = await request<{ url: string; frame: string }>(
        DASHBOARD_URL,
        `/vms/cameras/${cameraId}/live-url`,
        { headers: headers(idToken) },
      );
      // The dashboard answers with paths under /api/v1; make them absolute on its host.
      const host = DASHBOARD_URL.replace(/\/api\/v1\/?$/, '');
      return { url: `${host}${body.url}`, frame: `${host}${body.frame}` };
    } catch (cause) {
      if (cause instanceof RequestError && (cause.code === 'NOT_ENABLED' || cause.code === 'HTTP_ERROR')) return null;
      throw cause;
    }
  },

  // ── Mira session history ───────────────────────────────────────────────
  // /agents/sessions is the dashboard's own store of Mira conversations (the Mira
  // router delegates to it). Scoped to this login and the open centre by the server.
  miraSessions: async (idToken: string, limit = 20): Promise<MiraSession[]> => {
    const rows = await get<DashSession[]>(`/agents/sessions${q({ limit })}`, idToken);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      user_id: null,
      messages: r.messageCount ?? 0,
      created_at: null,
      updated_at: r.updatedAt ?? null,
    }));
  },

  miraSession: async (idToken: string, sessionId: string): Promise<MiraSessionDetail> => {
    const body = await get<DashSessionDetail>(`/agents/sessions/${sessionId}`, idToken);
    const first = body.messages.find((m) => m.role === 'user')?.content ?? '';
    return {
      id: body.session_id,
      title: first.slice(0, 50) || 'Conversation',
      user_id: null,
      messages: body.messages.length,
      created_at: body.created_at ?? null,
      updated_at: body.updated_at ?? null,
      messages_list: body.messages.map((m, i) => ({
        id: `${body.session_id}-${i}`,
        role: m.role,
        content: m.content ?? null,
        created_at: m.timestamp ?? null,
      })),
    };
  },
};

/**
 * True when the dashboard refused because this workspace does not have the feature —
 * not because anything went wrong. The attendance board, for one, is switched on per
 * organization. Screens show this as an explanation, not an error.
 */
export const isNotEnabled = (cause: unknown) =>
  cause instanceof RequestError && cause.code === 'NOT_ENABLED';
