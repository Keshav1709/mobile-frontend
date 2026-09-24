import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useTheme } from '@/state/theme';
import { radius } from '@/theme';

// Day sky / night sky, thumb, and the sun and moon — the "cool theme toggle".
const DAY = '#7DD3FC';
const NIGHT = '#0F172A';
const THUMB_DAY = '#FACC15';
const THUMB_NIGHT = '#1E293B';
const MOON = '#FEF08A';
const STAR = '#FEF9C3';

const WIDTH = 64;
const HEIGHT = 32;
const PAD = 4;
const THUMB = HEIGHT - PAD * 2;
const TRAVEL = WIDTH - THUMB - PAD * 2;

/**
 * Light/dark switch. The thumb springs across a sky that shifts from day to
 * night; the sun rotates and shrinks away as the moon rotates in; a cloud
 * drifts in by day and stars by night. Pressing it reveals the new theme as a
 * circle spreading out from the switch itself.
 */
export function ThemeToggle() {
  const { scheme, toggleFrom } = useTheme();
  const dark = scheme === 'dark';
  const ref = useRef<View>(null);
  const t = useRef(new Animated.Value(dark ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(t, {
      toValue: dark ? 1 : 0,
      stiffness: 500,
      damping: 30,
      mass: 1,
      useNativeDriver: true,
    }).start();
  }, [dark, t]);

  const thumbX = t.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });
  const sunRotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const sunScale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const moonRotate = t.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });
  const moonScale = t;
  const cloudOpacity = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const cloudY = t.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });
  const starsOpacity = t;
  const starsY = t.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] });

  const press = () => {
    ref.current?.measureInWindow((x, y, w, h) => toggleFrom(x + w / 2, y + h / 2));
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      accessibilityState={{ checked: dark }}
      onPress={press}
      hitSlop={8}
    >
      <View ref={ref} collapsable={false} style={styles.track}>
        {/* Sky: two layers cross-fade so the colour change is smooth. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: DAY }]} />
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: NIGHT, opacity: t }]} />

        <Animated.View
          style={[styles.cloud, { opacity: cloudOpacity, transform: [{ translateY: cloudY }] }]}
        >
          <Svg width={20} height={14} viewBox="0 0 20 14">
            <Path
              d="M5.5 13.5h9.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 5 5.3 4.1 4.1 0 0 0 5.5 13.5z"
              fill="rgba(255,255,255,0.85)"
            />
          </Svg>
        </Animated.View>

        <Animated.View
          style={[styles.stars, { opacity: starsOpacity, transform: [{ translateY: starsY }] }]}
        >
          <Svg width={28} height={24} viewBox="0 0 28 24">
            <Circle cx={6} cy={5} r={1.2} fill={STAR} opacity={0.7} />
            <Circle cx={14} cy={17} r={1.8} fill={STAR} opacity={0.5} />
            <Circle cx={20} cy={8} r={1.1} fill={STAR} opacity={0.9} />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.thumb, { transform: [{ translateX: thumbX }] }]}>
          <View style={[StyleSheet.absoluteFill, styles.thumbFace, { backgroundColor: THUMB_DAY }]} />
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.thumbFace, { backgroundColor: THUMB_NIGHT, opacity: t }]}
          />
          <Animated.View
            style={[styles.icon, { opacity: sunScale, transform: [{ rotate: sunRotate }, { scale: sunScale }] }]}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Circle cx={12} cy={12} r={4.5} fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth={2} />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                const rad = (deg * Math.PI) / 180;
                return (
                  <Line
                    key={deg}
                    x1={12 + Math.cos(rad) * 7.5}
                    y1={12 + Math.sin(rad) * 7.5}
                    x2={12 + Math.cos(rad) * 10.5}
                    y2={12 + Math.sin(rad) * 10.5}
                    stroke="#fff"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })}
            </Svg>
          </Animated.View>
          <Animated.View
            style={[styles.icon, { opacity: moonScale, transform: [{ rotate: moonRotate }, { scale: moonScale }] }]}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill={MOON} />
            </Svg>
          </Animated.View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
    padding: PAD,
    justifyContent: 'center',
  },
  cloud: { position: 'absolute', right: 8, top: 0, bottom: 0, justifyContent: 'center' },
  stars: { position: 'absolute', left: 6, top: 4 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  thumbFace: { borderRadius: radius.pill },
  icon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
