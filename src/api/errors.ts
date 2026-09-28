export type ApiError = { code: string; message: string; detail?: string };

/** Copy for the error codes the services return. Never surface a raw traceback. */
const COPY: Record<string, string> = {
  // Signing in and a camera's ONVIF credentials are different things and read
  // differently: "username" is the camera's word, an account here is an email.
  INVALID_SIGN_IN: 'Incorrect email or password. Please try again.',
  INVALID_CREDENTIALS: 'Username or password is incorrect.',
  ONVIF_AUTH_FAILED: 'Username or password is incorrect.',
  CAMERA_UNREACHABLE:
    "We couldn't reach the camera. Make sure it is powered on and connected to the local network.",
  ONVIF_UNSUPPORTED: "This camera doesn't support ONVIF.",
  ONVIF_PROFILE_FAILED: "We connected to the camera but couldn't start its video stream.",
  STREAM_FAILED: "We connected to the camera but couldn't start its video stream.",
  STREAM_URI_FAILED: "We connected to the camera but couldn't start its video stream.",
  STREAM_VALIDATION_FAILED: "We connected to the camera but couldn't start its video stream.",
  TIMEOUT: 'The camera took too long to respond.',
  NETWORK_ERROR: "We couldn't reach the service. Check your connection and try again.",
  DATABASE_UNREACHABLE:
    "Zero Forg can't reach your workspace data right now. It usually comes back on its own. Try again shortly.",
  SERVER_ERROR: 'The service had a problem. Try again in a moment.',
  UNKNOWN_ERROR: 'Something went wrong.',

  // Permission and entitlement are different refusals and must read
  // differently. "Forbidden" for both sends someone to the wrong person: one
  // needs their administrator to grant them something, the other needs
  // somebody to buy it.
  UNAUTHENTICATED: 'Your session has ended. Sign in again to carry on.',
  PERMISSION_DENIED:
    "Your role doesn't include this. Ask your administrator to give you access on the dashboard.",
  NOT_ENABLED: 'This is not switched on for your organisation. Ask your administrator to enable it.',
  // Not a refusal: the dashboard briefly could not resolve the account. Retried
  // twice already by the client, so by the time this shows it really is stuck.
  // Said plainly, because "your workspace is waking up" told somebody their
  // account was half-built when the truth is a request did not land.
  NOT_PROVISIONED: 'That did not come through. Pull down to try again.',
  NOT_PURCHASED:
    'This is not part of your plan. Talk to your Zero Forg account manager about adding it.',
  NOT_FOUND: "We couldn't find that. It may have been removed.",
  CONFLICT: 'Something else changed this first. Refresh and try again.',
  RATE_LIMITED: 'Too many requests. Try again in a few moments.',
};

export class RequestError extends Error {
  readonly code: string;

  /**
   * What the service actually said, kept out of `message` on purpose.
   *
   * Backend sentences are written for backend readers and sometimes are not
   * sentences at all. Screens show `message`; this is here for logs and for
   * the rare screen that has a considered reason to show more.
   */
  readonly detail: string | null;

  constructor(error?: ApiError | null) {
    super(messageFor(error));
    this.name = 'RequestError';
    this.code = error?.code ?? 'UNKNOWN_ERROR';
    this.detail = error?.detail ?? null;
    // Subclassing Error loses the prototype chain once the class is
    // transpiled, which breaks `instanceof Error` and every catch that
    // depends on it. Restoring it here keeps those checks honest.
    Object.setPrototypeOf(this, RequestError.prototype);
  }
}

function messageFor(error?: ApiError | null): string {
  if (!error || typeof error !== 'object') return COPY.UNKNOWN_ERROR;
  // Own-property lookup only: a code like "constructor" or "toString" would
  // otherwise resolve to something inherited from Object.prototype.
  const known = Object.prototype.hasOwnProperty.call(COPY, error.code)
    ? COPY[error.code]
    : undefined;
  if (known) return known;
  return readable(error.message) ? error.message : COPY.UNKNOWN_ERROR;
}

/**
 * Whether a message from a service is fit to put in front of someone on a
 * factory floor.
 *
 * Services mix real sentences ("Attendance board is not enabled for this
 * organization") with identifiers ("RTSP_NEGOTIATION_FAILED"), tracebacks and
 * JSON fragments. The first kind is often the most useful thing anyone could
 * show; the rest are noise that has no business on a phone. This keeps prose
 * and rejects the rest, which then falls back to our own copy.
 */
function readable(message: unknown): message is string {
  if (typeof message !== 'string') return false;
  const text = message.trim();
  if (text.length < 8 || text.length > 200) return false;
  if (!text.includes(' ')) return false;
  // Identifiers, paths, tracebacks, markup and serialised payloads.
  if (/[_{}<>\\]|\b[A-Z]{2,}_[A-Z]/.test(text)) return false;
  if (/(Traceback|Exception|Error:|at line|https?:\/\/)/i.test(text)) return false;
  // Shouty constant case, e.g. "CAMERA UNREACHABLE".
  if (text === text.toUpperCase()) return false;
  return true;
}
