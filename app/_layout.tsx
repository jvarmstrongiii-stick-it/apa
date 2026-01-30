import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../src/providers/AuthProvider';
import { OfflineProvider } from '../src/providers/OfflineProvider';
import { ThemeProvider } from '../src/providers/ThemeProvider';
import { theme } from '../src/constants/theme';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // TODO: Load fonts, preload assets, restore auth state, etc.
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.warn('Error during app initialization:', error);
      } finally {
        setAppReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <OfflineProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
              animation: 'fade',
            }}
          />
        </OfflineProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
