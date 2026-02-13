import { useState, useCallback } from 'react';
import {
  FlatList,
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

interface Player {
  id: string;
  name: string;
  skill_level: number;
  games_played: number;
  wins: number;
  losses: number;
  is_captain: boolean;
}

function PlayerCard({ player }: { player: Player }) {
  const winPct =
    player.games_played > 0
      ? Math.round((player.wins / player.games_played) * 100)
      : 0;

  return (
    <View style={styles.playerCard}>
      <View style={styles.playerHeader}>
        <View style={styles.playerNameRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {player.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </Text>
          </View>
          <View style={styles.nameContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.playerName}>{player.name}</Text>
              {player.is_captain && (
                <View style={styles.captainBadge}>
                  <Text style={styles.captainText}>Captain</Text>
                </View>
              )}
            </View>
            <Text style={styles.playerMeta}>
              {player.games_played} games played
            </Text>
          </View>
        </View>
        <View style={styles.skillBadge}>
          <Text style={styles.skillText}>SL {player.skill_level}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{player.wins}</Text>
          <Text style={styles.statLabel}>Wins</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{player.losses}</Text>
          <Text style={styles.statLabel}>Losses</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            {winPct}%
          </Text>
          <Text style={styles.statLabel}>Win %</Text>
        </View>
      </View>
    </View>
  );
}

export default function TeamRosterIndex() {
  const { profile } = useAuthContext();
  const teamId = profile?.team_id;
  const [players, setPlayers] = useState<Player[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRoster = useCallback(async () => {
    if (!teamId) return;

    const { data, error } = await supabase
      .from('team_players')
      .select('id, is_captain, player:players!player_id(id, first_name, last_name, skill_level)')
      .eq('team_id', teamId)
      .is('left_at', null);

    if (error) {
      console.error('Failed to fetch roster:', error.message);
      return;
    }

    const mapped: Player[] = (data ?? []).map((tp: any) => ({
      id: tp.player?.id ?? tp.id,
      name: `${tp.player?.first_name ?? ''} ${tp.player?.last_name ?? ''}`.trim(),
      skill_level: tp.player?.skill_level ?? 0,
      games_played: 0,
      wins: 0,
      losses: 0,
      is_captain: tp.is_captain,
    }));
    setPlayers(mapped);
  }, [teamId]);

  useFocusEffect(
    useCallback(() => {
      fetchRoster();
    }, [fetchRoster])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchRoster();
    } finally {
      setRefreshing(false);
    }
  };

  // Sort: captain first, then by skill level descending
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.is_captain !== b.is_captain) return a.is_captain ? -1 : 1;
    return b.skill_level - a.skill_level;
  });

  const teamSkillTotal = players.reduce((sum, p) => sum + p.skill_level, 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Roster</Text>
        <View style={styles.teamSkillBadge}>
          <Text style={styles.teamSkillText}>
            {players.length} players
          </Text>
        </View>
      </View>

      <FlatList
        data={sortedPlayers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PlayerCard player={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No players on roster</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  teamSkillBadge: {
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  teamSkillText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
    paddingTop: 8,
  },
  playerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  nameContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  captainBadge: {
    backgroundColor: '#FF980020',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  captainText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF9800',
  },
  playerMeta: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  skillBadge: {
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skillText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 14,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
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
