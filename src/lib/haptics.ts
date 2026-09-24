import * as Haptics from 'expo-haptics';

/**
 * Touch feedback for the moments that matter. Each is fire-and-forget and
 * silent on devices without a haptic engine.
 */
const quiet = (run: () => Promise<void>) => {
  run().catch(() => undefined);
};

export const haptic = {
  /** A light tick: a control was pressed. */
  tap: () => quiet(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A firmer tick: a selection changed or a pad key engaged. */
  select: () => quiet(() => Haptics.selectionAsync()),
  /** Something completed: box bound, areas saved. */
  success: () => quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A confirm-before-you-do-this moment. */
  warning: () => quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Something failed. */
  error: () => quiet(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
