/**
 * How a camera actually is, as opposed to what its row claims.
 *
 * `cameras.status` on `/vms/cameras` is not a health signal. The dashboard's own
 * presence service says so in as many words — "written once at onboarding and
 * stale ever since" — and it is why Camera 26 reports `online` while every frame
 * request answers 503. Trusting it means a green dot on a camera that has sent
 * nothing for hours, so the person taps in and waits at a blank tile.
 *
 * `GET /console/live/cameras` answers from presence instead: a camera is online
 * when a frame or a detection batch reached the backend inside the last minute.
 * The staleness threshold below is the backend's own (`camera_presence.py`), so
 * the phone and the web console never disagree about what "working" means.
 */

/**
 * Nothing for this long is a fault rather than a blip.
 * Mirrors `UNAVAILABLE_AFTER_SEC` in the backend's camera_presence.
 */
const UNAVAILABLE_AFTER_MS = 10 * 60 * 1000;

export type CameraHealth = 'live' | 'stalled' | 'down' | 'disabled' | 'unknown';

/** A row of `GET /console/live/cameras`. `status` there is presence-derived. */
export type LiveCamera = {
  id: string;
  name: string;
  status: string;
  last_frame_at: string | null;
  enabled?: boolean;
};

/**
 * Three states worth separating, because the person does something different
 * about each: nothing (live), wait (stalled), or go and look at the camera (down).
 */
export function healthOf(
  row: LiveCamera | undefined,
  now = Date.now(),
  sendingPictures?: boolean,
): CameraHealth {
  if (!row) return 'unknown';
  if (row.enabled === false) return 'disabled';

  /**
   * Presence counts "a frame OR a detection batch", so a camera whose pictures
   * cannot be fetched still reports `online` while its stream answers nothing.
   * Camera 26 does exactly this in production: presence says online with a
   * fresh last_frame_at, and the stream endpoint times out. Calling that Live
   * tells someone they can watch a camera they cannot, so a failed picture
   * outranks presence.
   */
  if (sendingPictures === false) return 'stalled';
  if (row.status === 'online') return 'live';

  const seen = row.last_frame_at ? Date.parse(row.last_frame_at) : NaN;
  if (!Number.isFinite(seen)) return 'down';
  return now - seen <= UNAVAILABLE_AFTER_MS ? 'stalled' : 'down';
}

/** Short enough to sit under a camera name in the switcher. */
export const healthLabel: Record<CameraHealth, string> = {
  live: 'Live',
  stalled: 'No picture just now',
  down: 'Not sending',
  disabled: 'Turned off',
  unknown: 'Checking',
};

/**
 * Said in full for screen readers, where a colour carries nothing. Colour alone
 * would also fail the ~8% of men with red/green colour blindness — the label is
 * what makes the dot mean anything to them.
 */
export const healthDescription: Record<CameraHealth, string> = {
  live: 'sending pictures',
  stalled: 'paused, last picture within the last few minutes',
  down: 'not sending pictures, needs checking',
  disabled: 'turned off',
  unknown: 'status not known yet',
};
