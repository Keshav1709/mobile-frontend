export type ApiError = { code: string; message: string };

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
    "Zero Forg can't reach your workspace data right now. It should come back on its own \u2014 try again shortly.",
  SERVER_ERROR: 'The service had a problem. Try again in a moment.',
  UNKNOWN_ERROR: 'Something went wrong.',
};

export class RequestError extends Error {
  readonly code: string;

  constructor(error?: ApiError | null) {
    super(messageFor(error));
    this.name = 'RequestError';
    this.code = error?.code ?? 'UNKNOWN_ERROR';
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
  const message = known ?? error.message;
  return typeof message === 'string' && message ? message : COPY.UNKNOWN_ERROR;
}
