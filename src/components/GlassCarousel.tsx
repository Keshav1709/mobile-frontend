import { BlurView } from 'expo-blur';
import { ReactNode, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

export type GlassSlide = {
  key: string;
  title: string;
  tint: string;
  rows: { label: string; value: string | null | undefined }[];
  footer?: ReactNode;
};

const { width: SCREEN } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN - space.xl * 2, 340);
const SPACING = space.md;
const SNAP = CARD_WIDTH + SPACING;

/**
 * Frosted cards on a horizontal rail. Each card rotates about its Y axis as it
 * moves through the centre, so the deck reads as physical rather than a list.
 */
export function GlassCarousel({ slides }: { slides: GlassSlide[] }) {
  const { color, scheme } = useTheme();
  const scrollX = useRef(new Animated.Value(0)).current;

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={SNAP}
      decelerationRate="fast"
      contentContainerStyle={styles.rail}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
      })}
      scrollEventThrottle={16}
    >
      {slides.map((slide, index) => {
        const range = [(index - 1) * SNAP, index * SNAP, (index + 1) * SNAP];
        const rotateY = scrollX.interpolate({
          inputRange: range,
          outputRange: ['32deg', '0deg', '-32deg'],
          extrapolate: 'clamp',
        });
        const scale = scrollX.interpolate({
          inputRange: range,
          outputRange: [0.9, 1, 0.9],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange: range,
          outputRange: [0.55, 1, 0.55],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={slide.key}
            style={[
              styles.card,
              { opacity, transform: [{ perspective: 900 }, { rotateY }, { scale }] },
            ]}
          >
            <BlurView
              intensity={scheme === 'dark' ? 40 : 60}
              tint={scheme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: color.glass, borderColor: color.glassBorder },
                styles.sheen,
              ]}
            />
            <View style={[styles.stripe, { backgroundColor: slide.tint }]} />

            <View style={styles.body}>
              <Text style={[font.eyebrow, { color: slide.tint }]}>{slide.title}</Text>
              <View style={styles.rows}>
                {slide.rows.map((row) => (
                  <View key={row.label} style={styles.row}>
                    <Text style={[font.caption, { color: color.textMuted }]}>{row.label}</Text>
                    <Text style={[font.label, styles.value, { color: color.text }]}>
                      {row.value ?? '—'}
                    </Text>
                  </View>
                ))}
              </View>
              {slide.footer}
            </View>
          </Animated.View>
        );
      })}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: space.xl, gap: SPACING, paddingVertical: space.sm },
  card: {
    width: CARD_WIDTH,
    borderRadius: radius.xxl,
    overflow: 'hidden',
  },
  sheen: { borderWidth: 1, borderRadius: radius.xxl },
  stripe: { height: 3, width: '38%', marginLeft: space.lg, marginTop: space.lg, borderRadius: 2 },
  body: { padding: space.lg, gap: space.lg },
  rows: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  value: { flexShrink: 1, textAlign: 'right' },
});
