import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { AuthProvider } from '../src/providers/AuthProvider';
import { OfflineProvider } from '../src/providers/OfflineProvider';
import { ThemeProvider } from '../src/providers/ThemeProvider';
import { theme } from '../src/constants/theme';
import { UpdateScreen } from '../src/components/UpdateScreen';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

type UpdateStatus = 'checking' | 'downloading' | 'installing' | 'done';

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('checking');
  const [downloadProgress, setDownloadProgress] = useState(0);

  const updatesInfo = Updates.useUpdates();

  // Track download progress from the useUpdates hook
  useEffect(() => {
    if (
      updatesInfo.isDownloading &&
      updatesInfo.downloadProgress !== undefined
    ) {
      setDownloadProgress(Math.round(updatesInfo.downloadProgress * 100));
    }
  }, [updatesInfo.isDownloading, updatesInfo.downloadProgress]);

  // Auto-reload when update is downloaded
  useEffect(() => {
    if (updatesInfo.isUpdatePending && updateStatus === 'downloading') {
      setUpdateStatus('installing');
      Updates.reloadAsync();
    }
  }, [updatesInfo.isUpdatePending, updateStatus]);

  useEffect(() => {
    async function prepare() {
      try {
        if (!__DEV__) {
          setUpdateStatus('checking');
          const update = await Updates.checkForUpdateAsync();

          if (update.isAvailable) {
            setUpdateStatus('downloading');
            await Updates.fetchUpdateAsync();
            // Reload is handled by the isUpdatePending effect above
            return;
          }
        }
      } catch (error) {
        console.warn('Error during app initialization:', error);
      }
      setUpdateStatus('done');
      setAppReady(true);
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

  if (updateStatus !== 'done') {
    return <UpdateScreen status={updateStatus} progress={downloadProgress} />;
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
