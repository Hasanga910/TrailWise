import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { THEME_STORAGE_KEY, ThemeContext, type ThemePreference } from './themeContext';

/** Light unless the visitor explicitly chose dark. Anything else stored (including a legacy "system") means light. */
function readPreference(): ThemePreference {
  try {
    if (localStorage.getItem(THEME_STORAGE_KEY) === 'dark') return 'dark';
  } catch {
    // storage unavailable: stay light
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolved: preference, setPreference }),
    [preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
