import { useState, useCallback } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/constants/theme';
import { supabase } from '../../../../src/lib/supabase';
import { useAuthContext } from '../../../../src/providers/AuthProvider';

type MatchStatus = 'scheduled' | 'lineup_set' | 'in_progress' | 'completed' | 'finalized';

interface ScheduleMatch {
  id: string;
  opponent_name: string;
  scheduled_date: string;
  status: MatchStatus;
  is_home: boolean;
  home_score: number | null;
  away_score: number | null;
  location: string;
}

const STATUS_COLORS: Record<MatchStatus, string> = {
  scheduled: '#2196F3',
  lineup_set: '#9C27B0',
  in_progress: '#FF9800',
  completed: '#4CAF50',
  finalized: '#607D8B',
};

const STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Scheduled',
  lineup_set: 'Lineup Set',
  in_progress: 'In Progress',
  completed: 'Completed',
  finalized: 'Finalized',
};

function ScheduleItem({ match }: { match: ScheduleMatch }) {
  const matchDate = new Date(match.scheduled_date);
  const isPast = matchDate < new Date();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.matchItem,
        pressed && styles.itemPressed,
        isPast && styles.pastMatch,
      ]}
    >
      <View style={styles.dateBlock}>
        <Text style={styles.dateMonth}>
          {matchDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
        </Text>
        <Text style={styles.dateDay}>
          {matchDate.getDate()}
        </Text>
      </View>

      <View style={styles.matchContent}>
        <View style={styles.matchHeaderRow}>
          <Text style={styles.opponentName}>
            {match.is_home ? 'vs' : '@'} {match.opponent_name}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: STATUS_COLORS[match.status] + '20' },
            ]}
          >
            <Text style={[styles.statusText, { color: STATUS_COLORS[match.status] }]}>
              {STATUS_LABELS[match.status]}
            </Text>
          </View>
        </View>

        <View style={styles.matchDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.detailText}>
              {matchDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.detailText}>{match.location}</Text>
          </View>
        </View>

        {match.home_score !== null && match.away_score !== null && (
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Score:</Text>
            <Text style={styles.scoreValue}>
              {match.home_score} - {match.away_score}
            </Text>
            {match.is_home ? (
              match.home_score > match.away_score ? (
                <Text style={styles.winLabel}>W</Text>
              ) : (
                <Text style={styles.lossLabel}>L</Text>
              )
            ) : match.away_score > match.home_score ? (
              <Text style={styles.winLabel}>W</Text>
            ) : (
              <Text style={styles.lossLabel}>L</Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function TeamScheduleIndex() {
  const { profile } = useAuthContext();
  const teamId = profile?.team_id;
  const [schedule, setSchedule] = useState<ScheduleMatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSchedule = useCallback(async () => {
    if (!teamId) return;

    const { data, error } = await supabase
      .from('team_matches')
      .select('id, match_date, status, home_score, away_score, home_team_id, away_team_id, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name), division:divisions!division_id(location)')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('match_date', { ascending: true });

    if (error) {
      console.error('Failed to fetch schedule:', error.message);
      return;
    }

    const mapped: ScheduleMatch[] = (data ?? []).map((m: any) => {
      const isHome = m.home_team_id === teamId;
      return {
        id: m.id,
        opponent_name: isHome ? (m.away_team?.name ?? 'Unknown') : (m.home_team?.name ?? 'Unknown'),
        scheduled_date: m.match_date,
        status: m.status as MatchStatus,
        is_home: isHome,
        home_score: m.home_score,
        away_score: m.away_score,
        location: m.division?.location ?? '',
      };
    });
    setSchedule(mapped);
  }, [teamId]);

  useFocusEffect(
    useCallback(() => {
      fetchSchedule();
    }, [fetchSchedule])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchSchedule();
    } finally {
      setRefreshing(false);
    }
  };

  // Sort: upcoming first (by date), then past
  const sortedSchedule = [...schedule].sort(
    (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Schedule</Text>
      </View>

      <FlatList
        data={sortedSchedule}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ScheduleItem match={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No matches scheduled</Text>
          </View>
        }
      />
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
    paddingTop: 8,
  },
  matchItem: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 14,
  },
  itemPressed: {
    opacity: 0.8,
  },
  pastMatch: {
    opacity: 0.7,
  },
  dateBlock: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 10,
    paddingVertical: 8,
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  matchContent: {
    flex: 1,
    gap: 6,
  },
  matchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  opponentName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  matchDetails: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  scoreLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  winLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
    backgroundColor: '#4CAF5020',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lossLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F44336',
    backgroundColor: '#F4433620',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 64,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
