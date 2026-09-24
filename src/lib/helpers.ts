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

/**
 * Back to the previous page — or, when a page was reached by a redirect and
 * has no history behind it, to the page that logically precedes it. Every
 * screen shows a back control; this is what it does.
 */
export function goBack(fallback: string): void {
  // Imported lazily so this helper stays usable outside a router context.
  const { router } = require('expo-router') as typeof import('expo-router');
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

/**
 * A flow is over (setup finished, camera added): unwind every screen it
 * pushed and land on `route`, so back from there goes where the user was
 * before the flow began, not through its steps.
 */
export function finishFlow(route: string): void {
  const { router } = require('expo-router') as typeof import('expo-router');
  if (router.canDismiss()) router.dismissAll();
  router.replace(route as never);
}

/**
 * Return to an earlier screen of the current flow, popping everything above
 * it; if it is not in the stack, go there fresh.
 */
export function backTo(route: string): void {
  const { router } = require('expo-router') as typeof import('expo-router');
  try {
    router.dismissTo(route as never);
  } catch {
    router.replace(route as never);
  }
}

/**
 * Asks before signing out. Signing out clears the session and returns to the
 * start, so it should never happen from a stray tap.
 */
export function confirmSignOut(signOut: () => Promise<void>): void {
  const { Alert } = require('react-native') as typeof import('react-native');
  const { haptic } = require('./haptics') as typeof import('./haptics');
  haptic.warning();
  Alert.alert(
    'Sign out?',
    'You will need to sign in again to see your cameras and alerts.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ],
    { cancelable: true },
  );
}
