import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider, type Theme } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { ToastProvider } from '@/components/Toast';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { DataProvider } from '@/state/DataProvider';
import { ThemeProvider, useColors } from '@/theme/ThemeProvider';

/** Forms slide up from the bottom on both platforms. */
const MODAL = { presentation: 'modal', animation: 'slide_from_bottom' } as const;

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      <ThemeProvider>
        <ToastProvider>
          <DataProvider>
            <Navigation />
          </DataProvider>
        </ToastProvider>
      </ThemeProvider>
    </SQLiteProvider>
  );
}

function Navigation() {
  const c = useColors();
  const navTheme = useMemo<Theme>(() => {
    const base = c.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: c.primary, background: c.bg, card: c.card, text: c.text, border: c.border },
    };
  }, [c]);

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          contentStyle: { backgroundColor: c.bg },
          headerBackTitle: 'Quay lại',
          animation: 'slide_from_right',
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction" options={{ ...MODAL, title: 'Giao dịch' }} />
        <Stack.Screen name="budget-edit" options={{ ...MODAL, title: 'Ngân sách' }} />
        <Stack.Screen name="settings" options={{ title: 'Cài đặt' }} />
        <Stack.Screen name="appearance" options={{ title: 'Giao diện & màu sắc' }} />
        <Stack.Screen name="accounts/index" options={{ title: 'Tài khoản' }} />
        <Stack.Screen name="accounts/edit" options={{ ...MODAL, title: 'Tài khoản' }} />
        <Stack.Screen name="categories/index" options={{ title: 'Danh mục' }} />
        <Stack.Screen name="categories/edit" options={{ ...MODAL, title: 'Danh mục' }} />
      </Stack>
    </NavThemeProvider>
  );
}
