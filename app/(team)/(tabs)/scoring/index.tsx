import { useState, useCallback } from 'react';
import {
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
  scheduled: 'Set Lineup',
  lineup_set: 'Start Scoring',
  in_progress: 'Continue Scoring',
};

// TODO: Replace with actual API data
const PLACEHOLDER_SCORABLE: ScorableMatch[] = [
  {
    id: 'match-1',
    opponent_name: 'Cue Ballers',
    scheduled_date: '2026-02-03T19:00:00Z',
    status: 'scheduled',
    is_home: true,
    location: "Sharkey's Billiards",
    game_format: '8-ball',
    current_individual_match: null,
  },
  {
    id: 'match-2',
    opponent_name: 'Break Masters',
    scheduled_date: '2026-02-03T19:30:00Z',
    status: 'in_progress',
    is_home: false,
    location: "Fast Eddie's",
    game_format: '9-ball',
    current_individual_match: 3,
  },
];

function ScorableMatchItem({ match }: { match: ScorableMatch }) {
  const matchDate = new Date(match.scheduled_date);

  const handlePress = () => {
    switch (match.status) {
      case 'scheduled':
        router.push(`/(team)/(tabs)/scoring/${match.id}/lineup`);
        break;
      case 'lineup_set':
        router.push(`/(team)/(tabs)/scoring/${match.id}/0`);
        break;
      case 'in_progress':
        router.push(
          `/(team)/(tabs)/scoring/${match.id}/${match.current_individual_match ?? 0}`
        );
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
    </Pressable>
  );
}

export default function TeamScoringIndex() {
  const [matches, setMatches] = useState<ScorableMatch[]>(PLACEHOLDER_SCORABLE);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // TODO: Fetch scorable matches from API
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // TODO: Fetch scorable matches from API
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Scoring</Text>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ScorableMatchItem match={item} />}
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
});
