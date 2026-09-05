/** Small utilities shared across screens and API clients. */

/**
 * The message to show a user for a thrown value.
 *
 * Screens catch `unknown`, and every one of them needs the same two lines to
 * turn that into readable text.
 */
export function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/** Joins a base URL and path without doubling or dropping the separator. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** Builds a query string from defined values, encoding each one. */
export function query(params: Record<string, string | number | undefined>): string {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}
