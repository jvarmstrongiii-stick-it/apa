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

interface QuickActionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

function QuickAction({ title, icon, onPress }: QuickActionProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.quickAction,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={24} color={theme.colors.primary} />
      <Text style={styles.quickActionText}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState({
    activeLeagues: 0,
    pendingMatches: 0,
    openDisputes: 0,
    recentImports: 0,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function fetchSummary() {
        setLoading(true);
        try {
          const [leagues, matches, disputes, imports] = await Promise.all([
            supabase.from('leagues').select('id', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('team_matches').select('id', { count: 'exact', head: true }).neq('match_status', 'finalized'),
            supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
            supabase.from('imports').select('id', { count: 'exact', head: true }),
          ]);

          if (!cancelled) {
            setSummaryData({
              activeLeagues: leagues.count ?? 0,
              pendingMatches: matches.count ?? 0,
              openDisputes: disputes.count ?? 0,
              recentImports: imports.count ?? 0,
            });
          }
        } catch (err) {
          console.error('[AdminDashboard] Failed to fetch summary:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      fetchSummary();
      return () => { cancelled = true; };
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.adminName}>
            {profile?.display_name ?? 'Admin'}
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            title="Active Leagues"
            value={summaryData.activeLeagues}
            icon="trophy"
            color="#4CAF50"
            onPress={() => router.push('/(admin)/(tabs)/leagues')}
          />
          <SummaryCard
            title="Pending Matches"
            value={summaryData.pendingMatches}
            icon="time"
            color="#2196F3"
            onPress={() => router.push('/(admin)/(tabs)/matches')}
          />
          <SummaryCard
            title="Open Disputes"
            value={summaryData.openDisputes}
            icon="alert-circle"
            color="#FF9800"
          />
          <SummaryCard
            title="Recent Imports"
            value={summaryData.recentImports}
            icon="cloud-done"
            color="#9C27B0"
            onPress={() => router.push('/(admin)/(tabs)/import')}
          />
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <View style={styles.quickActions}>
          <QuickAction
            title="Create New League"
            icon="add-circle-outline"
            onPress={() => router.push('/(admin)/(tabs)/leagues/create')}
          />
          <QuickAction
            title="Import Rosters"
            icon="cloud-upload-outline"
            onPress={() => router.push('/(admin)/(tabs)/import')}
          />
          <QuickAction
            title="Review Disputes"
            icon="alert-circle-outline"
            onPress={() => {
              // TODO: Navigate to disputes screen
            }}
          />
          <QuickAction
            title="View All Matches"
            icon="list-outline"
            onPress={() => router.push('/(admin)/(tabs)/matches')}
          />
        </View>
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 16,
  },
  quickActions: {
    gap: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 56,
    gap: 14,
  },
  quickActionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
