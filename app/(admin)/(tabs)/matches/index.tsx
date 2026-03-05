import { useState, useCallback, useEffect } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/constants/theme';
import { supabase } from '../../../../src/lib/supabase';

type MatchStatus = 'scheduled' | 'lineup_set' | 'in_progress' | 'completed' | 'disputed' | 'finalized';

interface TeamMatch {
  id: string;
  home_team_name: string;
  away_team_name: string;
  scheduled_date: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  league_name: string;
  division_name: string;
}

const STATUS_COLORS: Record<MatchStatus, string> = {
  scheduled: '#2196F3',
  lineup_set: '#9C27B0',
  in_progress: '#FF9800',
  completed: '#4CAF50',
  disputed: '#F44336',
  finalized: '#607D8B',
};

const STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Scheduled',
  lineup_set: 'Lineup Set',
  in_progress: 'In Progress',
  completed: 'Completed',
  disputed: 'Disputed',
  finalized: 'Finalized',
};

const FILTER_OPTIONS: { label: string; value: MatchStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Disputed', value: 'disputed' },
  { label: 'Finalized', value: 'finalized' },
];

function splitDivisionName(name: string): { label: string; session: string } {
  const m = name.match(/^(.*?)\s*((?:Spring|Fall|Summer|Winter)\s+\d{4}.*)$/i);
  if (m) return { label: m[1].trim(), session: m[2].trim() };
  return { label: name, session: '' };
}

function MatchItem({ match }: { match: TeamMatch }) {
  const matchDate = new Date(match.scheduled_date);
  const formattedDate = matchDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const { label: divLabel, session: divSession } = splitDivisionName(match.division_name);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.matchItem,
        pressed && styles.itemPressed,
      ]}
      onPress={() => router.push(`/(admin)/(tabs)/matches/${match.id}`)}
    >
      <View style={styles.matchHeader}>
        <Text style={styles.leagueLabel}>{match.league_name}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: STATUS_COLORS[match.status] + '20' },
          ]}
        >
          <Text
            style={[styles.statusText, { color: STATUS_COLORS[match.status] }]}
          >
            {STATUS_LABELS[match.status]}
          </Text>
        </View>
      </View>

      <View style={styles.teamsRow}>
        <View style={styles.teamBlock}>
          <Text style={styles.teamName}>{match.home_team_name}</Text>
          <Text style={styles.teamLabel}>Home</Text>
        </View>
        <View style={styles.scoreBlock}>
          {match.home_score !== null && match.away_score !== null ? (
            <Text style={styles.scoreText}>
              {match.home_score} - {match.away_score}
            </Text>
          ) : (
            <Text style={styles.vsText}>vs</Text>
          )}
        </View>
        <View style={[styles.teamBlock, styles.teamBlockRight]}>
          <Text style={[styles.teamName, styles.teamNameRight]}>
            {match.away_team_name}
          </Text>
          <Text style={[styles.teamLabel, styles.teamLabelRight]}>Away</Text>
        </View>
      </View>

      <View style={styles.matchFooter}>
        <Text style={styles.dateText}>
          {formattedDate}{divLabel ? `  ·  ${divLabel}` : ''}
        </Text>
        {divSession ? (
          <Text style={styles.divisionText}>{divSession}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function AdminMatchesIndex() {
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [activeFilter, setActiveFilter] = useState<MatchStatus | 'all'>(
    (filterParam as MatchStatus | 'all') ?? 'all'
  );
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (filterParam) setActiveFilter(filterParam as MatchStatus | 'all');
  }, [filterParam]);

  const fetchMatches = useCallback(async () => {
    const { data, error } = await supabase
      .from('team_matches')
      .select('*, home_team:teams!home_team_id(name, division_id), away_team:teams!away_team_id(name), division:divisions!division_id(name, league:leagues!league_id(name))')
      .order('match_date', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to fetch matches:', error.message);
      return;
    }

    const mapped: TeamMatch[] = (data ?? []).map((m: any) => ({
      id: m.id,
      home_team_name: m.home_team?.name ?? 'Unknown',
      away_team_name: m.away_team?.name ?? 'Unknown',
      scheduled_date: m.match_date,
      status: m.status as MatchStatus,
      home_score: m.home_score,
      away_score: m.away_score,
      league_name: m.division?.league?.name ?? '',
      division_name: m.division?.name ?? '',
    }));
    setMatches(mapped);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMatches();
    }, [fetchMatches])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchMatches();
    } finally {
      setRefreshing(false);
    }
  };

  const filteredMatches =
    activeFilter === 'all'
      ? matches
      : matches.filter((m) => m.status === activeFilter);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Matches</Text>
      </View>

      {/* Filter Bar */}
      <FlatList
        horizontal
        data={FILTER_OPTIONS}
        keyExtractor={(item) => item.value}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.filterChip,
              activeFilter === item.value && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(item.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === item.value && styles.filterChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
        contentContainerStyle={styles.filterBar}
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
      />

      <FlatList
        data={filteredMatches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MatchItem match={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="calendar-outline"
              size={48}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.emptyText}>No matches found</Text>
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
  filterList: {
    maxHeight: 52,
  },
  filterBar: {
    paddingHorizontal: 20,
    gap: 8,
    paddingVertical: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 36,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
    paddingTop: 8,
  },
  matchItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemPressed: {
    opacity: 0.8,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  leagueLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  teamBlock: {
    flex: 1,
  },
  teamBlockRight: {
    alignItems: 'flex-end',
  },
  teamName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  teamNameRight: {
    textAlign: 'right',
  },
  teamLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  teamLabelRight: {
    textAlign: 'right',
  },
  scoreBlock: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  vsText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  matchFooter: {
    flexDirection: 'column',
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
  },
  dateText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  divisionText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
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
