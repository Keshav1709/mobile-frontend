/**
 * Short relative times for rows that are read at a glance.
 *
 * This file used to also fold the socket's event and flow streams into a feed
 * for the home screen. That feed went: on a working site it was mostly
 * crossings and detections, almost none of which needed a person, which is the
 * wrong thing to put in front of someone checking whether they can stop
 * looking. Home shows the last hour of alerts instead.
 */

/** "just now", "4 min ago", short enough to sit at the end of a row. */
export function shortAgo(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}
