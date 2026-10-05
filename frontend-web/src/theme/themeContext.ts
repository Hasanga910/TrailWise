import { createContext } from 'react';

/** Light is the default; the OS colour scheme is deliberately ignored. */
export type ThemePreference = 'light' | 'dark';
export type ResolvedTheme = ThemePreference;

export interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const THEME_STORAGE_KEY = 'trailwise_theme';

export const ThemeContext = createContext<ThemeContextValue | null>(null);
