import { useState, useCallback, useRef } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/constants/theme';
import { supabase } from '../../../../src/lib/supabase';
import { useAuthContext } from '../../../../src/providers/AuthProvider';
import { CoinFlipModal } from '../../../../src/components/CoinFlipModal';
import { flushPendingWrites, getPendingMatchIds } from '../../../../src/lib/pendingWrites';

type ScorableStatus = 'scheduled' | 'lineup_set' | 'in_progress';

interface ScorableMatch {
  id: string;
  opponent_name: string;
  scheduled_date: string;
  status: ScorableStatus;
  is_home: boolean;
  location: string;
  game_format: '8-ball' | '9-ball';
  current_individual_match: number | null; // null if not started
  individual_match_ids: string[]; // UUIDs of individual_matches rows (for pending-write badge)
  scorekeeper_count: 1 | 2;
}

const STATUS_COLORS: Record<ScorableStatus, string> = {
  scheduled: '#2196F3',
  lineup_set: '#9C27B0',
  in_progress: '#FF9800',
};

const STATUS_LABELS: Record<ScorableStatus, string> = {
  scheduled: 'Scheduled',
  lineup_set: 'Lineup Set',
  in_progress: 'In Progress',
};

const ACTION_LABELS: Record<ScorableStatus, string> = {
  scheduled: 'Score Match',
  lineup_set: 'Start Scoring',
  in_progress: 'Continue Scoring',
};

function ScorableMatchItem({
  match,
  hasPending,
  onScheduledPress,
  onResetPress,
}: {
  match: ScorableMatch;
  hasPending: boolean;
  onScheduledPress: (matchId: string, isHome: boolean) => void;
  onResetPress: (matchId: string) => void;
}) {
  const handleFollowPress = () => {
    // Follow goes to progress screen so follower can pick which individual match to observe
    router.push(`/(team)/(tabs)/scoring/${match.id}/progress`);
  };
  const matchDate = new Date(match.scheduled_date);

  const handlePress = () => {
    switch (match.status) {
      case 'scheduled':
        onScheduledPress(match.id, match.is_home);
        break;
      case 'lineup_set':
        router.push(`/(team)/(tabs)/scoring/${match.id}/0`);
        break;
      case 'in_progress':
        router.push(`/(team)/(tabs)/scoring/${match.id}/progress`);
        break;
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.matchItem,
        pressed && styles.itemPressed,
      ]}
      onPress={handlePress}
    >
      <View style={styles.matchHeader}>
        <View style={styles.formatBadge}>
          <Text style={styles.formatText}>{match.game_format}</Text>
        </View>
        <View style={styles.headerRight}>
          {hasPending && (
            <View style={styles.pendingBadge}>
              <Ionicons name="cloud-upload-outline" size={12} color="#F59E0B" />
              <Text style={styles.pendingBadgeText}>Sync pending</Text>
            </View>
          )}
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
      </View>

      <Text style={styles.opponentName}>
        {match.is_home ? 'vs' : '@'} {match.opponent_name}
      </Text>

      <View style={styles.matchDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.detailText}>
            {matchDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
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

      {match.status === 'in_progress' && match.current_individual_match !== null && (
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(match.current_individual_match / 5) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Match {match.current_individual_match} of 5
          </Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.actionButton,
          pressed && styles.actionButtonPressed,
        ]}
        onPress={handlePress}
      >
        <Text style={styles.actionButtonText}>
          {ACTION_LABELS[match.status]}
        </Text>
        <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
      </Pressable>

      {/* Follow Match button — second scorekeeper on 2-scorekeeper leagues */}
      {match.status === 'in_progress' && match.scorekeeper_count === 2 && (
        <Pressable style={styles.followButton} onPress={handleFollowPress}>
          <Ionicons name="eye-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.followButtonText}>Follow Match</Text>
        </Pressable>
      )}

      {match.status !== 'scheduled' && (
        <Pressable style={styles.resetButton} onPress={() => onResetPress(match.id)}>
          <Text style={styles.resetButtonText}>Reset Match</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export default function TeamScoringIndex() {
  const { profile } = useAuthContext();
  const teamId = profile?.team_id;
  const [matches, setMatches] = useState<ScorableMatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingMatchIds, setPendingMatchIds] = useState<Set<string>>(new Set());
  const [coinFlipVisible, setCoinFlipVisible] = useState(false);
  const pendingMatchId = useRef<string | null>(null);
  const pendingIsHome = useRef<boolean>(true);

  const handleScheduledPress = (matchId: string, isHome: boolean) => {
    pendingMatchId.current = matchId;
    pendingIsHome.current = isHome;
    setCoinFlipVisible(true);
  };

  const handleResetMatch = (matchId: string) => {
    Alert.alert(
      'Reset Match',
      'This will delete all scoring data and return the match to Scheduled. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('individual_matches').delete().eq('team_match_id', matchId);
            await supabase
              .from('team_matches')
              .update({ status: 'scheduled', home_score: 0, away_score: 0, finalized_by: null, finalized_at: null })
              .eq('id', matchId);
            fetchScorableMatches();
          },
        },
      ]
    );
  };

  const handleCoinFlipReady = (result: { firstMatch: boolean; ourTeamPutsUpFirst: boolean | null }) => {
    setCoinFlipVisible(false);
    const matchId = pendingMatchId.current;
    const isHome = pendingIsHome.current;
    pendingMatchId.current = null;
    if (!matchId) return;

    if (result.firstMatch) {
      const putUpTeam =
        result.ourTeamPutsUpFirst === isHome ? 'home' : 'away';
      // Go through catchup wizard first — handles "starting mid-match" case
      router.push(
        `/(team)/(tabs)/scoring/${matchId}/catchup?putUpTeam=${putUpTeam}`
      );
    } else {
      router.push(`/(team)/(tabs)/scoring/${matchId}/resume`);
    }
  };

  const fetchScorableMatches = useCallback(async () => {
    if (!teamId) return;

    const { data, error } = await supabase
      .from('team_matches')
      .select('id, match_date, status, home_team_id, away_team_id, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name), division:divisions!division_id(location, league:leagues!league_id(game_format, scorekeeper_count)), individual_matches(id, match_order)')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .in('status', ['scheduled', 'lineup_set', 'in_progress'])
      .order('match_date', { ascending: true });

    if (error) {
      console.error('Failed to fetch scorable matches:', error.message);
      return;
    }

    const mapped: ScorableMatch[] = (data ?? []).map((m: any) => {
      const isHome = m.home_team_id === teamId;
      const gameFormat = m.division?.league?.game_format === 'nine_ball' ? '9-ball' : '8-ball';
      const individualMatches = m.individual_matches ?? [];
      const currentMatch = individualMatches.length > 0
        ? Math.max(...individualMatches.map((im: any) => im.match_order))
        : null;

      return {
        id: m.id,
        opponent_name: isHome ? (m.away_team?.name ?? 'Unknown') : (m.home_team?.name ?? 'Unknown'),
        scheduled_date: m.match_date,
        status: m.status as ScorableStatus,
        is_home: isHome,
        location: m.division?.location ?? '',
        game_format: gameFormat as '8-ball' | '9-ball',
        current_individual_match: currentMatch,
        individual_match_ids: individualMatches.map((im: any) => im.id),
        scorekeeper_count: (m.division?.league?.scorekeeper_count ?? 1) as 1 | 2,
      };
    });
    setMatches(mapped);
  }, [teamId]);

  useFocusEffect(
    useCallback(() => {
      // Flush any queued offline writes, then refresh the list and pending badge state
      flushPendingWrites().finally(() => {
        setPendingMatchIds(getPendingMatchIds());
      });
      fetchScorableMatches();
    }, [fetchScorableMatches])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchScorableMatches();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <CoinFlipModal visible={coinFlipVisible} onReady={handleCoinFlipReady} onCancel={() => setCoinFlipVisible(false)} />
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Scoring</Text>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ScorableMatchItem
            match={item}
            hasPending={item.individual_match_ids.some(id => pendingMatchIds.has(id))}
            onScheduledPress={handleScheduledPress}
            onResetPress={handleResetMatch}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="create-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No matches to score</Text>
            <Text style={styles.emptySubtext}>
              Matches will appear here when they are ready to be scored.
            </Text>
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
    gap: 14,
    paddingTop: 8,
  },
  matchItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemPressed: {
    opacity: 0.9,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  formatBadge: {
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  formatText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  opponentName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },
  matchDetails: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
    marginBottom: 14,
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 52,
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary + '40',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  resetButtonText: {
    fontSize: 13,
    color: '#F44336',
    fontWeight: '500',
  },
});
