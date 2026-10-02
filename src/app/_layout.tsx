import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { LoadingScreen } from '@/components/LoadingScreen';
import { ToastProvider } from '@/components/Toast';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { DataProvider, useData } from '@/state/DataProvider';
import { ThemeProvider, useColors } from '@/theme/ThemeProvider';

// Keep the native splash up until our own loading screen has rendered (must run at module scope).
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 250, fade: true });

/** Forms slide up from the bottom on both platforms. */
const MODAL = { presentation: 'modal', animation: 'slide_from_bottom' } as const;

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const markReady = useCallback(() => setReady(true), []);
  const hideLoader = useCallback(() => setShowLoader(false), []);

  return (
    <View style={{ flex: 1 }}>
      <SQLiteProvider
        databaseName={DATABASE_NAME}
        onInit={migrateDbIfNeeded}
        onError={(e) => {
          console.warn(e);
          setDbError('Không mở được dữ liệu. Hãy thử đóng và mở lại ứng dụng.');
        }}
      >
        <ThemeProvider>
          <ToastProvider>
            <DataProvider>
              <ReadySignal onReady={markReady} />
              <Navigation />
            </DataProvider>
          </ToastProvider>
        </ThemeProvider>
      </SQLiteProvider>
      {showLoader && <LoadingScreen ready={ready} error={dbError} onFinish={hideLoader} />}
    </View>
  );
}

/** Tells the root layout when the database, theme and data snapshot are all loaded. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const { ready } = useData();
  useEffect(() => {
    if (ready) onReady();
  }, [ready, onReady]);
  return null;
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
