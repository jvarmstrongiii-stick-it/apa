import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/constants/theme';
import { supabase } from '../../../../src/lib/supabase';
import { useAuthContext } from '../../../../src/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Player {
  id: string;
  teamPlayerId: string;
  name: string;
  skill_level: number;
  games_played: number;
  wins: number;
  losses: number;
  is_captain: boolean;
}

interface LookupResult {
  id: string;
  first_name: string;
  last_name: string;
  member_number: string;
  skill_level: number | null;
  eight_ball_sl: number | null;
  nine_ball_sl: number | null;
}

// ---------------------------------------------------------------------------
// PlayerCard
// ---------------------------------------------------------------------------

function PlayerCard({
  player,
  editMode,
  isMe,
  onRemove,
  onToggleCaptain,
}: {
  player: Player;
  editMode: boolean;
  isMe: boolean;
  onRemove: (player: Player) => void;
  onToggleCaptain: (player: Player) => void;
}) {
  const winPct =
    player.games_played > 0
      ? Math.round((player.wins / player.games_played) * 100)
      : 0;

  return (
    <View style={styles.playerCard}>
      <View style={styles.playerHeader}>
        {editMode && !isMe && (
          <Pressable
            style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.6 }]}
            onPress={() => onRemove(player)}
          >
            <Ionicons name="remove-circle-outline" size={26} color={theme.colors.error} />
          </Pressable>
        )}
        <View style={styles.playerNameRow}>
          <View style={[styles.avatarCircle, isMe && styles.avatarCircleMe]}>
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
              {isMe && <Text style={styles.meLabel}>(You)</Text>}
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

      {/* Co-captain toggle — only shown in edit mode for non-self players */}
      {editMode && !isMe && (
        <Pressable
          style={({ pressed }) => [
            styles.captainToggleBtn,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => onToggleCaptain(player)}
        >
          <Ionicons
            name={player.is_captain ? 'star' : 'star-outline'}
            size={15}
            color={player.is_captain ? '#FF9800' : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.captainToggleText,
              player.is_captain && { color: '#FF9800' },
            ]}
          >
            {player.is_captain ? 'Remove Captain' : 'Make Captain'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// AddPlayerModal
// ---------------------------------------------------------------------------

function AddPlayerModal({
  visible,
  teamId,
  divisionId,
  gameFormat,
  onClose,
  onAdded,
}: {
  visible: boolean;
  teamId: string;
  divisionId: string | null;
  gameFormat: 'eight_ball' | 'nine_ball' | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [memberNumber, setMemberNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [skillLevel, setSkillLevel] = useState('3');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const reset = () => {
    setMemberNumber('');
    setFirstName('');
    setLastName('');
    setSkillLevel('3');
    setLookupResult(null);
    setIsLooking(false);
    setIsAdding(false);
    setError(null);
    setNotFound(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleLookup = async () => {
    const num = memberNumber.trim();
    if (!num) {
      setError('Enter a member number to look up.');
      return;
    }

    setIsLooking(true);
    setError(null);
    setNotFound(false);
    setLookupResult(null);
    setFirstName('');
    setLastName('');
    setSkillLevel('3');

    const { data, error: rpcError } = await supabase.rpc('find_player_by_member_number', {
      p_member_number: num,
    });

    setIsLooking(false);

    if (rpcError) {
      setError('Lookup failed. Please try again.');
      return;
    }

    if (!data || data.length === 0) {
      setNotFound(true);
      return;
    }

    const found = data[0] as LookupResult;
    setLookupResult(found);
    setFirstName(found.first_name);
    setLastName(found.last_name);

    // Use format-specific SL if available, fall back to skill_level
    const sl =
      gameFormat === 'nine_ball'
        ? (found.nine_ball_sl ?? found.skill_level ?? 3)
        : (found.eight_ball_sl ?? found.skill_level ?? 3);
    setSkillLevel(String(sl));
  };

  const handleAdd = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const sl = parseInt(skillLevel, 10);
    const mn = memberNumber.trim();

    if (!fn || !ln) {
      setError('First and last name are required.');
      return;
    }
    if (isNaN(sl) || sl < 1 || sl > 9) {
      setError('Skill level must be between 1 and 9.');
      return;
    }

    setIsAdding(true);
    setError(null);

    // Division conflict check
    if (lookupResult?.id && divisionId) {
      const { data: conflictTeam } = await supabase.rpc('check_division_conflict', {
        p_player_id: lookupResult.id,
        p_team_id:   teamId,
      });
      if (conflictTeam) {
        setError(
          `This player is already on ${conflictTeam} in this division. ` +
          `Players cannot be on two teams in the same division.`
        );
        setIsAdding(false);
        return;
      }
    }

    let playerId: string | null = lookupResult?.id ?? null;

    // If no existing player record, create one
    if (!playerId) {
      const insertData: Record<string, unknown> = {
        first_name:    fn,
        last_name:     ln,
        member_number: mn || `TMP-${Date.now()}`,
        skill_level:   sl,
        game_format:   gameFormat ?? 'eight_ball',
        is_active:     true,
      };
      if (gameFormat === 'nine_ball') insertData.nine_ball_sl = sl;
      else insertData.eight_ball_sl = sl;

      const { data: newPlayer, error: insertError } = await supabase
        .from('players')
        .insert(insertData)
        .select('id')
        .single();

      if (insertError || !newPlayer) {
        setError('Could not create player record. Please try again.');
        setIsAdding(false);
        return;
      }
      playerId = newPlayer.id;
    }

    // Upsert team_players (handles re-joining a player who previously left)
    const { error: upsertError } = await supabase
      .from('team_players')
      .upsert(
        {
          team_id:     teamId,
          player_id:   playerId,
          skill_level: sl,
          left_at:     null,  // clear any previous left_at
          joined_at:   new Date().toISOString(),
        },
        { onConflict: 'team_id,player_id' },
      );

    if (upsertError) {
      setError('Could not add player to roster. Please try again.');
      setIsAdding(false);
      return;
    }

    reset();
    onAdded();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalOverlay} onPress={handleClose}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add Player</Text>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Member number + lookup */}
            <Text style={styles.fieldLabel}>APA Member # (5 digits)</Text>
            <View style={styles.lookupRow}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={memberNumber}
                onChangeText={setMemberNumber}
                placeholder="e.g. 12345"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                maxLength={10}
                returnKeyType="search"
                onSubmitEditing={handleLookup}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.lookupBtn,
                  pressed && { opacity: 0.8 },
                  isLooking && { opacity: 0.5 },
                ]}
                onPress={handleLookup}
                disabled={isLooking}
              >
                {isLooking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.lookupBtnText}>Look Up</Text>
                )}
              </Pressable>
            </View>

            {notFound && (
              <View style={styles.notFoundBox}>
                <Ionicons name="information-circle-outline" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.notFoundText}>
                  Not found in system — enter details manually.
                </Text>
              </View>
            )}

            {(lookupResult || notFound) && (
              <>
                {lookupResult && (
                  <View style={styles.foundBox}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
                    <Text style={styles.foundText}>Player found — details auto-filled below.</Text>
                  </View>
                )}

                <Text style={styles.fieldLabel}>First Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="words"
                />

                <Text style={styles.fieldLabel}>Last Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="words"
                />

                <Text style={styles.fieldLabel}>Skill Level (1–9)</Text>
                <TextInput
                  style={styles.textInput}
                  value={skillLevel}
                  onChangeText={setSkillLevel}
                  keyboardType="number-pad"
                  maxLength={1}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.addConfirmBtn,
                    pressed && !isAdding && { opacity: 0.85 },
                    isAdding && { opacity: 0.5 },
                  ]}
                  onPress={handleAdd}
                  disabled={isAdding}
                >
                  {isAdding ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.addConfirmBtnText}>Add to Roster</Text>
                  )}
                </Pressable>
              </>
            )}

            <Pressable style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function TeamRosterIndex() {
  const { profile, isCaptain } = useAuthContext();
  const teamId = profile?.team_id;
  const myPlayerId = (profile as any)?.player_id ?? null;

  const [players, setPlayers] = useState<Player[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [gameFormat, setGameFormat] = useState<'eight_ball' | 'nine_ball' | null>(null);

  const fetchRoster = useCallback(async () => {
    if (!teamId) return;

    // Fetch roster and team info in parallel
    const [rosterResult, teamResult] = await Promise.all([
      supabase
        .from('team_players')
        .select('id, is_captain, player:players!player_id(id, first_name, last_name, skill_level)')
        .eq('team_id', teamId)
        .is('left_at', null),
      supabase
        .from('teams')
        .select('division_id, division:divisions!division_id(league:leagues!league_id(game_format))')
        .eq('id', teamId)
        .maybeSingle(),
    ]);

    if (rosterResult.error) {
      console.error('Failed to fetch roster:', rosterResult.error.message);
      return;
    }

    const mapped: Player[] = (rosterResult.data ?? []).map((tp: any) => ({
      id: tp.player?.id ?? tp.id,
      teamPlayerId: tp.id,
      name: `${tp.player?.first_name ?? ''} ${tp.player?.last_name ?? ''}`.trim(),
      skill_level: tp.player?.skill_level ?? 0,
      games_played: 0,
      wins: 0,
      losses: 0,
      is_captain: tp.is_captain,
    }));
    setPlayers(mapped);

    if (teamResult.data) {
      setDivisionId((teamResult.data as any).division_id ?? null);
      const fmt = (teamResult.data as any).division?.league?.game_format;
      setGameFormat(fmt === 'nine_ball' ? 'nine_ball' : 'eight_ball');
    }
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

  const handleRemove = (player: Player) => {
    Alert.alert(
      'Remove Player',
      `Remove ${player.name} from the roster? They can be re-added later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('team_players')
              .update({ left_at: new Date().toISOString() })
              .eq('id', player.teamPlayerId);
            if (error) {
              Alert.alert('Error', 'Could not remove player. Please try again.');
            } else {
              setPlayers((prev) => prev.filter((p) => p.id !== player.id));
            }
          },
        },
      ]
    );
  };

  const handleToggleCaptain = async (player: Player) => {
    const newValue = !player.is_captain;
    const label = newValue ? 'Make Captain' : 'Remove Captain';
    const desc = newValue
      ? `Promote ${player.name} to Captain?`
      : `Remove Captain status from ${player.name}?`;

    Alert.alert(label, desc, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          const { error } = await supabase
            .from('team_players')
            .update({ is_captain: newValue })
            .eq('id', player.teamPlayerId);
          if (error) {
            Alert.alert('Error', 'Could not update captain status. Please try again.');
          } else {
            setPlayers((prev) =>
              prev.map((p) =>
                p.id === player.id ? { ...p, is_captain: newValue } : p
              )
            );
          }
        },
      },
    ]);
  };

  // Sort: captain first, then by skill level descending
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.is_captain !== b.is_captain) return a.is_captain ? -1 : 1;
    return b.skill_level - a.skill_level;
  });

  const renderItem = ({ item }: { item: Player }) => (
    <PlayerCard
      player={item}
      editMode={editMode}
      isMe={item.id === myPlayerId}
      onRemove={handleRemove}
      onToggleCaptain={handleToggleCaptain}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Roster</Text>
        <View style={styles.headerRight}>
          {isCaptain && (
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setEditMode((v) => !v)}
            >
              <Text style={[styles.editBtnText, editMode && styles.editBtnTextActive]}>
                {editMode ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
          )}
          <View style={styles.teamSkillBadge}>
            <Text style={styles.teamSkillText}>
              {players.length} players
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={sortedPlayers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
        ListFooterComponent={
          editMode && players.length < 8 ? (
            <Pressable
              style={({ pressed }) => [
                styles.addPlayerBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
              <Text style={styles.addPlayerBtnText}>Add Player</Text>
            </Pressable>
          ) : null
        }
      />

      {teamId && (
        <AddPlayerModal
          visible={showAddModal}
          teamId={teamId}
          divisionId={divisionId}
          gameFormat={gameFormat}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            fetchRoster();
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  editBtnTextActive: {
    fontWeight: '700',
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
    gap: 8,
  },
  removeBtn: {
    paddingRight: 4,
    alignSelf: 'center',
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
  avatarCircleMe: {
    backgroundColor: '#4CAF5020',
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
    flexWrap: 'wrap',
  },
  playerName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  meLabel: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
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
  captainToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  captainToggleText: {
    fontSize: 13,
    fontWeight: '600',
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
  addPlayerBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  addPlayerBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Add Player Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingBottom: 48,
    paddingHorizontal: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  lookupRow: {
    flexDirection: 'row',
    gap: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  lookupBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  notFoundBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.border + '50',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  notFoundText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  foundBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4CAF5015',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  foundText: {
    fontSize: 13,
    color: '#4CAF50',
    flex: 1,
  },
  errorBox: {
    backgroundColor: theme.colors.error + '15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
  },
  addConfirmBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 52,
  },
  addConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
});
