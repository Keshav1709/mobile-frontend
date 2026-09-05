/**
 * Design tokens.
 *
 * Two palettes with identical shape, so components read one set of names and
 * the active scheme decides the values. Layout tokens are scheme-independent.
 */

export type Scheme = 'light' | 'dark';

const dark = {
  base: '#07050B',
  surface: '#120B15',
  surfaceRaised: '#1B1020',
  surfaceSunken: '#050308',
  border: '#2A1B30',
  borderStrong: '#3D2947',

  text: '#F6EEF5',
  textMuted: '#A08FA8',
  textFaint: '#6B5B74',

  accent: '#FF3D9A',
  accentBright: '#FF85C2',
  accentDeep: '#2E0A1E',
  accentSoft: 'rgba(255, 61, 154, 0.16)',
  accentLine: 'rgba(255, 133, 194, 0.38)',

  success: '#3BE8A0',
  successSoft: 'rgba(59, 232, 160, 0.14)',
  danger: '#FF5C61',
  dangerSoft: 'rgba(255, 92, 97, 0.14)',

  glass: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',

  white: '#FFFFFF',
  black: '#000000',
};

export type Palette = typeof dark;

const light: Palette = {
  base: '#FBF6F9',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#F4EDF2',
  border: '#EBDFE8',
  borderStrong: '#D6C4D2',

  text: '#1A0F18',
  textMuted: '#6B5A68',
  textFaint: '#A0909D',

  accent: '#E01A7C',
  accentBright: '#B31261',
  accentDeep: '#FFE4F1',
  accentSoft: 'rgba(224, 26, 124, 0.10)',
  accentLine: 'rgba(224, 26, 124, 0.28)',

  success: '#0F9F6B',
  successSoft: 'rgba(15, 159, 107, 0.12)',
  danger: '#DC2F35',
  dangerSoft: 'rgba(220, 47, 53, 0.10)',

  glass: 'rgba(255, 255, 255, 0.66)',
  glassBorder: 'rgba(26, 15, 24, 0.10)',

  white: '#FFFFFF',
  black: '#000000',
};

export const palettes = { dark, light };

/** Category hues for tiles and icons. Identical in both schemes. */
export const hue = {
  pink: '#FF5FA8',
  coral: '#FF7A5C',
  orange: '#FFA23D',
  violet: '#B77BFF',
  lime: '#C6F24E',
  teal: '#3BE8C4',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 44 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 26, xxl: 32, pill: 999 } as const;

/** Type scale without colour: callers apply the palette's text colour. */
export const font = {
  display: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, lineHeight: 38 },
  title: { fontSize: 25, fontWeight: '700', letterSpacing: -0.5, lineHeight: 31 },
  heading: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  mono: { fontSize: 13, fontFamily: 'Menlo' },
} as const;

/**
 * Darkens or lightens a hex colour. The category hues are tuned for a dark
 * ground; on a light one they need deepening to hold contrast.
 */
export function shade(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  const channels = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
  const mixed = channels.map((channel) =>
    Math.round(amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount),
  );
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export const gradientFor = (scheme: Scheme) => ({
  /** Neon pink into coral: the one saturated move in the palette. */
  accent:
    scheme === 'dark'
      ? (['#FF3D9A', '#FF7A3D'] as const)
      : (['#E01A7C', '#F0662E'] as const),
  mark: ['#FF85C2', '#B14BFF'] as const,
  /** Tile washes, warm to cool. */
  bloom: ['#FF4FA3', '#B14BFF'] as const,
  ember: ['#FF7A5C', '#FFA23D'] as const,
});
