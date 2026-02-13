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

interface HistoryMatch {
  id: string;
  opponent_name: string;
  match_date: string;
  is_home: boolean;
  home_score: number;
  away_score: number;
  result: 'win' | 'loss' | 'tie';
  game_format: '8-ball' | '9-ball';
}

const RESULT_COLORS = {
  win: '#4CAF50',
  loss: '#F44336',
  tie: '#FF9800',
};

const RESULT_LABELS = {
  win: 'W',
  loss: 'L',
  tie: 'T',
};

function HistoryItem({ match }: { match: HistoryMatch }) {
  const matchDate = new Date(match.match_date);

  // Determine our score vs opponent score
  const ourScore = match.is_home ? match.home_score : match.away_score;
  const theirScore = match.is_home ? match.away_score : match.home_score;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.historyItem,
        pressed && styles.itemPressed,
      ]}
      onPress={() => {
        // TODO: Navigate to full scorecard view
      }}
    >
      <View
        style={[
          styles.resultStripe,
          { backgroundColor: RESULT_COLORS[match.result] },
        ]}
      />
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <View>
            <Text style={styles.opponentName}>
              {match.is_home ? 'vs' : '@'} {match.opponent_name}
            </Text>
            <Text style={styles.dateText}>
              {matchDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.scoreContainer}>
            <View
              style={[
                styles.resultBadge,
                { backgroundColor: RESULT_COLORS[match.result] + '20' },
              ]}
            >
              <Text
                style={[
                  styles.resultText,
                  { color: RESULT_COLORS[match.result] },
                ]}
              >
                {RESULT_LABELS[match.result]}
              </Text>
            </View>
            <Text style={styles.scoreText}>
              {ourScore} - {theirScore}
            </Text>
          </View>
        </View>

        <View style={styles.itemFooter}>
          <View style={styles.formatRow}>
            <Ionicons
              name="game-controller-outline"
              size={14}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.formatText}>{match.game_format}</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.colors.textSecondary}
          />
        </View>
      </View>
    </Pressable>
  );
}

export default function TeamHistoryIndex() {
  const { profile } = useAuthContext();
  const teamId = profile?.team_id;
  const [history, setHistory] = useState<HistoryMatch[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!teamId) return;

    const { data, error } = await supabase
      .from('team_matches')
      .select('id, match_date, status, home_score, away_score, home_team_id, away_team_id, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name), division:divisions!division_id(league:leagues!league_id(game_format))')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .in('status', ['completed', 'finalized'])
      .order('match_date', { ascending: false });

    if (error) {
      console.error('Failed to fetch history:', error.message);
      return;
    }

    const mapped: HistoryMatch[] = (data ?? []).map((m: any) => {
      const isHome = m.home_team_id === teamId;
      const ourScore = isHome ? (m.home_score ?? 0) : (m.away_score ?? 0);
      const theirScore = isHome ? (m.away_score ?? 0) : (m.home_score ?? 0);
      const gameFormat = m.division?.league?.game_format === 'nine_ball' ? '9-ball' : '8-ball';

      let result: 'win' | 'loss' | 'tie';
      if (ourScore > theirScore) result = 'win';
      else if (ourScore < theirScore) result = 'loss';
      else result = 'tie';

      return {
        id: m.id,
        opponent_name: isHome ? (m.away_team?.name ?? 'Unknown') : (m.home_team?.name ?? 'Unknown'),
        match_date: m.match_date,
        is_home: isHome,
        home_score: m.home_score ?? 0,
        away_score: m.away_score ?? 0,
        result,
        game_format: gameFormat as '8-ball' | '9-ball',
      };
    });
    setHistory(mapped);
  }, [teamId]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchHistory();
    } finally {
      setRefreshing(false);
    }
  };

  const wins = history.filter((m) => m.result === 'win').length;
  const losses = history.filter((m) => m.result === 'loss').length;
  const ties = history.filter((m) => m.result === 'tie').length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      {/* Season Record Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{wins}</Text>
          <Text style={styles.summaryLabel}>Wins</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#F44336' }]}>{losses}</Text>
          <Text style={styles.summaryLabel}>Losses</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#FF9800' }]}>{ties}</Text>
          <Text style={styles.summaryLabel}>Ties</Text>
        </View>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryItem match={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No match history</Text>
            <Text style={styles.emptySubtext}>
              Completed matches will appear here.
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
  summaryCard: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  summaryLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.border,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemPressed: {
    opacity: 0.8,
  },
  resultStripe: {
    width: 4,
  },
  itemContent: {
    flex: 1,
    padding: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  opponentName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  scoreContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  resultBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  resultText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  formatText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
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
  },
});
