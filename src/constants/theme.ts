import { Platform, type TextStyle } from 'react-native';

/**
 * Coop's Custom Baits design tokens.
 *
 * The palette is earthy and outdoorsy: pine greens, weathered sand, and a
 * copper accent that reads like a spinner blade. Dark mode keeps the same
 * character rather than going flat black — a charcoal-green ground with the
 * greens lifted enough to hold up against it.
 *
 * Both palettes have exactly the same keys, which is what lets a screen be
 * written once. See `theme-context.tsx` for how a component gets the live one.
 */

export const lightColors = {
  /** Deep pine — primary actions, headers, active tabs. */
  primary: '#2E4A3D',
  primaryDark: '#1F332A',
  primaryLight: '#4A6B58',
  /** Very light wash of the primary, for selected rows and chips. */
  primaryTint: '#E3EBE5',

  /** Copper spinner-blade accent — highlights, badges, "new" markers. */
  accent: '#C1662F',
  accentTint: '#F6E7DB',

  /** Weathered sand — app background. */
  background: '#F7F3EC',
  /** Cards, sheets, inputs. */
  surface: '#FFFFFF',
  /** Slightly recessed surface, e.g. image placeholders. */
  surfaceMuted: '#EFE9DF',

  border: '#E0D8C9',
  borderStrong: '#C9BEA9',

  text: '#23201B',
  textMuted: '#6B6257',
  /** Text drawn on a filled or overlaid surface. White in both themes. */
  textInverse: '#FFFFFF',
  /** Placeholder text, disabled labels. */
  textFaint: '#9A9084',

  /** Lake blue — links and informational states. */
  link: '#3C6E8F',

  success: '#3F7D5A',
  successTint: '#E4F0E9',
  warning: '#B8860B',
  warningTint: '#F8EFD6',
  danger: '#B3452F',
  dangerTint: '#F7E4E0',

  overlay: 'rgba(35, 32, 27, 0.55)',
} as const;

export type ThemeColors = { [K in keyof typeof lightColors]: string };

/**
 * Dark palette. Greens are lifted and tints inverted into dark washes, so the
 * same `primaryTint` that reads as "gently highlighted" in light mode does the
 * same job here instead of glowing.
 */
export const darkColors: ThemeColors = {
  primary: '#4A7A5C',
  primaryDark: '#2E4A3D',
  primaryLight: '#6E9C7E',
  primaryTint: '#1F2A22',

  accent: '#D98A4F',
  accentTint: '#33261C',

  background: '#14170F',
  surface: '#1D2118',
  surfaceMuted: '#262B20',

  border: '#333829',
  borderStrong: '#4C5340',

  text: '#F1EDE4',
  textMuted: '#A9A395',
  textInverse: '#FFFFFF',
  textFaint: '#7B7568',

  link: '#7FB4D6',

  success: '#5F9E77',
  successTint: '#1B2A20',
  warning: '#C9A23F',
  warningTint: '#2C2616',
  danger: '#CC6A52',
  dangerTint: '#2E1C17',

  overlay: 'rgba(0, 0, 0, 0.6)',
};

/**
 * The light palette, for the few places that run outside a React component
 * (config, notification channel colors). Components must use `useThemeColors`.
 */
export const Colors = lightColors;

export type ColorName = keyof ThemeColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const FontFamily = Platform.select({
  ios: { sans: 'System', serif: 'Georgia', rounded: 'System' },
  android: { sans: 'sans-serif', serif: 'serif', rounded: 'sans-serif-medium' },
  default: { sans: 'System', serif: 'Georgia', rounded: 'System' },
});

/**
 * Type scale. Clean and generous — the photos are the star, the type should
 * stay out of the way.
 *
 * These carry no color, so they can stay static; every screen sets its own
 * color alongside the spread.
 */
export const Typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
} as const;

/** Shared navigation header styling so every stack looks the same. */
export function navigationHeader(colors: ThemeColors) {
  return {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerTitleStyle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '600' as const,
    },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  };
}
