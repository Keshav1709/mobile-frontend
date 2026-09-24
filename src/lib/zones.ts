/**
 * Areas ("zones") outlined on a camera view.
 *
 * Types, colours and helpers ported from the dashboard (`types/devices.ts`,
 * `setup/ZoneCanvas.tsx`, `facility/ZoneEditorPanel.tsx`) so a polygon drawn
 * here is the same record the dashboard reads and the box runs against.
 * Points are normalised 0–1 in both axes.
 */

export type ThreatType =
  | 'inventory_theft'
  | 'forklift_collision'
  | 'unauthorized_access'
  | 'flying_objects'
  | 'violence';

export type ZoneType =
  | 'general'
  | 'gate'
  | 'dock'
  | 'rack'
  | 'pallet_station'
  | 'directional_counting';

export type Point = [number, number];

export interface ZonePolygon {
  id: string;
  name: string;
  label: string;
  physical_zone_label: string;
  points: Point[];
  threat_types: ThreatType[];
  zone_type: ZoneType;
  color: string;
  enabled: boolean;
  inside_action?: 'in' | 'out';
  classes?: string[];
  confirm_frames?: number;
  min_score?: number;
  cooldown_seconds?: number;
}

export const ZONE_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#F1948A',
] as const;

export const AREA_CHIP_OPTIONS = [
  'Entrance',
  'Exit',
  'Restricted Area',
  'Production Line',
  'Machine',
  'Warehouse',
  'Parking',
  'Loading Dock',
  'Lift Counter',
  'Office',
  'Storage',
  'Custom',
] as const;

export type AreaChip = (typeof AREA_CHIP_OPTIONS)[number];

/** What kind of area a label describes, so the box knows how to treat it. */
export function mapAreaToZoneType(label: string): ZoneType {
  const lower = label.toLowerCase();
  if (lower.includes('lift')) return 'directional_counting';
  if (lower.includes('dock') || lower.includes('loading')) return 'dock';
  if (lower.includes('gate') || lower.includes('entrance') || lower.includes('exit')) return 'gate';
  if (lower.includes('rack') || lower.includes('storage')) return 'rack';
  if (lower.includes('pallet')) return 'pallet_station';
  return 'general';
}

/**
 * What to watch for inside a new area. The dashboard derives this from the
 * "watching for" features chosen during setup; that step does not exist here
 * yet, so every area starts with the dashboard's own fallback.
 */
export function defaultThreatTypes(): ThreatType[] {
  return ['unauthorized_access'];
}

/** The record for a freshly closed outline, before the label is applied. */
export function newZone(points: Point[], index: number): ZonePolygon {
  return {
    id: uuid(),
    name: `Zone ${index + 1}`,
    label: `Zone ${index + 1}`,
    physical_zone_label: '',
    points,
    threat_types: [],
    zone_type: 'general',
    color: ZONE_COLORS[index % ZONE_COLORS.length],
    enabled: true,
  };
}

/** Applies the chosen area label the way the dashboard's editor does. */
export function labelZone(zone: ZonePolygon, label: string): ZonePolygon {
  const isLiftCounter = label.toLowerCase().includes('lift');
  const threats = defaultThreatTypes();
  return {
    ...zone,
    name: label,
    label,
    physical_zone_label: label,
    threat_types: isLiftCounter ? [] : threats,
    zone_type: mapAreaToZoneType(label),
    ...(isLiftCounter
      ? {
          inside_action: 'out' as const,
          classes: ['person'],
          confirm_frames: 2,
          min_score: 0.5,
          cooldown_seconds: 6,
        }
      : {}),
  };
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi || 1e-6) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(points: Point[]): Point {
  if (points.length < 3) return points[0] ?? [0.5, 0.5];
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const factor = x1 * y2 - x2 * y1;
    area += factor;
    cx += (x1 + x2) * factor;
    cy += (y1 + y2) * factor;
  }
  if (area === 0) {
    const sum = points.reduce<Point>((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    return [sum[0] / points.length, sum[1] / points.length];
  }
  const half = area * 0.5;
  return [cx / (6 * half), cy / (6 * half)];
}

/** RFC 4122-shaped v4 id; `crypto.randomUUID` is not available in every RN runtime. */
export function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
