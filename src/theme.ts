/**
 * Design tokens.
 *
 * Two palettes with identical shape, so components read one set of names and
 * the active scheme decides the values. Layout tokens are scheme-independent.
 *
 * COLOUR IS NOT AUTHORED HERE. Every value below is the ZeroForg dashboard's
 * own, so the phone and the web app read as one product. Two sources, in
 * order of authority:
 *
 *  1. `zeroforg-frontend/src/lib/zero-forge/tokens/scheme.scss` — the raw
 *     brand scales, and the only place the brand hexes are exact:
 *       gold   `--scheme-gold-600`       #D4AF37   (enterprise accent)
 *       umber  `--scheme-umber-500`      #7A5938   (enterprise brand)
 *       anthracite `--scheme-anthracite-*`          (enterprise neutral)
 *  2. `zeroforg-frontend/src/app/globals.css` — the shadcn layer, in HSL.
 *     Its grounds, surfaces, borders and semantics are converted to hex here
 *     one-for-one. Note its `--primary`/`--secondary` are HSL *roundings* of
 *     the two brand hexes (they land on #D5AD34 / #7A5738); the scheme.scss
 *     values above win, per DESIGN_SYSTEM.md.
 *
 * A change on the dashboard is mirrored here by redoing that conversion.
 *
 * The one deviation, and it is forced: the dashboard uses gold, jade and red
 * as FILLS behind dark or white text, while this app uses the same tokens as
 * TYPE — a pill's label, a row's value, an icon. Pure gold on white is 2.1:1.
 * So in the light scheme `accent`, `success` and `danger` keep the dashboard's
 * exact hue and saturation but drop in lightness until they clear 4.5:1 on
 * white; `accentBright` / `*Soft` carry the dashboard's untouched colours for
 * fills, glows and bars, where contrast is not at stake.
 */

export type Scheme = 'light' | 'dark';

const dark = {
  base: '#0C0D0D', // --background 150 5% 5%
  surface: '#141514', // --card 150 4% 8%
  surfaceRaised: '#222524', // --accent 150 4% 14%
  surfaceSunken: '#090A0A', // one step under the ground; no dashboard analogue
  border: '#272A29', // --border 150 4% 16%
  borderStrong: '#3D4140', // --scheme-anthracite-400

  text: '#F6F5F4', // --foreground 40 10% 96%
  textMuted: '#9E9B94', // --muted-foreground 40 5% 60%
  textFaint: '#6D7372', // --scheme-anthracite-600

  accent: '#D4AF37', // --scheme-gold-600
  accentBright: '#E5C44A', // --scheme-gold-700
  /** Umber: the dashboard's secondary, used where gold would shout. */
  accentDeep: '#7A5938', // --scheme-umber-500
  accentSoft: 'rgba(212, 175, 55, 0.16)', // gold-600 @ 16%
  accentLine: 'rgba(229, 196, 74, 0.38)', // gold-700 @ 38%

  success: '#1FAD7E', // --success 160 70% 40%
  successSoft: 'rgba(31, 173, 126, 0.14)',
  danger: '#DC2828', // --destructive 0 72% 51%
  dangerSoft: 'rgba(220, 40, 40, 0.14)',
  warning: '#F97415', // --warning 25 95% 53%
  warningSoft: 'rgba(249, 116, 21, 0.14)',
  /**
   * Severity as TYPE, on that severity's own soft background.
   *
   * A severity badge is the one place where the label and its backdrop are
   * both tinted the same hue, which is where a fill colour stops being
   * legible. Same hue and saturation as the token above, lightness moved
   * until it clears 4.5:1 on the pill it sits in. An operator has to read
   * "critical" across a dim floor.
   */
  dangerText: '#E45656', // 0 72%, 4.54:1 on the danger pill
  warningText: '#F97415', // already 5.44:1 on the warning pill

  glass: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',

  /** The bloom behind content: gold on the dark ground, as `.dark body::before`. */
  glow: '#D4AF37',
  glowStrength: 0.5,

  white: '#FFFFFF',
  black: '#000000',
};

export type Palette = typeof dark;

const light: Palette = {
  base: '#FAFAF9', // --background 40 10% 98%
  surface: '#FFFFFF', // --card 0 0% 100%
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#F1F0EE', // --muted 40 8% 94%
  border: '#E2E1DF', // --border 40 6% 88%
  borderStrong: '#C5C9C8', // --scheme-anthracite-900

  text: '#1E201F', // --foreground 150 3% 12%
  textMuted: '#636966', // --muted-foreground 150 3% 40%
  textFaint: '#8A908F', // --scheme-anthracite-700

  accent: '#8E731E', // gold-600's hue/sat, darkened to 4.54:1 on white
  accentBright: '#D4AF37', // --scheme-gold-600, untouched
  accentDeep: '#7A5938', // --scheme-umber-500
  accentSoft: 'rgba(212, 175, 55, 0.18)', // gold-600 @ 18%
  accentLine: 'rgba(142, 115, 30, 0.34)',

  success: '#0C875E', // --success 160 84% … darkened to 4.52:1 on white
  successSoft: 'rgba(16, 183, 127, 0.16)', // --success 160 84% 39%, untouched
  danger: '#EB1616', // --destructive 0 84% … darkened to 4.51:1 on white
  dangerSoft: 'rgba(239, 67, 67, 0.12)', // --destructive 0 84% 60%, untouched
  warning: '#F97415', // --warning 25 95% 53%
  warningSoft: 'rgba(249, 116, 21, 0.14)',
  dangerText: '#D21212', // 0 84%, 4.50:1 on the danger pill
  warningText: '#B54E05', // 25 95%, 4.50:1 on the warning pill

  glass: 'rgba(255, 255, 255, 0.78)',
  glassBorder: 'rgba(30, 32, 31, 0.10)',

  /**
   * The dashboard has no light-mode bloom; this one is the app's own, a warm
   * white that lifts pure-white cards off the near-white ground.
   */
  glow: '#FFF6DE',
  glowStrength: 0.95,

  white: '#FFFFFF',
  black: '#000000',
};

export const palettes = { dark, light };

/**
 * Category hues for tiles and icons, taken from the dashboard's own chart
 * ramp (`--chart-*`, dark) and neutral scale, so a stat tile never fights the
 * gold. Identical in both schemes.
 */
export const hue = {
  gold: '#D4AF37', // --scheme-gold-600
  umber: '#A66F3F', // --chart-2 dark, 28 45% 45%
  jade: '#22C38E', // --chart-3 dark, 160 70% 45%
  amber: '#F97415', // --chart-4 / --warning, 25 95% 53%
  ember: '#F46325', // --chart-5 dark, 18 90% 55%
  slate: '#8A908F', // --scheme-anthracite-700
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
      ? (['#E5C44A', '#9A7652'] as const) // gold-700 -> umber-600
      : (['#D4AF37', '#5D422C'] as const), // gold-600 -> umber-400
  mark: ['#E5C44A', '#7A5938'] as const, // gold-700 -> umber-500
  /** Tile washes, warm to cool. */
  bloom: ['#D4AF37', '#A66F3F'] as const, // gold-600 -> chart-2
  ember: ['#F97415', '#D4AF37'] as const, // warning -> gold-600
});
