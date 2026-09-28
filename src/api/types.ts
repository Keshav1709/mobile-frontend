import type { ZonePolygon } from '@/lib/zones';

export type Camera = {
  camera_id: string;
  tenant_id: string;
  display_name: string;
  manufacturer: string | null;
  model: string | null;
  firmware: string | null;
  serial_number: string | null;
  ip: string | null;
  onvif_xaddr: string | null;
  selected_profile: string | null;
  /** Set when the stream is published to the relay; the go2rtc stream name. */
  stream_reference: string | null;
  resolution: string | null;
  connection_status: string;
  /** Areas outlined on this camera; see `lib/zones.ts`. */
  zones_json: ZonePolygon[];
  config_version: number;
  last_seen: string | null;
};

/** What the app writes to the registry after a successful connect. */
export type RegisterCamera = {
  camera_id: string;
  tenant_id: string;
  user_id?: string;
  display_name: string;
  manufacturer?: string | null;
  model?: string | null;
  firmware?: string | null;
  serial_number?: string | null;
  ip: string;
  onvif_xaddr?: string | null;
  selected_profile?: string | null;
  stream_reference?: string | null;
  resolution?: string | null;
  connection_status?: string;
};

export type UserProfile = {
  user_id: string;
  tenant_id: string;
  /** The workspace's name as the dashboard shows it — "Nasscom", not a uuid. */
  tenant_name: string | null;
  tenant_slug: string | null;
  /** Capability keys this workspace has switched on, e.g. `attendance_board`. */
  features: string[];
  email: string | null;
  phone_number: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  camera_type: string | null;
  auth_provider: string;
  created_at: string | null;
  profile_completed: boolean;
  onboarding_completed: boolean;
};

/** Fields the profile screen can write. Any subset is accepted. */
export type ProfileDraft = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  date_of_birth?: string;
  camera_type?: string;
};

/** A ZeroForg Box bound to the workspace. Tokens never reach the app. */
export type Device = {
  id: string;
  device_id: string;
  org_id: string;
  device_type: string;
  label: string;
  status: 'active' | 'disabled' | string;
  local_ip: string | null;
  agent_version: string | null;
  last_seen: string | null;
  created_at: string | null;
  /** The three connect-box checks, decided by the registry from heartbeats. */
  checks: { online: boolean; factory_network: boolean; cloud: boolean };
};


// ── Attendance, reports, recordings, Mira ───────────────────────────────
// Computed by the registry from the ZeroForg dashboard's own tables; the
// shapes match the dashboard's board field for field.

export type RosterEntry = {
  person: string;
  /** Enrolment stills live in Google Cloud Storage; the app shows initials. */
  photo: string | null;
  present: boolean;
  first_seen: string | null;
  last_seen: string | null;
  greeted: boolean;
};

export type ArrivalEntry = {
  person: string;
  photo: string | null;
  at: string;
  camera: string;
  on_time: boolean;
};

export type AttendanceOverview = {
  date: string;
  is_today: boolean;
  /** The workspace's working window, e.g. "08:00-20:00". */
  active_hours: string;
  present_now: number;
  facility_occupancy: number;
  people_in: number;
  people_out: number;
  enrolled_total: number;
  checked_in_today: number;
  /** People recognised at THIS centre today, where present_now counts the group. */
  checked_in_here: number;
  on_time_rate: number;
  avg_arrival: string | null;
  greetings_today: number;
  now_welcoming: { person: string; camera: string; at: string; photo: string | null } | null;
  roster: RosterEntry[];
  startup_attendance: { startup_name: string; employee_name: string; present: boolean }[];
  recent_arrivals: ArrivalEntry[];
  footfall_hourly: { hour: string; count: number }[];
  footfall_zones: { zone: string; hours: number[] }[];
  occupancy_hourly: { hour: string; in_count: number; out_count: number; occupancy: number }[];
};

export type AttendanceStats = {
  window_days: number;
  daily: { date: string; label: string; people: number }[];
  weekday: { weekday: string; avg_people: number; samples: number }[];
  avg_people: number;
  best_day: string | null;
  best_day_people: number;
};

export type AttendanceRanking = { person: string; hours: number; days_present: number };

export type ReportSchedule = {
  template_id: string;
  enabled: boolean;
  cron: string | null;
  cron_text: string | null;
  timezone: string | null;
  recipients: string[];
  last_fired_at: string | null;
};

export type ReportRun = {
  id: string;
  template_id: string;
  template_name: string;
  period_start: string | null;
  period_end: string | null;
  period_label: string | null;
  status: string;
  trigger: string | null;
  subject: string | null;
  size_bytes: number | null;
  error: string | null;
  created_at: string | null;
  finished_at: string | null;
  /** The rendered file lives on the dashboard's disk, not in the registry. */
  downloadable: boolean;
};

export type ReportTemplate = {
  id: string;
  name: string;
  period: string;
  family: string;
  renderable: boolean;
  capability: string;
  scope?: string;
  schedule: ReportSchedule | null;
  last_run: ReportRun | null;
};

export type ReportTemplates = { templates: ReportTemplate[]; scope: unknown };

/** A saved clip. `playable` is false when the registry has no URL for it. */
export type Clip = {
  id: string;
  clip_id: string | null;
  camera_id: string | null;
  camera_name: string | null;
  event_id: string | null;
  event_type: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  status: string | null;
  description: string | null;
  url: string | null;
  playable: boolean;
};

export type MiraCapabilities = { can_read_history: boolean; can_ask: boolean; reason: string };

export type MiraSession = {
  id: string;
  title: string;
  user_id: string | null;
  messages: number;
  created_at: string | null;
  updated_at: string | null;
};

export type MiraSessionDetail = MiraSession & {
  messages_list: { id: string; role: string; content: string | null; created_at: string | null }[];
};

// ── People, faces and workspace settings ────────────────────────────────

export type Person = {
  id: string;
  name: string | null;
  category: string | null;
  startup_name: string | null;
  group: string | null;
  /** Enrolment stills live in cloud storage; always null here. */
  photo: string | null;
  enrolled_at: string | null;
};

export type PeopleIndex = {
  total: number;
  by_category: Record<string, number>;
  groups: { id: string; name: string; kind: string | null; active: boolean; members: number }[];
  people: Person[];
};

/** `photo` is a base64 JPEG crop held in the row, so it can be rendered. */
export type UnknownFace = {
  id: string;
  cluster_id: string | null;
  camera: string | null;
  seen_at: string | null;
  status: string | null;
  outlier_score: number | null;
  photo: string | null;
};

export type UnknownFaces = {
  total: number;
  offset: number;
  limit: number;
  by_status: Record<string, number>;
  faces: UnknownFace[];
};

export type FaceCluster = {
  id: string;
  label: string | null;
  status: string | null;
  faces: number;
  cameras: number;
  person_id: string | null;
  first_seen: string | null;
  last_seen: string | null;
  seen_on: string[];
  photo: string | null;
};

export type WorkspaceSettings = {
  workspace: {
    id: string;
    name: string | null;
    slug: string | null;
    type: string | null;
    status: string | null;
    created_at: string | null;
  };
  preferences: {
    timezone: string | null;
    pack: string | null;
    site_hours: Record<string, unknown>;
    features: Record<string, boolean>;
    attendance: Record<string, unknown>;
  };
  capabilities: { key: string; enabled: boolean; state: string | null }[];
  cameras: {
    id: string;
    name: string;
    enabled: boolean;
    status: string;
    site_id: string | null;
    detection_mode: string;
    zones: number;
    capabilities: string[];
  }[];
  sites: {
    id: string;
    name: string;
    address: string | null;
    status: string | null;
    cameras: number;
  }[];
  team: {
    user_id: string | null;
    email: string | null;
    name: string | null;
    role: string;
    status: string;
    joined_at: string | null;
    last_active: string | null;
  }[];
  alert_rules: {
    id: string;
    alert_type: string;
    enabled: boolean;
    severity: string | null;
    channels: string[];
    quiet_hours: unknown;
    cameras: number;
    zone_types: string[];
    cooldown_seconds: number | null;
    updated_at: string | null;
  }[];
  notifications: {
    kind: string;
    target: string;
    reports: boolean;
    alerts: boolean;
    active: boolean;
  }[];
  access: { read_only: boolean; role: string; reason: string | null };
};

export type ReportPreview = {
  template_id: string;
  name: string;
  date: string | null;
  period_label: string | null;
  subject: string | null;
  /** The dashboard's own rendered HTML — shown in a WebView, not re-styled. */
  html: string | null;
};

/** One raised alert, as the dashboard's /alerts lists it. */
export type Alert = {
  id: string;
  alert_id: string;
  threat_type: string;
  label: string;
  severity: string | null;
  status: string;
  description: string | null;
  camera_id: string | null;
  location: string | null;
  site_id: string | null;
  created_at: string | null;
  resolved_at: string | null;
  acknowledged: boolean;
  /** Which centre raised it — set only when a group organisation lists several. */
  centre: { id: string; name: string } | null;
};

export type AlertsPage = {
  alerts: Alert[];
  count: number;
  active_count: number;
  next_cursor: string | null;
  unavailable_cameras: { id: string; name: string; location: string | null; last_frame_at: string | null }[];
};
