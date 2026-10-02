import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { loadSettings, setSetting } from '@/db/repo';
import { normalizeHex } from '@/domain/validation';

import { buildPalette, DEFAULT_THEME, type Palette, type ThemeMode, type ThemeSettings } from './colors';

interface ThemeContextValue {
  colors: Palette;
  settings: ThemeSettings;
  updateTheme: (patch: Partial<ThemeSettings>) => Promise<void>;
  /** Re-reads settings from the database (e.g. after restoring a backup). */
  reloadTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const KEYS: Record<keyof ThemeSettings, string> = {
  mode: 'theme.mode',
  primary: 'theme.primary',
  income: 'theme.income',
  expense: 'theme.expense',
};

function parseSettings(raw: Record<string, string>): ThemeSettings {
  const mode = raw[KEYS.mode];
  return {
    mode: mode === 'light' || mode === 'dark' || mode === 'system' ? (mode as ThemeMode) : DEFAULT_THEME.mode,
    primary: normalizeHex(raw[KEYS.primary] ?? '') ?? DEFAULT_THEME.primary,
    income: normalizeHex(raw[KEYS.income] ?? '') ?? DEFAULT_THEME.income,
    expense: normalizeHex(raw[KEYS.expense] ?? '') ?? DEFAULT_THEME.expense,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [settings, setSettings] = useState<ThemeSettings | null>(null);

  const reloadTheme = useCallback(async () => {
    setSettings(parseSettings(await loadSettings(db)));
  }, [db]);

  useEffect(() => {
    reloadTheme();
  }, [reloadTheme]);

  const updateTheme = useCallback(
    async (patch: Partial<ThemeSettings>) => {
      setSettings((prev) => ({ ...(prev ?? DEFAULT_THEME), ...patch }));
      for (const [k, v] of Object.entries(patch) as [keyof ThemeSettings, string][]) {
        await setSetting(db, KEYS[k], v);
      }
    },
    [db],
  );

  const value = useMemo(() => {
    const s = settings ?? DEFAULT_THEME;
    const dark = s.mode === 'dark' || (s.mode === 'system' && system === 'dark');
    return { colors: buildPalette(s, dark), settings: s, updateTheme, reloadTheme };
  }, [settings, system, updateTheme, reloadTheme]);

  // Avoid flashing the default color before the saved one is loaded.
  if (!settings) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export function useColors(): Palette {
  return useTheme().colors;
}
