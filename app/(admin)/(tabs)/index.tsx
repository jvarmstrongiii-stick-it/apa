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

export default function AdminDashboard() {
  useAuthContext();
  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState('');
  const [counts, setCounts] = useState({
    divisions: 0,
    scheduled: 0,
    in_progress: 0,
    completed: 0,
    finalized: 0,
    disputed: 0,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function fetchSummary() {
        setLoading(true);
        try {
          const { data: league } = await supabase
            .from('leagues')
            .select('id, name')
            .eq('is_active', true)
            .limit(1)
            .single();

          const leagueId = league?.id;

          const [divisions, scheduled, active, completed, finalized, disputed] =
            await Promise.all([
              leagueId
                ? supabase
                    .from('divisions')
                    .select('id', { count: 'exact', head: true })
                    .eq('league_id', leagueId)
                : Promise.resolve({ count: 0 }),
              supabase
                .from('team_matches')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'scheduled'),
              supabase
                .from('team_matches')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'in_progress'),
              supabase
                .from('team_matches')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'completed'),
              supabase
                .from('team_matches')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'finalized'),
              supabase
                .from('team_matches')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'disputed'),
            ]);

          if (!cancelled) {
            setLeagueName(league?.name ?? '');
            setCounts({
              divisions: divisions.count ?? 0,
              scheduled: scheduled.count ?? 0,
              in_progress: active.count ?? 0,
              completed: completed.count ?? 0,
              finalized: finalized.count ?? 0,
              disputed: disputed.count ?? 0,
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
          <Text style={styles.greeting}>League Operator</Text>
          <Text style={styles.leagueName}>
            {loading ? '...' : leagueName || 'No Active League'}
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            title="Divisions"
            value={loading ? '—' : counts.divisions}
            icon="layers-outline"
            color="#4CAF50"
            onPress={() => router.push('/(admin)/(tabs)/divisions')}
          />
          <SummaryCard
            title="Scheduled"
            value={loading ? '—' : counts.scheduled}
            icon="calendar-outline"
            color="#2196F3"
            onPress={() => router.push('/(admin)/(tabs)/matches?filter=scheduled')}
          />
          <SummaryCard
            title="Active"
            value={loading ? '—' : counts.in_progress}
            icon="play-circle-outline"
            color="#FF9800"
            onPress={() => router.push('/(admin)/(tabs)/matches?filter=in_progress')}
          />
          <SummaryCard
            title="Completed"
            value={loading ? '—' : counts.completed}
            icon="checkmark-circle-outline"
            color="#009688"
            onPress={() => router.push('/(admin)/(tabs)/matches?filter=completed')}
          />
          <SummaryCard
            title="Finalized"
            value={loading ? '—' : counts.finalized}
            icon="lock-closed-outline"
            color="#607D8B"
            onPress={() => router.push('/(admin)/(tabs)/matches?filter=finalized')}
          />
          <SummaryCard
            title="Disputed"
            value={loading ? '—' : counts.disputed}
            icon="alert-circle-outline"
            color="#F44336"
            onPress={() => router.push('/(admin)/(tabs)/matches?filter=disputed')}
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
  leagueName: {
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
});
