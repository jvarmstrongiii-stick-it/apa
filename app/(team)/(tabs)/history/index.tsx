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

// TODO: Replace with actual API data
const PLACEHOLDER_HISTORY: HistoryMatch[] = [
  {
    id: '1',
    opponent_name: 'Side Pockets',
    match_date: '2026-01-27T19:00:00Z',
    is_home: true,
    home_score: 13,
    away_score: 7,
    result: 'win',
    game_format: '8-ball',
  },
  {
    id: '2',
    opponent_name: 'Masse Effect',
    match_date: '2026-01-20T19:00:00Z',
    is_home: false,
    home_score: 9,
    away_score: 11,
    result: 'win',
    game_format: '8-ball',
  },
  {
    id: '3',
    opponent_name: 'Break Masters',
    match_date: '2026-01-13T19:00:00Z',
    is_home: true,
    home_score: 8,
    away_score: 12,
    result: 'loss',
    game_format: '8-ball',
  },
  {
    id: '4',
    opponent_name: 'Scratch That',
    match_date: '2026-01-06T19:00:00Z',
    is_home: false,
    home_score: 10,
    away_score: 10,
    result: 'tie',
    game_format: '8-ball',
  },
  {
    id: '5',
    opponent_name: 'Cue Ballers',
    match_date: '2025-12-30T19:00:00Z',
    is_home: true,
    home_score: 14,
    away_score: 6,
    result: 'win',
    game_format: '8-ball',
  },
];

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
  const [history, setHistory] = useState<HistoryMatch[]>(PLACEHOLDER_HISTORY);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // TODO: Fetch match history from API
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // TODO: Fetch match history from API
      await new Promise((resolve) => setTimeout(resolve, 500));
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
