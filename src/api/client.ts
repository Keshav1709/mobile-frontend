import { joinUrl } from '@/lib/helpers';

import { RequestError } from './errors';

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
    throw new RequestError(error);
  }
  return payload as T;
}

/**
 * Turn whatever a service returned into the `{ code, message }` contract.
 *
 * Our own services already speak it. The ZeroForg dashboard is a plain FastAPI
 * app, so its refusals arrive as `{"detail": "..."}` — and that sentence is
 * usually the most useful thing anyone could show ("Attendance board is not
 * enabled for this organization"), so it is kept rather than flattened into a
 * generic fault.
 */
function errorFrom(payload: unknown, status: number): { code: string; message: string } {
  if (payload && typeof payload === 'object') {
    const body = payload as { code?: unknown; message?: unknown; detail?: unknown };
    if (typeof body.code === 'string') {
      return { code: body.code, message: String(body.message ?? '') };
    }
    const detail = typeof body.detail === 'string' ? body.detail : undefined;
    if (detail) return { code: status === 403 ? 'NOT_ENABLED' : 'HTTP_ERROR', message: detail };
  }
  if (status === 401) {
    return { code: 'UNAUTHENTICATED', message: 'Your session expired. Sign in again.' };
  }
  return { code: 'SERVER_ERROR', message: 'The service returned an unexpected response.' };
}
