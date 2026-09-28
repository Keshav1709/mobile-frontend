import { joinUrl } from '@/lib/helpers';

import { RequestError } from './errors';
import { reportUnauthenticated } from './session';

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /**
   * How many extra attempts a transient failure gets. Two by default.
   *
   * Set it to 0 for a call that already has a fallback running beside it: the
   * sign-in path asks the registry and the dashboard at once, and retrying the
   * registry there would hold sign-in open long after the dashboard answered.
   */
  retries?: number;
};

/** Long enough for the dashboard's user lookup to warm, short enough not to be felt. */
const RETRY_DELAY_MS = 400;

/**
 * Codes that mean "nobody answered", as opposed to "the answer was no".
 *
 * A cold registry behind a tunnelled database takes several seconds to serve
 * its first request, and the first launch of the day reliably spent that budget
 * and then showed a failure for something that works on the next attempt. None
 * of these is a real answer about the caller's data, so none of them is worth
 * putting in front of an operator until we have actually stopped trying.
 */
const TRANSIENT = new Set([
  'TIMEOUT',
  'NETWORK_ERROR',
  'DATABASE_UNREACHABLE',
  'SERVER_ERROR',
  'NOT_PROVISIONED',
]);

/**
 * How long the whole call may take, retries included.
 *
 * Without a shared deadline, three attempts at a thirty-second timeout is a
 * ninety-second wait, which is worse than the error it was trying to avoid.
 * Attempts stop as soon as the budget is spent, so a slow first attempt buys
 * fewer retries rather than a longer total.
 */
const TOTAL_BUDGET_MS = 32000;

/** 400ms, then 1.2s. Long enough for a pool to warm, short enough to sit through. */
const backoffFor = (attempt: number) => RETRY_DELAY_MS * 3 ** attempt;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Single fetch wrapper for both services. Always resolves errors into the
 * `{ code, message }` contract so screens never branch on transport details.
 */
export async function request<T>(
  baseUrl: string,
  path: string,
  options: Options = {},
): Promise<T> {
  // Two, not one: the dashboard's provisioning check fails about one request in
  // five, so a single retry still leaves roughly one launch in twenty-five
  // showing an error for something that works on the next attempt.
  const retries = options.retries ?? 2;
  return attempt<T>(baseUrl, path, options, retries, retries, Date.now() + TOTAL_BUDGET_MS);
}

/**
 * One attempt, plus however many the budget still allows.
 *
 * Retries cover transport failures as well as the dashboard's provisioning
 * blip. Both used to surface on the first try, and both are usually gone by the
 * second: the registry's connection pool is cold on the first request of a
 * launch and warm immediately after.
 */
async function attempt<T>(
  baseUrl: string,
  path: string,
  { method = 'GET', body, headers, timeoutMs = 15000, retries: allowed }: Options,
  retries: number,
  budget: number,
  deadline: number,
): Promise<T> {
  const options: Options = { method, body, headers, timeoutMs, retries: allowed };
  const next = () => attempt<T>(baseUrl, path, options, retries - 1, budget, deadline);
  /** How long to wait before the next try: 400ms, then 1.2s. */
  const delay = backoffFor(budget - retries);
  /** Try again only if there is an attempt left AND time to make it in. */
  const again = (code: string) =>
    retries > 0 && TRANSIENT.has(code) && Date.now() + delay < deadline;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(joinUrl(baseUrl, path), {
      method,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === 'AbortError';
    const code = aborted ? 'TIMEOUT' : 'NETWORK_ERROR';
    if (again(code)) {
      await wait(delay);
      return next();
    }
    throw new RequestError({
      code,
      message: aborted ? 'The request timed out.' : 'The service could not be reached.',
    });
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = errorFrom(payload, response.status);
    // Retried rather than shown: the dashboard intermittently refuses a
    // perfectly good token with "User is not provisioned" (observed 1 failure
    // in 5 against production, seconds apart, same token), and the registry
    // answers 503 while its database connection is still coming up. Neither is
    // an answer about this caller's data.
    if (again(error.code)) {
      await wait(delay);
      return next();
    }
    // One place decides what an expired session means, instead of every screen
    // showing a message the person cannot act on.
    if (error.code === 'UNAUTHENTICATED') reportUnauthenticated();
    throw new RequestError(error);
  }
  return payload as T;
}

/**
 * Turn whatever a service returned into the `{ code, message, detail }` contract.
 *
 * Our own services already speak it. The ZeroForg dashboard is a plain FastAPI
 * app, so its refusals arrive as `{"detail": "..."}` with the status carrying
 * the meaning. The status is what is mapped here; the sentence is carried
 * along as `detail` and `errors.ts` decides whether it is fit to show.
 *
 * The distinction that matters is 403 against 402. A role that does not
 * include something and a plan that does not include it are different
 * problems with different people to go to, and "Forbidden" for both sends
 * the person to the wrong one.
 */
function errorFrom(payload: unknown, status: number): { code: string; message: string; detail?: string } {
  const body =
    payload && typeof payload === 'object'
      ? (payload as { code?: unknown; message?: unknown; detail?: unknown })
      : null;

  // A service that speaks our contract has already decided; trust it.
  if (body && typeof body.code === 'string') {
    return { code: body.code, message: String(body.message ?? '') };
  }

  const detail = body && typeof body.detail === 'string' ? body.detail : undefined;
  return { code: codeFor(status, detail), message: detail ?? '', detail };
}

/**
 * The status, as a code this app has copy for.
 *
 * 403 is the awkward one: the dashboard uses it both for "your role does not
 * include this" and for "this feature is not switched on for this
 * organisation", and the only thing separating them is the wording of the
 * detail. Reading that wording is a guess, so it is a narrow one, and it
 * falls back to the permission reading because that is the one an operator
 * can actually do something about.
 *
 * TBD (backend): the dashboard should return a distinct code for the
 * not-enabled case so this does not have to read English.
 */
function codeFor(status: number, detail?: string): string {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 402) return 'NOT_PURCHASED';
  if (status === 403) {
    // "User is not provisioned" is a third meaning again, and a transient one:
    // the same token on the same endpoint answers 200 a second later. Reading
    // it as a permission refusal sends somebody to their administrator over a
    // backend hiccup, so it gets its own code and one silent retry above.
    if (detail && /\bnot provisioned\b/i.test(detail)) return 'NOT_PROVISIONED';
    return detail && /\bnot (enabled|available|configured)\b/i.test(detail)
      ? 'NOT_ENABLED'
      : 'PERMISSION_DENIED';
  }
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'HTTP_ERROR';
}
