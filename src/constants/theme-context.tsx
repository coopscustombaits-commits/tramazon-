import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from '@/constants/theme';

/**
 * Light and dark theming.
 *
 * Screens don't import a palette directly — they call `useThemeColors()` and
 * `makeStyles()`, both of which hand back values for whichever theme is live.
 * That's what makes the toggle work: a stylesheet built at module load would
 * bake in whichever palette happened to be current at import time and never
 * change again.
 */

/** What the user chose. "system" follows the phone's own setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme.preference';

type ThemeContextValue = {
  colors: ThemeColors;
  /** The theme actually in effect, after resolving "system". */
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setStoredPreference] = useState<ThemePreference>('system');

  // Restore the saved choice. Until it loads we follow the system, which is
  // the right guess and avoids a flash of the wrong theme for most people.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && isPreference(stored)) setStoredPreference(stored);
      })
      .catch((error: unknown) => console.warn('[theme] could not restore', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setStoredPreference(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch((error: unknown) =>
      console.warn('[theme] could not save', error),
    );
  }, []);

  const scheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === 'dark' ? darkColors : lightColors,
      scheme,
      preference,
      setPreference,
    }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside <ThemeProvider>.');
  }
  return context;
}

/** The live palette. Name the result `Colors` and style code reads unchanged. */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Build a stylesheet from the live palette.
 *
 *   const useStyles = makeStyles((Colors) => ({
 *     card: { backgroundColor: Colors.surface },
 *   }));
 *
 * then `const styles = useStyles()` inside the component. The factory argument
 * is conventionally named `Colors` so the style bodies look the same as they
 * would with a static import.
 */
export function makeStyles<T extends NamedStyles>(factory: (colors: ThemeColors) => T) {
  return function useStyles(): T {
    const colors = useThemeColors();
    // Memoized per palette, so switching themes rebuilds once rather than on
    // every render of every screen.
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
