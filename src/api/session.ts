/**
 * What the app does when a service says the session is over.
 *
 * Any call from any screen can come back 401, and until now each of them just
 * printed "Your session expired. Sign in again." with no way to act on it, so
 * the only way out was to kill the app. The client reports it here instead and
 * AuthProvider decides once, for everyone.
 *
 * Deliberately a module-level hook rather than a context: `request` is called
 * from API modules that are not React and must stay that way.
 */

type Handler = () => void;

let handler: Handler | null = null;
let lastReportedAt = 0;

/** A burst of parallel requests all failing at once is still one expired session. */
const DEBOUNCE_MS = 5000;

export function onUnauthenticated(next: Handler | null): void {
  handler = next;
}

export function reportUnauthenticated(): void {
  const now = Date.now();
  if (now - lastReportedAt < DEBOUNCE_MS) return;
  lastReportedAt = now;
  handler?.();
}

/** Lets a fresh sign-in be noticed immediately rather than swallowed by the debounce. */
export function resetUnauthenticated(): void {
  lastReportedAt = 0;
}
