import { Platform, type TextStyle } from 'react-native';

/**
 * Coop's Custom Baits design tokens.
 *
 * The palette is earthy and outdoorsy: pine greens, weathered sand, and a
 * copper accent that reads like a spinner blade. Everything in the app should
 * pull colors from here rather than hardcoding hex values, so the look can be
 * retuned in one place as design direction firms up.
 */

export const Colors = {
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

export type ColorName = keyof typeof Colors;

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
 */
export const Typography = {
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: Colors.text,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400',
    color: Colors.text,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    color: Colors.text,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: Colors.textMuted,
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#3B3227',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
} as const;

/** Shared navigation header styling so every stack looks the same. */
export const navigationHeader = {
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.primary,
  headerTitleStyle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '600' as const,
  },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: Colors.background },
};
