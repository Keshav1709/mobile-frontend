/**
 * Design tokens.
 *
 * Two palettes with identical shape, so components read one set of names and
 * the active scheme decides the values. Layout tokens are scheme-independent.
 */

export type Scheme = 'light' | 'dark';

const dark = {
  base: '#05070B',
  surface: '#0B0F16',
  surfaceRaised: '#131A26',
  surfaceSunken: '#03050A',
  border: '#1C2434',
  borderStrong: '#2B3548',

  text: '#EDF1F8',
  textMuted: '#8892A6',
  textFaint: '#525C71',

  accent: '#3B6BF5',
  accentBright: '#7BA0FF',
  accentDeep: '#16244B',
  accentSoft: 'rgba(59, 107, 245, 0.16)',
  accentLine: 'rgba(123, 160, 255, 0.35)',

  success: '#2ED47A',
  successSoft: 'rgba(46, 212, 122, 0.14)',
  danger: '#FF5C61',
  dangerSoft: 'rgba(255, 92, 97, 0.14)',

  /** Frosted panel over the page background. */
  glass: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',

  white: '#FFFFFF',
  black: '#000000',
};

export type Palette = typeof dark;

const light: Palette = {
  base: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#EEF1F7',
  border: '#E3E7EF',
  borderStrong: '#CBD2DF',

  text: '#0C1220',
  textMuted: '#5B6579',
  textFaint: '#98A1B2',

  accent: '#2E5BE6',
  accentBright: '#2149C9',
  accentDeep: '#DEE7FF',
  accentSoft: 'rgba(46, 91, 230, 0.10)',
  accentLine: 'rgba(46, 91, 230, 0.28)',

  success: '#12A75C',
  successSoft: 'rgba(18, 167, 92, 0.12)',
  danger: '#DC2F35',
  dangerSoft: 'rgba(220, 47, 53, 0.10)',

  glass: 'rgba(255, 255, 255, 0.62)',
  glassBorder: 'rgba(12, 18, 32, 0.10)',

  white: '#FFFFFF',
  black: '#000000',
};

export const palettes = { dark, light };

/** Category hues for tiles and icons. Identical in both schemes. */
export const hue = {
  lime: '#C6F24E',
  violet: '#B79CFF',
  pink: '#FFA6D5',
  blue: '#6A93FF',
  amber: '#FFC15E',
  teal: '#4FE0C4',
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

export const gradientFor = (scheme: Scheme) => ({
  accent:
    scheme === 'dark'
      ? (['#4C7BFF', '#2B4FD6'] as const)
      : (['#3F6BF0', '#2149C9'] as const),
  mark: ['#7BA0FF', '#2B4FD6'] as const,
});
