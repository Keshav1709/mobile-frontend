import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

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

/** Cycled while a refresh is in flight, one every 1.4s. */
const WORKING = [
  'Checking every camera',
  'Catching up on today',
  'Reading the last hour',
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
    const timer = setInterval(() => setStep((n) => (n + 1) % WORKING.length), STEP_MS);
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
        { opacity: fade, backgroundColor: color.surface, borderColor: color.border },
      ]}
      accessibilityLiveRegion="polite"
    >
      {refreshing ? (
        <OrbitLoader size={22} />
      ) : (
        <View style={[styles.done, { backgroundColor: color.success }]} />
      )}
      <Text numberOfLines={1} style={[font.label, styles.text, { color: color.textMuted }]}>
        {refreshing ? WORKING[step] : settled}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  done: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1 },
});
