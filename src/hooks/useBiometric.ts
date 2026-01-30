import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';

interface StoredCredentials {
  email: string;
  password: string;
}

/**
 * Hook for managing biometric (Face ID / Touch ID / fingerprint)
 * authentication on native platforms.
 *
 * On web this hook is inert -- `isBiometricAvailable` will always be
 * `false` and the enable / authenticate functions are no-ops.
 */
export function useBiometric() {
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ------------------------------------------------------------------
  // Initialisation -- check hardware support + stored preference
  // ------------------------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      // Biometrics are not supported on web
      if (Platform.OS === 'web') {
        if (isMounted) {
          setIsBiometricAvailable(false);
          setIsBiometricEnabled(false);
          setIsLoading(false);
        }
        return;
      }

      try {
        // Check hardware capability
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = compatible
          ? await LocalAuthentication.isEnrolledAsync()
          : false;
        const available = compatible && enrolled;

        // Check whether the user has previously opted in
        const enabledFlag = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        const enabled = available && enabledFlag === 'true';

        if (isMounted) {
          setIsBiometricAvailable(available);
          setIsBiometricEnabled(enabled);
        }
      } catch (err) {
        console.error('[useBiometric] Init error:', err);
        if (isMounted) {
          setIsBiometricAvailable(false);
          setIsBiometricEnabled(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // ------------------------------------------------------------------
  // Enable biometric login (stores credentials securely)
  // ------------------------------------------------------------------

  const enableBiometric = useCallback(
    async (email: string, password: string): Promise<void> => {
      if (Platform.OS === 'web') return;

      if (!isBiometricAvailable) {
        throw new Error('Biometric authentication is not available on this device.');
      }

      // Prompt the user to verify their identity before we store anything
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        throw new Error('Biometric verification failed. Please try again.');
      }

      const credentials: StoredCredentials = { email, password };

      await SecureStore.setItemAsync(
        BIOMETRIC_CREDENTIALS_KEY,
        JSON.stringify(credentials),
      );
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');

      setIsBiometricEnabled(true);
    },
    [isBiometricAvailable],
  );

  // ------------------------------------------------------------------
  // Disable biometric login (removes stored credentials)
  // ------------------------------------------------------------------

  const disableBiometric = useCallback(async (): Promise<void> => {
    if (Platform.OS === 'web') return;

    await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);

    setIsBiometricEnabled(false);
  }, []);

  // ------------------------------------------------------------------
  // Authenticate with biometric and retrieve stored credentials
  // ------------------------------------------------------------------

  const authenticateWithBiometric = useCallback(
    async (): Promise<StoredCredentials | null> => {
      if (Platform.OS === 'web') return null;

      if (!isBiometricAvailable || !isBiometricEnabled) {
        return null;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in with biometrics',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        return null;
      }

      const stored = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);

      if (!stored) {
        // Credentials were removed (e.g. app data cleared) -- disable flag
        await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
        setIsBiometricEnabled(false);
        return null;
      }

      try {
        return JSON.parse(stored) as StoredCredentials;
      } catch {
        console.error('[useBiometric] Failed to parse stored credentials');
        await disableBiometric();
        return null;
      }
    },
    [isBiometricAvailable, isBiometricEnabled, disableBiometric],
  );

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  return {
    isBiometricAvailable,
    isBiometricEnabled,
    isLoading,
    enableBiometric,
    disableBiometric,
    authenticateWithBiometric,
  };
}
