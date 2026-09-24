import { joinUrl } from '@/lib/helpers';

import { RequestError } from './errors';
import { reportUnauthenticated } from './session';

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

/**
 * Single fetch wrapper for both services. Always resolves errors into the
 * `{ code, message }` contract so screens never branch on transport details.
 */
export async function request<T>(
  baseUrl: string,
  path: string,
  { method = 'GET', body, headers, timeoutMs = 15000 }: Options = {},
): Promise<T> {
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
    throw new RequestError({
      code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: aborted ? 'The request timed out.' : 'The service could not be reached.',
    });
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = errorFrom(payload, response.status);
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
