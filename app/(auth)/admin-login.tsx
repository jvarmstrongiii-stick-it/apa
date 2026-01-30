import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/constants/theme';
import { useAuthContext } from '../../src/providers/AuthProvider';

export default function AdminLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  const { signInAdmin } = useAuthContext();

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      // TODO: Check if biometric hardware is available and if biometric login is enabled
      // import * as LocalAuthentication from 'expo-local-authentication';
      // const hasHardware = await LocalAuthentication.hasHardwareAsync();
      // const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      // setBiometricAvailable(hasHardware && isEnrolled);
      setBiometricAvailable(false); // Placeholder
    } catch {
      setBiometricAvailable(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      // TODO: Implement biometric authentication
      // const result = await LocalAuthentication.authenticateAsync({
      //   promptMessage: 'Authenticate to sign in',
      //   cancelLabel: 'Cancel',
      //   disableDeviceFallback: false,
      // });
      // if (result.success) {
      //   const storedCredentials = await getStoredCredentials();
      //   await signIn(storedCredentials);
      //   router.replace('/(admin)/(tabs)');
      // }
      Alert.alert('Biometric Login', 'Biometric login not yet implemented.');
    } catch (err: any) {
      setError(err?.message ?? 'Biometric authentication failed.');
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await signInAdmin(email.trim(), password);
      // Navigate immediately; biometric opt-in can happen later in settings
      router.replace('/(admin)/(tabs)');
    } catch (err: any) {
      setError(err?.message ?? 'Sign in failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnableBiometric = async () => {
    try {
      // TODO: Store credentials securely for biometric login
      // await storeCredentials({ email, password });
      // await AsyncStorage.setItem('biometric_enabled', 'true');
      Alert.alert('Success', 'Biometric login enabled for future sign-ins.');
    } catch {
      // Silently fail - biometric is optional
    } finally {
      router.replace('/(admin)/(tabs)');
    }
  };

  const handleSkipBiometric = () => {
    router.replace('/(admin)/(tabs)');
  };

  if (showBiometricPrompt && biometricAvailable) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.card}>
            <Ionicons
              name="finger-print"
              size={64}
              color={theme.colors.primary}
              style={styles.biometricIcon}
            />
            <Text style={styles.title}>Enable Biometric Login?</Text>
            <Text style={styles.biometricDescription}>
              Use Face ID or fingerprint for faster sign-in next time.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.signInButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleEnableBiometric}
            >
              <Text style={styles.signInButtonText}>Enable Biometric</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleSkipBiometric}
            >
              <Text style={styles.skipButtonText}>Skip for Now</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Admin Login</Text>
          <Text style={styles.subtitle}>League Operator Access</Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="admin@example.com"
              placeholderTextColor={theme.colors.textSecondary}
              returnKeyType="next"
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Enter password"
              placeholderTextColor={theme.colors.textSecondary}
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
              editable={!isSubmitting}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.signInButton,
              pressed && styles.buttonPressed,
              isSubmitting && styles.buttonDisabled,
            ]}
            onPress={handleSignIn}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </Pressable>

          {biometricAvailable && (
            <Pressable
              style={({ pressed }) => [
                styles.biometricButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleBiometricLogin}
              disabled={isSubmitting}
            >
              <Ionicons
                name="finger-print"
                size={24}
                color={theme.colors.primary}
              />
              <Text style={styles.biometricButtonText}>
                Sign in with Biometric
              </Text>
            </Pressable>
          )}

          <Pressable
            style={styles.backContainer}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>Back to Team Login</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  biometricDescription: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  biometricIcon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: theme.colors.error + '15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 48,
  },
  signInButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    minHeight: 52,
    gap: 10,
  },
  biometricButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skipButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  backContainer: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  backText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
