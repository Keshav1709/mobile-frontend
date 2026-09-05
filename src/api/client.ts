import { joinUrl } from '@/lib/helpers';

import { RequestError } from './errors';

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
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
    // A body without a `code` means the service failed before its own error
    // handling ran, so report it as a service fault rather than a camera one.
    const error =
      payload && typeof payload === 'object' && 'code' in payload
        ? (payload as { code: string; message: string })
        : { code: 'SERVER_ERROR', message: 'The service returned an unexpected response.' };
    throw new RequestError(error);
  }
  return payload as T;
}
