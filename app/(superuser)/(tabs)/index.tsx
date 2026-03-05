import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../src/constants/theme';
import { useAuthContext } from '../../../src/providers/AuthProvider';
import { supabase } from '../../../src/lib/supabase/client';

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress?: () => void;
}

function SummaryCard({ title, value, icon, color, onPress }: SummaryCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.summaryCard,
        pressed && onPress && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
    </Pressable>
  );
}

export default function SuperuserDashboard() {
  const { profile, signOut } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeLeagues: 0,
    loAccounts: 0,
    totalTeams: 0,
    totalDivisions: 0,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function fetchStats() {
        setLoading(true);
        try {
          const [leagues, los, teams, divisions] = await Promise.all([
            supabase.from('leagues').select('id', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'lo'),
            supabase.from('teams').select('id', { count: 'exact', head: true }),
            supabase.from('divisions').select('id', { count: 'exact', head: true }),
          ]);

          if (!cancelled) {
            setStats({
              activeLeagues: leagues.count ?? 0,
              loAccounts: los.count ?? 0,
              totalTeams: teams.count ?? 0,
              totalDivisions: divisions.count ?? 0,
            });
          }
        } catch (err) {
          console.error('[SuperuserDashboard] Failed to fetch stats:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      fetchStats();
      return () => { cancelled = true; };
    }, [])
  );

  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.display_name || 'Admin'
    : 'Admin';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.greeting}>Admin</Text>
              <Text style={styles.adminName} numberOfLines={1}>{displayName}</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                style={({ pressed }) => [styles.switchButton, pressed && { opacity: 0.7 }]}
                onPress={async () => { await signOut(); router.replace('/(auth)/login'); }}
                hitSlop={8}
              >
                <Ionicons name="swap-horizontal-outline" size={18} color={theme.colors.textSecondary} />
                <Text style={styles.switchButtonText}>Switch User</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.7 }]}
                onPress={async () => { await signOut(); router.replace('/(auth)/admin-login'); }}
                hitSlop={8}
              >
                <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
              </Pressable>
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : (
          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Active Leagues"
              value={stats.activeLeagues}
              icon="trophy"
              color="#4CAF50"
              onPress={() => router.push('/(superuser)/(tabs)/leagues')}
            />
            <SummaryCard
              title="LO Accounts"
              value={stats.loAccounts}
              icon="people"
              color="#2196F3"
              onPress={() => router.push('/(superuser)/(tabs)/accounts')}
            />
            <SummaryCard
              title="Total Teams"
              value={stats.totalTeams}
              icon="shirt"
              color="#FF9800"
            />
            <SummaryCard
              title="Total Divisions"
              value={stats.totalDivisions}
              icon="layers"
              color="#9C27B0"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    marginTop: 16,
    marginBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  switchButtonText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  signOutButton: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.error + '40',
  },
  greeting: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  adminName: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  loader: {
    marginTop: 48,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 130,
  },
  cardPressed: {
    opacity: 0.8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
});
