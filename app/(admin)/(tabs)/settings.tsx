import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../src/constants/theme';
import { useAuthContext } from '../../../src/providers/AuthProvider';
import { supabase } from '../../../src/lib/supabase/client';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const BUILD_NUMBER =
  Constants.expoConfig?.ios?.buildNumber ??
  Constants.expoConfig?.android?.versionCode?.toString() ??
  '1';
const ENVIRONMENT = Constants.expoConfig?.extra?.eas?.projectId
  ? __DEV__ ? 'Development' : 'Production'
  : 'Development';

export default function AdminSettingsScreen() {
  const { signOut, user } = useAuthContext();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [scorekeeperCount, setScorekeeperCount] = useState<1 | 2>(1);
  const [savingScorekeeper, setSavingScorekeeper] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function loadLeagueSetting() {
      // Fetch the LO's profile to get their associated league_id
      // (league_id added in migration 00022 — not yet in generated types, cast needed)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('league_id')
        .eq('id', user!.id)
        .single() as any;

      const lid: string | null = profileData?.league_id ?? null;
      setLeagueId(lid);

      if (!lid) return;

      // Fetch scorekeeper_count from the league
      // (column added in migration 00016 — not yet in generated types, cast needed)
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('scorekeeper_count')
        .eq('id', lid)
        .single() as any;

      if (leagueData?.scorekeeper_count) {
        setScorekeeperCount(leagueData.scorekeeper_count as 1 | 2);
      }
    }

    loadLeagueSetting();
  }, [user]);

  const handleScorekeeperCount = async (count: 1 | 2) => {
    if (!leagueId || savingScorekeeper || count === scorekeeperCount) return;
    setSavingScorekeeper(true);
    const prev = scorekeeperCount;
    setScorekeeperCount(count);
    const { error } = await (supabase
      .from('leagues')
      .update({ scorekeeper_count: count } as any)
      .eq('id', leagueId) as any);
    if (error) {
      setScorekeeperCount(prev);
      Alert.alert('Error', 'Failed to update scorekeeper setting.');
    }
    setSavingScorekeeper(false);
  };

  const handleToggleBiometric = async (value: boolean) => {
    try {
      if (value) {
        // TODO: Authenticate with biometrics first, then enable
        // const result = await LocalAuthentication.authenticateAsync({...});
        // if (!result.success) return;
        // await AsyncStorage.setItem('biometric_enabled', 'true');
        setBiometricEnabled(true);
      } else {
        // TODO: Disable biometric login
        // await AsyncStorage.removeItem('biometric_enabled');
        // await removeStoredCredentials();
        setBiometricEnabled(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update biometric settings.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/(auth)/login');
          } catch (error) {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="person-outline" size={22} color={theme.colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>Signed in as</Text>
                <Text style={styles.settingValue}>
                  {user?.email ?? 'admin@example.com'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Security Section */}
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.section}>
          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Ionicons name="finger-print" size={22} color={theme.colors.textSecondary} />
              <View>
                <Text style={styles.settingLabel}>Biometric Login</Text>
                <Text style={styles.settingDescription}>
                  Use Face ID or fingerprint to sign in
                </Text>
              </View>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary + '80',
              }}
              thumbColor={biometricEnabled ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Scoring Section — only shown when LO has an associated league */}
        {leagueId != null && (
          <>
            <Text style={styles.sectionTitle}>Scoring</Text>
            <View style={styles.section}>
              <View style={[styles.settingRow, styles.settingRowLast]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="people-outline" size={22} color={theme.colors.textSecondary} />
                  <View>
                    <Text style={styles.settingLabel}>Scorekeepers per Match</Text>
                    <Text style={styles.settingDescription}>
                      2 scorekeepers enables innings verification on both devices
                    </Text>
                  </View>
                </View>
                <View style={styles.segmentedControl}>
                  <Pressable
                    style={[
                      styles.segmentButton,
                      styles.segmentButtonLeft,
                      scorekeeperCount === 1 && styles.segmentButtonActive,
                    ]}
                    onPress={() => handleScorekeeperCount(1)}
                  >
                    <Text style={[
                      styles.segmentButtonText,
                      scorekeeperCount === 1 && styles.segmentButtonTextActive,
                    ]}>1</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.segmentButton,
                      styles.segmentButtonRight,
                      scorekeeperCount === 2 && styles.segmentButtonActive,
                    ]}
                    onPress={() => handleScorekeeperCount(2)}
                  >
                    <Text style={[
                      styles.segmentButtonText,
                      scorekeeperCount === 2 && styles.segmentButtonTextActive,
                    ]}>2</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </>
        )}

        {/* App Info Section */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="information-circle-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={styles.settingLabel}>Version</Text>
            </View>
            <Text style={styles.settingValueRight}>
              {APP_VERSION} ({BUILD_NUMBER})
            </Text>
          </View>
          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Ionicons name="build-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={styles.settingLabel}>Environment</Text>
            </View>
            <Text style={styles.settingValueRight}>
              {ENVIRONMENT}
            </Text>
          </View>
        </View>

        {/* Sign Out */}
        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={22} color={theme.colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 56,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  settingValue: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  settingValueRight: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  segmentButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.background,
  },
  segmentButtonLeft: {
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  segmentButtonRight: {},
  segmentButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.error + '40',
    paddingVertical: 16,
    marginTop: 24,
    minHeight: 56,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  signOutText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.error,
  },
});
