/**
 * Design tokens.
 *
 * Two palettes with identical shape, so components read one set of names and
 * the active scheme decides the values. Layout tokens are scheme-independent.
 *
 * The colours are the ZeroForg dashboard's, so the phone and the web app read
 * as one product: gold `#D5AD34` on an anthracite ground, with umber `#7A5738`
 * as the secondary. They are lifted straight from the dashboard's CSS
 * variables (`zeroforg-frontend/src/app/globals.css`) rather than approximated,
 * so a change there can be mirrored here by converting the HSL values.
 *
 * The light scheme takes one liberty, deliberately: it is built to glow. Cards
 * are pure white lifted off a warm off-white ground and the bloom behind them
 * is a near-white gold rather than a tint of the accent, which is what gives
 * the light theme its luminous, neon-white feel. Gold at full strength is too
 * pale to read as text on white, so `accent` deepens for type and lines while
 * `accentBright` keeps the dashboard's exact gold for fills and glows.
 */

export type Scheme = 'light' | 'dark';

const dark = {
  base: '#0C0D0D',
  surface: '#141514',
  surfaceRaised: '#222524',
  surfaceSunken: '#090A0A',
  border: '#272A29',
  borderStrong: '#3A3E3C',

  text: '#F6F5F4',
  textMuted: '#9E9B94',
  textFaint: '#6B6F6C',

  accent: '#D5AD34',
  accentBright: '#E6C45C',
  /** Umber: the dashboard's secondary, used where gold would shout. */
  accentDeep: '#7A5738',
  accentSoft: 'rgba(213, 173, 52, 0.16)',
  accentLine: 'rgba(230, 196, 92, 0.38)',

  success: '#1FAD7E',
  successSoft: 'rgba(31, 173, 126, 0.14)',
  danger: '#DC2828',
  dangerSoft: 'rgba(220, 40, 40, 0.14)',

  glass: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',

  /** The bloom behind content: gold on the dark ground. */
  glow: '#D5AD34',
  glowStrength: 0.5,

  white: '#FFFFFF',
  black: '#000000',
};

export type Palette = typeof dark;

const light: Palette = {
  // A shade under the dashboard's #FAFAF9, so pure-white cards and the
  // white-gold bloom have something to lift off. Without that half-step the
  // glow lands on near-white and simply disappears.
  base: '#F6F5F2',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#F1F0EE',
  border: '#E2E1DF',
  borderStrong: '#CFCDC9',

  text: '#1E201F',
  textMuted: '#636966',
  textFaint: '#6C716D',

  // The dashboard uses gold, jade and red as FILLS behind dark or white text.
  // This app uses the same tokens as TYPE — a pill's label, a row's value — so
  // the light scheme carries type-safe versions at 4.5:1 on white, and keeps
  // the dashboard's exact colours in the *Bright*/*Soft* tokens for fills,
  // glows and bars where contrast is not at stake.
  accent: '#886C1C',
  accentBright: '#D5AD34',
  accentDeep: '#FBF3DC',
  accentSoft: 'rgba(213, 173, 52, 0.18)',
  accentLine: 'rgba(136, 108, 28, 0.34)',

  success: '#0B8059',
  successSoft: 'rgba(16, 183, 127, 0.16)',
  danger: '#D42C2C',
  dangerSoft: 'rgba(239, 67, 67, 0.12)',

  glass: 'rgba(255, 255, 255, 0.78)',
  glassBorder: 'rgba(30, 32, 31, 0.10)',

  /** Neon white: a warm white bloom, brighter than the dark scheme's gold. */
  glow: '#FFF6DE',
  glowStrength: 0.95,

  white: '#FFFFFF',
  black: '#000000',
};

export const palettes = { dark, light };

/**
 * Category hues for tiles and icons, drawn from the dashboard's own family so
 * a stat tile never fights the gold. Identical in both schemes.
 */
export const hue = {
  gold: '#D5AD34',
  umber: '#A66F3F',
  jade: '#22C38E',
  amber: '#F97415',
  ember: '#F46325',
  slate: '#89908C',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 44 } as const;

/**
 * The dashboard sets `--radius: 0.5rem` and Tailwind derives the rest from it
 * (`lg` = 8, `md` = 6, `sm` = 4). Matching that is most of why the app now
 * reads as the same product: the old 20-32px corners were the single largest
 * visual difference between the two.
 */
export const radius = { sm: 4, md: 8, lg: 12, xl: 16, xxl: 20, pill: 999 } as const;

/**
 * The families the app bundles. Names must match what `useFonts` registers in
 * `app/_layout.tsx`; React Native picks a face by family name, not by weight,
 * so each weight is its own family and `fontWeight` is not used.
 */
export const family = {
  light: 'Geist-Light',
  regular: 'Geist-Regular',
  medium: 'Geist-Medium',
  semibold: 'Geist-SemiBold',
  bold: 'Geist-Bold',
  mono: 'GeistMono-Regular',
} as const;

/**
 * Type scale without colour: callers apply the palette's text colour.
 *
 * Sizes are the dashboard's own scale (zero-forge `--font-size-*`, 16px base):
 * body 14, caption 12, heading 16, title 24, display 32 — and its two weights,
 * 400 for default and 600 for strong. The app was a size larger nearly
 * everywhere, which is why it read as a different, chunkier product.
 */
export const font = {
  /** Page titles are large and LIGHT on the dashboard, not heavy. */
  display: { fontFamily: family.light, fontSize: 30, letterSpacing: -0.6, lineHeight: 36 },
  title: { fontFamily: family.light, fontSize: 21, letterSpacing: -0.3, lineHeight: 27 },
  heading: { fontFamily: family.semibold, fontSize: 15, letterSpacing: -0.15, lineHeight: 21 },
  body: { fontFamily: family.regular, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: family.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: family.regular, fontSize: 12, lineHeight: 17 },
  /**
   * Section rules: "— IN THE BUILDING · COE GURGAON". Wide tracking, caps,
   * and the one idiom that more than anything else makes a screen read as
   * this product rather than a generic mobile app.
   */
  eyebrow: {
    fontFamily: family.semibold,
    fontSize: 11.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  /**
   * Geist Mono, for every NUMBER and every machine-ish fact — counts, times,
   * percentages, "0 of 20 enrolled". The dashboard sets all of these in mono
   * (its slashed zero is the giveaway) and it is what gives the board its
   * instrument-panel feel. Sans is for prose only.
   */
  mono: { fontFamily: family.mono, fontSize: 12, lineHeight: 17 },
  monoSmall: { fontFamily: family.mono, fontSize: 11, lineHeight: 15 },
  /** The headline figure on a card: big, light, monospaced. */
  figure: { fontFamily: family.mono, fontSize: 46, lineHeight: 54 },
  figureSmall: { fontFamily: family.mono, fontSize: 26, lineHeight: 32 },
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
  /** Gold into umber: the product's one saturated move. */
  accent:
    scheme === 'dark'
      ? (['#E6C45C', '#B07C3A'] as const)
      : (['#D5AD34', '#8A6128'] as const),
  mark: ['#E6C45C', '#7A5738'] as const,
  /** Tile washes, warm to cool. */
  bloom: ['#D5AD34', '#A8764A'] as const,
  ember: ['#F97415', '#D5AD34'] as const,
});
