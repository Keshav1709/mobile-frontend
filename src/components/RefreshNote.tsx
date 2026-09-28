import { useEffect, useRef, useState } from 'react';
import { Animated, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { OrbitLoader } from '@/components/OrbitLoader';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

/**
 * What the app says while it is fetching, and for a moment after.
 *
 * The platform's pull-to-refresh spinner says only that something is happening.
 * These say what, which is the difference between waiting and being told. They
 * are deliberately plain: this is a safety product, and a person pulling to
 * refresh wants to know whether anything has changed, not to be entertained.
 */

/**
 * Cycled while a refresh is in flight, one every 1.4s.
 *
 * Eight lines, not four. A cold start against the dashboard can take twenty
 * seconds or more - the workspace, then its cameras, then the last hour - and
 * with four lines the list visibly looped twice, which reads as "stuck" rather
 * than "working". Eight covers the slow case without repeating, and the last
 * one holds once they run out: a line that stops changing is honest about a
 * long wait, where a loop pretends progress that is not being made.
 *
 * Each line names something the app is actually doing, in the order it does it.
 * None of them claim a result.
 */
const WORKING = [
  'Checking every camera',
  'Catching up on today',
  'Reading the last hour',
  'Counting who is on site',
  'Checking your boxes are online',
  'Looking for anything still open',
  'Putting it together',
  'Almost there',
];

/** Shown briefly once it lands, chosen by what actually came back. */
export function settledLine(alerts: number, offline: number): string {
  if (offline > 0) {
    return offline === 1
      ? 'One camera still has no picture'
      : `${offline} cameras still have no picture`;
  }
  if (alerts > 0) {
    return alerts === 1 ? 'One alert still open' : `${alerts} alerts still open`;
  }
  return 'You are all caught up';
}

const STEP_MS = 1400;
const SETTLED_MS = 1800;

/**
 * Pull to refresh, with the platform's own spinner hidden.
 *
 * Two indicators for one refresh is one too many, and they disagreed: the
 * system spinner sat in the scroll view saying only "something is happening"
 * while the note below it said what. The gesture still has to come from a
 * `RefreshControl` — it is the only way a scroll view offers one — so the
 * control stays and is made invisible instead.
 *
 * Hidden twice over, because the two platforms draw it differently. iOS honours
 * a transparent `tintColor`; Android draws a filled circle that needs its
 * colours cleared as well, and is pushed above the top edge for the builds that
 * still paint a shadow under it.
 */
export function SilentRefreshControl(props: { refreshing: boolean; onRefresh: () => void }) {
  return (
    <RefreshControl
      {...props}
      tintColor="transparent"
      colors={['transparent']}
      progressBackgroundColor="transparent"
      progressViewOffset={-1000}
    />
  );
}

export function RefreshNote({
  refreshing,
  settled,
}: {
  refreshing: boolean;
  /** The line to hold for a moment once the refresh lands. */
  settled: string;
}) {
  const { color } = useTheme();
  const [step, setStep] = useState(0);
  const [showSettled, setShowSettled] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const was = useRef(refreshing);

  // Cycle the working lines only while something is actually in flight.
  useEffect(() => {
    if (!refreshing) return;
    setStep(0);
    // Advance, then stop at the last line rather than wrapping. Looping back to
    // "Checking every camera" after eleven seconds reads as a request that
    // restarted, which is the one thing that is not happening.
    const timer = setInterval(
      () => setStep((n) => Math.min(n + 1, WORKING.length - 1)),
      STEP_MS,
    );
    return () => clearInterval(timer);
  }, [refreshing]);

  // On the edge from refreshing to done, hold the result for a beat.
  useEffect(() => {
    if (was.current && !refreshing) {
      setShowSettled(true);
      const timer = setTimeout(() => setShowSettled(false), SETTLED_MS);
      was.current = refreshing;
      return () => clearTimeout(timer);
    }
    was.current = refreshing;
  }, [refreshing]);

  const visible = refreshing || showSettled;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [visible, fade]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: fade,
          backgroundColor: color.surface,
          borderColor: color.border,
          // Lifted off the page rather than sitting in it, because it now floats
          // over the content instead of pushing it down.
          shadowColor: '#000',
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      {refreshing ? (
        <OrbitLoader size={18} />
      ) : (
        <View style={[styles.done, { backgroundColor: color.success }]} />
      )}
      <Text numberOfLines={1} style={[font.label, { color: color.textMuted }]}>
        {refreshing ? WORKING[step] : settled}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Sized to its text and centred by the overlay that holds it, rather than
  // stretched across the screen: floating over the page, a full-width bar reads
  // as a banner announcing a problem, which a refresh is not.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  done: { width: 8, height: 8, borderRadius: 4 },
});
