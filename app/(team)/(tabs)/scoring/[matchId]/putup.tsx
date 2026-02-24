/**
 * PutUpScreen — Real-time two-device put-up player selection
 *
 * Handles the player selection phase before each individual match.
 * Both teams use their own devices and see the screen update in real-time
 * via Supabase Realtime when the other team makes their selection.
 *
 * Flow (put-up team goes first):
 *   1. Put-up team: sees roster, selects their player → saved to DB
 *   2. Put-up team: sees "Waiting for opponent to respond..."
 *   3. Responding team: sees opponent's player (name / SL / MP) + their own roster
 *   4. Responding team: selects their player → saved to DB
 *   5. Both devices: "Both players ready!" → auto-navigate to scoring
 *
 * After individual match N completes, the LOSER puts up first for match N+1.
 * This screen is navigated to with putUpTeam='home'|'away' for each match.
 *
 * Route params: matchId (path), matchOrder + putUpTeam (query)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../../src/constants/theme';
import { supabase } from '../../../../../src/lib/supabase';
import { useAuthContext } from '../../../../../src/providers/AuthProvider';

type Side = 'home' | 'away';

interface RosterPlayer {
  id: string;
  name: string;
  skill_level: number;
  matches_played: number;
}

interface PlayerDisplay {
  name: string;
  skill_level: number;
  matches_played: number;
}

interface IndividualMatchRecord {
  id: string;
  home_player_id: string | null;
  away_player_id: string | null;
  put_up_team: Side | null;
}

type Phase =
  | 'loading'
  | 'we_put_up'       // it's our turn to put up first
  | 'they_putting'    // waiting for opponent to put up their player
  | 'we_respond'      // opponent put up, now we pick our response
  | 'we_waiting'      // we already picked, waiting for opponent to respond
  | 'ready';          // both players chosen, navigating to scoring

export default function PutUpScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { matchOrder: matchOrderStr, putUpTeam: putUpTeamParam } =
    useLocalSearchParams<{ matchOrder: string; putUpTeam: string }>();

  const matchOrder = parseInt(matchOrderStr ?? '1', 10);
  const putUpTeam = (putUpTeamParam ?? 'home') as Side;

  const { profile } = useAuthContext();
  const teamId = profile?.team_id;

  const [loading, setLoading] = useState(true);
  const [ourSide, setOurSide] = useState<Side | null>(null);
  const [opponentTeamId, setOpponentTeamId] = useState<string | null>(null);
  const [indMatch, setIndMatch] = useState<IndividualMatchRecord | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [opponentPlayer, setOpponentPlayer] = useState<PlayerDisplay | null>(null);
  const [saving, setSaving] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ─── Fetch opponent player details ───────────────────────────────────────
  const fetchOpponentPlayer = useCallback(
    async (im: IndividualMatchRecord, side: Side, oppTeamId: string) => {
      const opponentPlayerId =
        side === 'home' ? im.away_player_id : im.home_player_id;
      if (!opponentPlayerId) {
        setOpponentPlayer(null);
        return;
      }

      // Fetch player name + SL (now readable via players_select_opponent policy)
      const { data: p } = await supabase
        .from('players')
        .select('first_name, last_name, skill_level')
        .eq('id', opponentPlayerId)
        .single();

      if (!p) return;

      // Fetch MP from opponent's team_players (readable via team_players_select_opponent)
      const { data: tp } = await supabase
        .from('team_players')
        .select('matches_played')
        .eq('player_id', opponentPlayerId)
        .eq('team_id', oppTeamId)
        .maybeSingle();

      setOpponentPlayer({
        name: `${(p as any).first_name ?? ''} ${(p as any).last_name ?? ''}`.trim(),
        skill_level: (p as any).skill_level ?? 0,
        matches_played: (tp as any)?.matches_played ?? 0,
      });
    },
    []
  );

  // ─── Initialise: determine side, load roster, create/fetch individual match ─
  useEffect(() => {
    const init = async () => {
      if (!matchId || !teamId) return;

      // Fetch team match to determine our side and game format
      const { data: tm } = await supabase
        .from('team_matches')
        .select(
          'home_team_id, away_team_id, division:divisions!division_id(league:leagues!league_id(game_format))'
        )
        .eq('id', matchId)
        .single();

      if (!tm) { setLoading(false); return; }

      const side: Side = (tm as any).home_team_id === teamId ? 'home' : 'away';
      const oppTeamId: string =
        side === 'home' ? (tm as any).away_team_id : (tm as any).home_team_id;
      const gameFormat = (tm as any).division?.league?.game_format ?? 'eight_ball';

      setOurSide(side);
      setOpponentTeamId(oppTeamId);

      // Fetch our roster (with matches_played)
      const { data: rosterData } = await supabase
        .from('team_players')
        .select(
          'matches_played, player:players!player_id(id, first_name, last_name, skill_level)'
        )
        .eq('team_id', teamId)
        .is('left_at', null);

      const mapped: RosterPlayer[] = (rosterData ?? [])
        .map((tp: any) => ({
          id: tp.player?.id ?? '',
          name: `${tp.player?.first_name ?? ''} ${tp.player?.last_name ?? ''}`.trim(),
          skill_level: tp.player?.skill_level ?? 0,
          matches_played: tp.matches_played ?? 0,
        }))
        .filter((p: RosterPlayer) => p.id);

      setRoster(mapped);

      // Fetch existing individual match, or create it
      let { data: im } = await supabase
        .from('individual_matches')
        .select('id, home_player_id, away_player_id, put_up_team')
        .eq('team_match_id', matchId)
        .eq('match_order', matchOrder)
        .maybeSingle();

      if (!im) {
        const { data: created } = await supabase
          .from('individual_matches')
          .insert({
            team_match_id: matchId,
            match_order: matchOrder,
            game_format: gameFormat,
            put_up_team: putUpTeam,
          })
          .select('id, home_player_id, away_player_id, put_up_team')
          .maybeSingle();
        im = created;
      }

      if (!im) { setLoading(false); return; }

      setIndMatch(im as IndividualMatchRecord);

      // If opponent already chose, load their info
      if (im) {
        await fetchOpponentPlayer(im as IndividualMatchRecord, side, oppTeamId);
      }

      setLoading(false);
    };

    init();
  }, [matchId, teamId, matchOrder, putUpTeam, fetchOpponentPlayer]);

  // ─── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!indMatch?.id || !ourSide || !opponentTeamId) return;

    const channel = supabase
      .channel(`putup_${indMatch.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'individual_matches',
          filter: `id=eq.${indMatch.id}`,
        },
        async (payload) => {
          const updated = payload.new as IndividualMatchRecord;
          setIndMatch(updated);
          await fetchOpponentPlayer(updated, ourSide, opponentTeamId);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [indMatch?.id, ourSide, opponentTeamId, fetchOpponentPlayer]);

  // ─── Auto-navigate when both players are set ──────────────────────────────
  useEffect(() => {
    if (!indMatch?.home_player_id || !indMatch?.away_player_id) return;
    const timer = setTimeout(() => {
      router.replace(
        `/(team)/(tabs)/scoring/${matchId}/${matchOrder - 1}`
      );
    }, 1500);
    return () => clearTimeout(timer);
  }, [indMatch?.home_player_id, indMatch?.away_player_id, matchId, matchOrder]);

  // ─── Select our player ────────────────────────────────────────────────────
  const selectPlayer = async (playerId: string) => {
    if (!indMatch || !ourSide || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const field = ourSide === 'home' ? 'home_player_id' : 'away_player_id';
    const { data: updated } = await supabase
      .from('individual_matches')
      .update({ [field]: playerId })
      .eq('id', indMatch.id)
      .select('id, home_player_id, away_player_id, put_up_team')
      .single();

    if (updated) setIndMatch(updated as IndividualMatchRecord);
    setSaving(false);
  };

  // ─── Determine current UI phase ───────────────────────────────────────────
  const getPhase = (): Phase => {
    if (loading || !indMatch || !ourSide) return 'loading';

    const ourPlayerId =
      ourSide === 'home' ? indMatch.home_player_id : indMatch.away_player_id;
    const theirPlayerId =
      ourSide === 'home' ? indMatch.away_player_id : indMatch.home_player_id;

    if (ourPlayerId && theirPlayerId) return 'ready';

    if (indMatch.put_up_team === ourSide) {
      // We put up first
      return ourPlayerId ? 'we_waiting' : 'we_put_up';
    } else {
      // They put up first
      if (!theirPlayerId) return 'they_putting';
      return ourPlayerId ? 'we_waiting' : 'we_respond';
    }
  };

  const phase = getPhase();

  const ourPlayerName = (() => {
    if (!indMatch || !ourSide || !roster.length) return null;
    const id = ourSide === 'home' ? indMatch.home_player_id : indMatch.away_player_id;
    return id ? (roster.find((p) => p.id === id)?.name ?? null) : null;
  })();

  // ─── Roster list item ─────────────────────────────────────────────────────
  const renderRosterItem = ({ item }: { item: RosterPlayer }) => (
    <Pressable
      style={({ pressed }) => [styles.rosterRow, pressed && styles.rowPressed]}
      onPress={() => selectPlayer(item.id)}
      disabled={saving}
    >
      <View style={styles.rosterInfo}>
        <Text style={styles.rosterName}>{item.name}</Text>
        <Text style={styles.rosterStats}>
          SL {item.skill_level} · {item.matches_played} MP
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );

  // ─── Render phase content ─────────────────────────────────────────────────
  const renderContent = () => {
    switch (phase) {
      case 'loading':
        return (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        );

      case 'we_put_up':
        return (
          <>
            <View style={styles.promptCard}>
              <Text style={styles.promptTitle}>Your Turn to Put Up</Text>
              <Text style={styles.promptBody}>
                Your team puts up first for Match {matchOrder}.{'\n'}
                Select the player you are sending to the table.
              </Text>
            </View>
            <Text style={styles.rosterLabel}>Select your player:</Text>
            <FlatList
              data={roster}
              keyExtractor={(item) => item.id}
              renderItem={renderRosterItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </>
        );

      case 'they_putting':
        return (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.waitTitle}>Opponent is choosing...</Text>
            <Text style={styles.waitBody}>
              Waiting for the other team to put up their player for Match{' '}
              {matchOrder}.
            </Text>
          </View>
        );

      case 'we_respond':
        return (
          <>
            <View style={styles.opponentCard}>
              <Text style={styles.opponentLabel}>OPPONENT PUT UP</Text>
              <Text style={styles.opponentName}>
                {opponentPlayer?.name ?? '—'}
              </Text>
              <View style={styles.statRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statChipText}>
                    SL {opponentPlayer?.skill_level ?? '—'}
                  </Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statChipText}>
                    {opponentPlayer?.matches_played ?? 0} MP
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.rosterLabel}>Select your response player:</Text>
            <FlatList
              data={roster}
              keyExtractor={(item) => item.id}
              renderItem={renderRosterItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </>
        );

      case 'we_waiting':
        return (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.waitTitle}>Waiting for opponent...</Text>
            <Text style={styles.waitBody}>
              You put up {ourPlayerName ?? 'your player'}.{'\n'}
              Waiting for the other team to respond.
            </Text>
          </View>
        );

      case 'ready':
        return (
          <View style={styles.centered}>
            <Ionicons
              name="checkmark-circle"
              size={72}
              color={theme.colors.success}
            />
            <Text style={styles.readyTitle}>Both Players Ready!</Text>
            <Text style={styles.waitBody}>Starting Match {matchOrder}...</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Match {matchOrder} of 5</Text>
          <Text style={styles.headerSub}>Put Up</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      {renderContent()}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  // Prompt card (our turn to put up)
  promptCard: {
    margin: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary + '50',
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  promptBody: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  // Opponent player card
  opponentCard: {
    margin: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.warning + '60',
    alignItems: 'center',
    gap: 8,
  },
  opponentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.warning,
    letterSpacing: 1.5,
  },
  opponentName: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  statChip: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  // Roster list
  rosterLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 8,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 64,
  },
  rowPressed: {
    opacity: 0.85,
    backgroundColor: theme.colors.surfaceLight,
  },
  rosterInfo: {
    flex: 1,
    gap: 4,
  },
  rosterName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
  },
  rosterStats: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  // Waiting states
  waitTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  waitBody: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Ready state
  readyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.success,
    textAlign: 'center',
  },
});
