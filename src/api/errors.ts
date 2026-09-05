export type ApiError = { code: string; message: string };

/** Copy for the error codes the services return. Never surface a raw traceback. */
const COPY: Record<string, string> = {
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
  SERVER_ERROR: 'The service had a problem. Try again in a moment.',
  UNKNOWN_ERROR: 'Something went wrong while connecting the camera.',
};

export class RequestError extends Error {
  readonly code: string;

  constructor(error: ApiError) {
    super(messageFor(error));
    this.code = error.code;
  }
}

function messageFor(error: ApiError | null | undefined): string {
  if (!error) return COPY.UNKNOWN_ERROR;
  return COPY[error.code] ?? error.message ?? COPY.UNKNOWN_ERROR;
}
