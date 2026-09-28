import type { CameraEvent, LiveFlowEvent } from '@/state/live';

/**
 * The two live streams, merged into one readable list.
 *
 * `recentEvents` and `flowEvents` have been arriving on the socket since the
 * live connection was built and no screen has ever read them. Between them they
 * are a running account of what the cameras are seeing — the only genuinely new
 * information the app has between one look and the next.
 */

export type ActivityItem = {
  id: string;
  /** "Person crossed Gate 2" — already written for a person to read. */
  text: string;
  /** "in" / "out", where the event has a direction. */
  detail: string | null;
  at: number;
  cameraId: string;
};

/** Edge event names, said the way someone would say them. */
const EVENT_TEXT: Record<string, string> = {
  line_cross: 'Someone crossed a line',
  flow_crossing: 'Someone crossed a line',
  gate_crossing: 'Movement at the gate',
  unknown_person: 'Unrecognised person',
  face_attendance: 'Someone checked in',
  intrusion: 'Someone entered a restricted area',
  person_in_restricted_zone: 'Someone entered a restricted area',
  truck_arrival: 'A vehicle arrived',
  truck_departure: 'A vehicle left',
  ppe_detection: 'Safety gear checked',
  fire: 'Fire or smoke seen',
  smoke: 'Fire or smoke seen',
};

/** Unmapped types still read better than a raw key. */
function say(eventType: string): string {
  const mapped = EVENT_TEXT[eventType?.toLowerCase?.() ?? ''];
  if (mapped) return mapped;
  return (eventType || 'Something happened').replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

const when = (iso: string | null | undefined, fallback: number): number => {
  const at = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(at) ? at : fallback;
};

export function toActivity(
  events: CameraEvent[],
  flows: LiveFlowEvent[],
  cameraName: (id: string) => string,
  limit = 12,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  events.forEach((e, i) => {
    const at = when(e.timestamp, Date.now());
    const where = cameraName(e.camera_id);
    items.push({
      id: `e${e.camera_id}-${at}-${i}`,
      text: `${say(e.event_type)}${where ? ` · ${where}` : ''}`,
      detail: e.direction ?? null,
      at,
      cameraId: e.camera_id,
    });
  });

  flows.forEach((f) => {
    const at = when(f.timestamp, f.received_at);
    // A zone name is more use than the camera's, where the edge sent one.
    const where = f.zone_name || cameraName(f.camera_id);
    items.push({
      id: `f${f.id}`,
      text: `${say(f.event_type)}${where ? ` · ${where}` : ''}`,
      detail: f.direction ?? f.class_name ?? null,
      at,
      cameraId: f.camera_id,
    });
  });

  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** "just now", "4 min ago" — short enough to sit at the end of a row. */
export function shortAgo(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}
