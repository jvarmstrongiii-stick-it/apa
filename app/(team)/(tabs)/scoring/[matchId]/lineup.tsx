import { useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../../src/constants/theme';
import { supabase } from '../../../../../src/lib/supabase';
import { useAuthContext } from '../../../../../src/providers/AuthProvider';

interface Player {
  id: string;
  name: string;
  skill_level: number;
  is_available: boolean;
}

const MAX_SKILL_TOTAL = 23; // APA 23-rule for 8-ball
const LINEUP_SIZE = 5;

export default function LineupScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { profile } = useAuthContext();
  const teamId = profile?.team_id;
  const [roster, setRoster] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [putUpOrder, setPutUpOrder] = useState<string[]>([]);

  useEffect(() => {
    const fetchRoster = async () => {
      if (!teamId) return;

      const { data, error } = await supabase
        .from('team_players')
        .select('is_captain, player:players!player_id(id, first_name, last_name, skill_level, is_active)')
        .eq('team_id', teamId)
        .is('left_at', null);

      if (error) {
        console.error('Failed to fetch roster:', error.message);
        return;
      }

      const mapped: Player[] = (data ?? []).map((tp: any) => ({
        id: tp.player?.id ?? '',
        name: `${tp.player?.first_name ?? ''} ${tp.player?.last_name ?? ''}`.trim(),
        skill_level: tp.player?.skill_level ?? 0,
        is_available: tp.player?.is_active ?? true,
      }));
      setRoster(mapped);
    };

    fetchRoster();
  }, [matchId, teamId]);

  const selectedSkillTotal = selectedPlayers.reduce((total, playerId) => {
    const player = roster.find((p) => p.id === playerId);
    return total + (player?.skill_level ?? 0);
  }, 0);

  const isOverLimit = selectedSkillTotal > MAX_SKILL_TOTAL;
  const isLineupComplete = selectedPlayers.length === LINEUP_SIZE;

  const togglePlayer = (playerId: string) => {
    const player = roster.find((p) => p.id === playerId);
    if (!player || !player.is_available) return;

    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers((prev) => prev.filter((id) => id !== playerId));
      setPutUpOrder((prev) => prev.filter((id) => id !== playerId));
    } else {
      if (selectedPlayers.length >= LINEUP_SIZE) {
        Alert.alert('Lineup Full', `You can only select ${LINEUP_SIZE} players.`);
        return;
      }
      setSelectedPlayers((prev) => [...prev, playerId]);
      setPutUpOrder((prev) => [...prev, playerId]);
    }
  };

  const movePlayerUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...putUpOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setPutUpOrder(newOrder);
  };

  const movePlayerDown = (index: number) => {
    if (index === putUpOrder.length - 1) return;
    const newOrder = [...putUpOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setPutUpOrder(newOrder);
  };

  const handleConfirmLineup = async () => {
    if (!isLineupComplete) {
      Alert.alert('Incomplete Lineup', `Please select ${LINEUP_SIZE} players.`);
      return;
    }

    if (isOverLimit) {
      Alert.alert(
        'Skill Level Warning',
        `Your lineup total (${selectedSkillTotal}) exceeds the ${MAX_SKILL_TOTAL}-rule limit. Are you sure you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue Anyway',
            onPress: () => submitLineup(),
          },
        ]
      );
      return;
    }

    submitLineup();
  };

  const submitLineup = async () => {
    try {
      if (!teamId || !matchId) throw new Error('Missing team or match ID');

      // Build lineup insert rows
      const lineupRows = putUpOrder.map((playerId, index) => {
        const player = roster.find((p) => p.id === playerId);
        return {
          team_match_id: matchId,
          team_id: teamId,
          player_id: playerId,
          position: index + 1,
          skill_level_at_time: player?.skill_level ?? 0,
        };
      });

      // Delete any existing lineup for this team+match, then insert new
      await supabase
        .from('lineups')
        .delete()
        .eq('team_match_id', matchId)
        .eq('team_id', teamId);

      const { error } = await supabase.from('lineups').insert(lineupRows);
      if (error) throw error;

      // Update match status to lineup_set if it was scheduled
      await supabase
        .from('team_matches')
        .update({ status: 'lineup_set' })
        .eq('id', matchId)
        .eq('status', 'scheduled');

      router.push(`/(team)/(tabs)/scoring/${matchId}/0`);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to submit lineup. Please try again.');
    }
  };

  const renderPlayer = ({ item }: { item: Player }) => {
    const isSelected = selectedPlayers.includes(item.id);

    return (
      <Pressable
        style={[
          styles.playerItem,
          isSelected && styles.playerSelected,
          !item.is_available && styles.playerUnavailable,
        ]}
        onPress={() => togglePlayer(item.id)}
        disabled={!item.is_available}
      >
        <View style={styles.playerCheckbox}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={28} color={theme.colors.primary} />
          ) : (
            <Ionicons
              name="ellipse-outline"
              size={28}
              color={item.is_available ? theme.colors.textSecondary : theme.colors.border}
            />
          )}
        </View>
        <View style={styles.playerInfo}>
          <Text
            style={[
              styles.playerName,
              !item.is_available && styles.playerNameUnavailable,
            ]}
          >
            {item.name}
          </Text>
          {!item.is_available && (
            <Text style={styles.unavailableLabel}>Unavailable</Text>
          )}
        </View>
        <View style={styles.skillBadge}>
          <Text style={styles.skillText}>SL {item.skill_level}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Set Lineup</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Skill Level Counter */}
      <View style={[styles.skillCounter, isOverLimit && styles.skillCounterError]}>
        <View style={styles.skillCounterContent}>
          <Text style={styles.skillCounterLabel}>Skill Level Total</Text>
          <Text
            style={[
              styles.skillCounterValue,
              isOverLimit && styles.skillCounterValueError,
            ]}
          >
            {selectedSkillTotal} / {MAX_SKILL_TOTAL}
          </Text>
        </View>
        <View style={styles.playerCountContent}>
          <Text style={styles.skillCounterLabel}>Players</Text>
          <Text style={styles.skillCounterValue}>
            {selectedPlayers.length} / {LINEUP_SIZE}
          </Text>
        </View>
        {isOverLimit && (
          <View style={styles.warningRow}>
            <Ionicons name="warning" size={16} color={theme.colors.error} />
            <Text style={styles.warningText}>
              Exceeds {MAX_SKILL_TOTAL}-rule limit!
            </Text>
          </View>
        )}
      </View>

      {/* Put-up Order (shown when lineup complete) */}
      {isLineupComplete && (
        <View style={styles.orderSection}>
          <Text style={styles.orderTitle}>Put-Up Order</Text>
          {putUpOrder.map((playerId, index) => {
            const player = roster.find((p) => p.id === playerId);
            if (!player) return null;
            return (
              <View key={playerId} style={styles.orderRow}>
                <Text style={styles.orderNumber}>{index + 1}</Text>
                <Text style={styles.orderPlayerName}>{player.name}</Text>
                <Text style={styles.orderSkill}>SL {player.skill_level}</Text>
                <View style={styles.orderActions}>
                  <Pressable
                    onPress={() => movePlayerUp(index)}
                    style={styles.orderButton}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="chevron-up"
                      size={20}
                      color={index === 0 ? theme.colors.border : theme.colors.text}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => movePlayerDown(index)}
                    style={styles.orderButton}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={
                        index === putUpOrder.length - 1
                          ? theme.colors.border
                          : theme.colors.text
                      }
                    />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Roster List */}
      <FlatList
        data={roster}
        keyExtractor={(item) => item.id}
        renderItem={renderPlayer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.rosterLabel}>Select Players from Roster</Text>
        }
      />

      {/* Confirm Button */}
      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && styles.buttonPressed,
            (!isLineupComplete || isOverLimit) && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirmLineup}
          disabled={!isLineupComplete}
        >
          <Text style={styles.confirmButtonText}>Confirm Lineup</Text>
        </Pressable>
      </View>
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
    paddingVertical: 16,
  },
  headerButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  skillCounter: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillCounterError: {
    borderColor: theme.colors.error,
  },
  skillCounterContent: {
    flex: 1,
  },
  playerCountContent: {
    alignItems: 'flex-end',
  },
  skillCounterLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  skillCounterValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  skillCounterValueError: {
    color: theme.colors.error,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginTop: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.error,
  },
  orderSection: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  orderNumber: {
    width: 24,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
    textAlign: 'center',
  },
  orderPlayerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  orderSkill: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 4,
  },
  orderButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 6,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
    minHeight: 56,
  },
  playerSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  playerUnavailable: {
    opacity: 0.4,
  },
  playerCheckbox: {
    minWidth: 28,
    minHeight: 28,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  playerNameUnavailable: {
    color: theme.colors.textSecondary,
  },
  unavailableLabel: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 2,
  },
  skillBadge: {
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skillText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
