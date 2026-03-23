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
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import NetInfo from '@react-native-community/netinfo';
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
  const [opponentRoster, setOpponentRoster] = useState<RosterPlayer[]>([]);
  const [opponentPlayer, setOpponentPlayer] = useState<PlayerDisplay | null>(null);
  const [saving, setSaving] = useState(false);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [tentativePlayerId, setTentativePlayerId] = useState<string | null>(null);
  const [opponentTentativeId, setOpponentTentativeId] = useState<string | null>(null);
  const [priorHomeSL, setPriorHomeSL] = useState(0);
  const [priorAwaySL, setPriorAwaySL] = useState(0);

  // Offline fallback — shown when connectivity is absent or Realtime times out
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [offlineHomeId, setOfflineHomeId] = useState<string | null>(null);
  const [offlineAwayId, setOfflineAwayId] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const realtimeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Block Android hardware back button during put-up
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // ─── Dev bypass (triple-tap header title → auto-fill both players) ────────
  const [devTapCount, setDevTapCount] = useState(0);
  const devTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDevTap = () => {
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    setDevTapCount(c => {
      const next = c + 1;
      if (next >= 3) {
        handleDevBypass();
        return 0;
      }
      devTapTimer.current = setTimeout(() => setDevTapCount(0), 1500);
      return next;
    });
  };

  const handleDevBypass = async () => {
    if (!indMatch || !roster.length || !ourSide) return;
    const ourPlayer = roster[0];
    // Use a roster player with a different SL for the opponent slot — cross-team query is RLS-blocked
    const opponentPlayer =
      roster.find(p => p.skill_level !== ourPlayer.skill_level) ??
      roster[1] ??
      roster[0];
    const opponentPlayerId = opponentPlayer.id;

    const homeId = ourSide === 'home' ? ourPlayer.id : opponentPlayerId;
    const awayId = ourSide === 'away' ? ourPlayer.id : opponentPlayerId;

    const { data: updated } = await supabase
      .from('individual_matches')
      .update({
        home_player_id: homeId,
        away_player_id: awayId,
        home_skill_level: ourSide === 'home' ? ourPlayer.skill_level : opponentPlayer.skill_level,
        away_skill_level: ourSide === 'away' ? ourPlayer.skill_level : opponentPlayer.skill_level,
      })
      .eq('id', indMatch.id)
      .select('id, home_player_id, away_player_id, put_up_team')
      .single();
    if (updated) setIndMatch(updated as IndividualMatchRecord);
  };

  // ─── Fetch opponent player details ───────────────────────────────────────
  const fetchOpponentPlayer = useCallback(
    async (im: IndividualMatchRecord, side: Side, oppTeamId: string) => {
      const opponentPlayerId =
        side === 'home' ? im.away_player_id : im.home_player_id;
      if (!opponentPlayerId) {
        setOpponentPlayer(null);
        return;
      }

      // Fetch player name from players table + SL + MP from team_players
      const { data: p } = await supabase
        .from('players')
        .select('first_name, last_name')
        .eq('id', opponentPlayerId)
        .single();

      if (!p) return;

      // Fetch MP and SL from opponent's team_players (readable via team_players_select_opponent)
      const { data: tp } = await supabase
        .from('team_players')
        .select('matches_played, current_8_ball_sl, current_9_ball_sl')
        .eq('player_id', opponentPlayerId)
        .eq('team_id', oppTeamId)
        .maybeSingle();

      setOpponentPlayer({
        name: `${(p as any).first_name ?? ''} ${(p as any).last_name ?? ''}`.trim(),
        skill_level: (tp as any)?.current_8_ball_sl ?? (tp as any)?.current_9_ball_sl ?? 0,
        matches_played: (tp as any)?.matches_played ?? 0,
      });
    },
    []
  );

  // ─── Initialise: determine side, load roster, create/fetch individual match ─
  useEffect(() => {
    const init = async () => {
      if (!matchId || !teamId) return;

      // Fetch team match to determine our side, game format, and status
      const { data: tm } = await supabase
        .from('team_matches')
        .select(
          'home_team_id, away_team_id, status, game_format'
        )
        .eq('id', matchId)
        .single();

      if (!tm) { setLoading(false); return; }

      const side: Side = (tm as any).home_team_id === teamId ? 'home' : 'away';
      const oppTeamId: string =
        side === 'home' ? (tm as any).away_team_id : (tm as any).home_team_id;
      const gameFormat = (tm as any).game_format;
      const tmStatus: string = (tm as any).status ?? 'scheduled';

      setOurSide(side);
      setOpponentTeamId(oppTeamId);

      // Fetch our roster (with matches_played and SL)
      const { data: rosterData } = await supabase
        .from('team_players')
        .select(
          'matches_played, current_8_ball_sl, current_9_ball_sl, player:players!player_id(id, first_name, last_name)'
        )
        .eq('team_id', teamId)
        .eq('is_active', true);

      const mapRoster = (data: any[]): RosterPlayer[] =>
        data
          .map((tp: any) => ({
            id: tp.player?.id ?? '',
            name: `${tp.player?.first_name ?? ''} ${tp.player?.last_name ?? ''}`.trim(),
            skill_level: tp.current_8_ball_sl ?? tp.current_9_ball_sl ?? 0,
            matches_played: tp.matches_played ?? 0,
          }))
          .filter((p: RosterPlayer) => p.id);

      const mapped = mapRoster(rosterData ?? []);
      setRoster(mapped);

      // Fetch opponent roster (requires migration 00018: authenticated SELECT on team_players)
      const { data: oppRosterData } = await supabase
        .from('team_players')
        .select(
          'matches_played, current_8_ball_sl, current_9_ball_sl, player:players!player_id(id, first_name, last_name)'
        )
        .eq('team_id', oppTeamId)
        .eq('is_active', true);

      setOpponentRoster(mapRoster(oppRosterData ?? []));

      // Fetch SL totals from already-completed matches this session (for matches 2–5)
      if (matchOrder > 1) {
        const { data: priorMatches } = await supabase
          .from('individual_matches')
          .select('home_skill_level, away_skill_level')
          .eq('team_match_id', matchId)
          .lt('match_order', matchOrder);
        setPriorHomeSL((priorMatches ?? []).reduce((s: number, m: any) => s + (m.home_skill_level ?? 0), 0));
        setPriorAwaySL((priorMatches ?? []).reduce((s: number, m: any) => s + (m.away_skill_level ?? 0), 0));
      }

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
      } else if (im.home_player_id && im.away_player_id) {
        // Stale player IDs from a previous aborted session — clear them so the
        // put-up flow runs fresh. If both are set on entry to putup, it's always
        // stale: legitimate completion would have auto-navigated away already.
        await supabase
          .from('individual_matches')
          .update({ home_player_id: null, away_player_id: null, home_skill_level: null, away_skill_level: null })
          .eq('id', im.id);
        im = { ...im, home_player_id: null, away_player_id: null };
      }

      if (!im) { setLoading(false); return; }

      setIndMatch(im as IndividualMatchRecord);

      // If opponent already chose, load their info
      if (im) {
        await fetchOpponentPlayer(im as IndividualMatchRecord, side, oppTeamId);
      }

      // Check connectivity — if offline, show fallback immediately
      const net = await NetInfo.fetch();
      if (!net.isConnected) setOfflineFallback(true);

      setLoading(false);
    };

    init();
  }, [matchId, teamId, matchOrder, putUpTeam, fetchOpponentPlayer]);

  // ─── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!indMatch?.id || !ourSide || !opponentTeamId) return;

    const channel = supabase
      .channel(`putup_${indMatch.id}`, { config: { broadcast: { self: false } } })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'individual_matches',
          filter: `id=eq.${indMatch.id}`,
        },
        async (payload) => {
          setOpponentConnected(true);
          const updated = payload.new as IndividualMatchRecord;
          setIndMatch(updated);
          // Clear opponent tentative once they've confirmed
          setOpponentTentativeId(null);
          await fetchOpponentPlayer(updated, ourSide, opponentTeamId);
        }
      )
      .on('broadcast', { event: 'tentative' }, (payload) => {
        const { side, playerId } = payload.payload ?? {};
        if (side && side !== ourSide) {
          setOpponentTentativeId(playerId ?? null);
        }
      })
      .subscribe();

    channelRef.current = channel;

    // If Realtime hasn't connected within 10 seconds, offer the offline fallback
    realtimeTimeoutRef.current = setTimeout(() => {
      if (channel.state !== 'joined') setOfflineFallback(true);
    }, 10_000);

    return () => {
      channel.unsubscribe();
      if (realtimeTimeoutRef.current) clearTimeout(realtimeTimeoutRef.current);
    };
  }, [indMatch?.id, ourSide, opponentTeamId, fetchOpponentPlayer]);

  // ─── Auto-navigate when both players are set ──────────────────────────────
  useEffect(() => {
    if (!indMatch?.home_player_id || !indMatch?.away_player_id) return;
    const timer = setTimeout(async () => {
      // Mark the team match as in_progress now that scoring has begun
      await supabase
        .from('team_matches')
        .update({ status: 'in_progress' })
        .eq('id', matchId);
      router.replace(
        `/(team)/(tabs)/scoring/${matchId}/${matchOrder - 1}`
      );
    }, 1500);
    return () => clearTimeout(timer);
  }, [indMatch?.home_player_id, indMatch?.away_player_id, matchId, matchOrder]);

  // ─── Tentatively select our player (highlights row, does not write to DB) ─
  const selectPlayer = (playerId: string) => {
    if (!indMatch || !ourSide || saving) return;
    setTentativePlayerId(playerId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Broadcast tentative selection to opponent device
    const player = roster.find(p => p.id === playerId);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'tentative',
      payload: { side: ourSide, playerId, playerName: player?.name, sl: player?.skill_level ?? 0 },
    });
  };

  // ─── Confirm our tentative selection → write to DB ────────────────────────
  const confirmPlayer = async () => {
    if (!tentativePlayerId || !indMatch || !ourSide || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const field = ourSide === 'home' ? 'home_player_id' : 'away_player_id';
    const skillField = ourSide === 'home' ? 'home_skill_level' : 'away_skill_level';
    const skillLevel = roster.find(p => p.id === tentativePlayerId)?.skill_level ?? null;
    const { data: updated } = await supabase
      .from('individual_matches')
      .update({ [field]: tentativePlayerId, [skillField]: skillLevel })
      .eq('id', indMatch.id)
      .select('id, home_player_id, away_player_id, put_up_team')
      .single();

    if (updated) setIndMatch(updated as IndividualMatchRecord);
    setSaving(false);
  };

  // ─── Offline: proceed with manually selected players ──────────────────────
  const proceedOffline = async () => {
    if (!indMatch || !ourSide || saving) return;
    const homeRosterForOffline = ourSide === 'home' ? roster : opponentRoster;
    const awayRosterForOffline = ourSide === 'away' ? roster : opponentRoster;
    const homeId = offlineHomeId ?? homeRosterForOffline[0]?.id;
    const awayId = offlineAwayId ?? awayRosterForOffline[0]?.id;
    if (!homeId || !awayId) return;

    setSaving(true);
    const homeSL = homeRosterForOffline.find(p => p.id === homeId)?.skill_level ?? 3;
    const awaySL = awayRosterForOffline.find(p => p.id === awayId)?.skill_level ?? 3;

    await supabase
      .from('individual_matches')
      .update({
        home_player_id: homeId,
        away_player_id: awayId,
        home_skill_level: homeSL,
        away_skill_level: awaySL,
      })
      .eq('id', indMatch.id);

    await supabase
      .from('team_matches')
      .update({ status: 'in_progress' })
      .eq('id', matchId);

    setSaving(false);
    router.replace(`/(team)/(tabs)/scoring/${matchId}/${matchOrder - 1}`);
  };

  // ─── Computed values for SL totals and confirmed state ───────────────────
  const ourConfirmedId = ourSide ? (ourSide === 'home' ? indMatch?.home_player_id : indMatch?.away_player_id) : null;
  const oppConfirmedId = ourSide ? (ourSide === 'home' ? indMatch?.away_player_id : indMatch?.home_player_id) : null;

  const ourDisplaySL = (() => {
    const id = tentativePlayerId ?? ourConfirmedId;
    return id ? (roster.find(p => p.id === id)?.skill_level ?? 0) : 0;
  })();
  const oppDisplaySL = (() => {
    const id = opponentTentativeId ?? oppConfirmedId;
    if (id) return opponentRoster.find(p => p.id === id)?.skill_level ?? 0;
    return opponentPlayer?.skill_level ?? 0;
  })();

  const homeSLTotal = priorHomeSL + (ourSide === 'home' ? ourDisplaySL : oppDisplaySL);
  const awaySLTotal = priorAwaySL + (ourSide === 'away' ? ourDisplaySL : oppDisplaySL);
  const ourSLTotal = ourSide === 'home' ? homeSLTotal : awaySLTotal;
  const oppSLTotal = ourSide === 'home' ? awaySLTotal : homeSLTotal;

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

  // ─── Side-by-side roster view ─────────────────────────────────────────────
  const renderSideBySideRosters = (canSelect: boolean) => {
    const ourLabel = ourSide === 'home' ? 'Home' : 'Away';
    const oppLabel = ourSide === 'home' ? 'Away' : 'Home';

    return (
      <View style={styles.sideBySide}>
        {/* Our column */}
        <View style={styles.rosterColumn}>
          <Text style={styles.columnHeader}>{ourLabel} (Us)</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.columnScroll}>
            {roster.map(p => {
              const isTentative = tentativePlayerId === p.id && !ourConfirmedId;
              const isConfirmed = ourConfirmedId === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.sideRosterRow,
                    isTentative && styles.rowTentative,
                    isConfirmed && styles.rowConfirmed,
                  ]}
                  onPress={() => canSelect && !ourConfirmedId && selectPlayer(p.id)}
                  disabled={!canSelect || !!ourConfirmedId || saving}
                >
                  <Text style={styles.sideRosterName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.sideRosterStats}>SL {p.skill_level} · {p.matches_played}MP</Text>
                  {isTentative && (
                    <Ionicons name="ellipse" size={10} color="#F59E0B" style={styles.rowIcon} />
                  )}
                  {isConfirmed && (
                    <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} style={styles.rowIcon} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          {/* SL total + Confirm button */}
          <View style={styles.columnFooter}>
            <View style={styles.slTotalRow}>
              <Text style={styles.slTotalLabel}>SL Total</Text>
              <Text style={styles.slTotalValue}>{ourSLTotal}</Text>
            </View>
            {canSelect && !ourConfirmedId && tentativePlayerId && (
              <Pressable
                style={[styles.confirmButton, saving && styles.confirmButtonDisabled]}
                onPress={confirmPlayer}
                disabled={saving}
              >
                <Text style={styles.confirmButtonText}>{saving ? 'Saving…' : 'Confirm Player'}</Text>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Opponent column */}
        <View style={styles.rosterColumn}>
          <Text style={styles.columnHeader}>{oppLabel} (Them)</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.columnScroll}>
            {opponentRoster.length === 0 ? (
              <Text style={styles.emptyRosterText}>Unavailable</Text>
            ) : opponentRoster.map(p => {
              const isTentative = opponentTentativeId === p.id && !oppConfirmedId;
              const isConfirmed = oppConfirmedId === p.id;
              return (
                <View
                  key={p.id}
                  style={[
                    styles.sideRosterRow,
                    styles.sideRosterRowReadOnly,
                    isTentative && styles.rowTentative,
                    isConfirmed && styles.rowConfirmed,
                  ]}
                >
                  <Text style={styles.sideRosterName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.sideRosterStats}>SL {p.skill_level} · {p.matches_played}MP</Text>
                  {isTentative && (
                    <Ionicons name="ellipse" size={10} color="#F59E0B" style={styles.rowIcon} />
                  )}
                  {isConfirmed && (
                    <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} style={styles.rowIcon} />
                  )}
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.columnFooter}>
            <View style={styles.slTotalRow}>
              <Text style={styles.slTotalLabel}>SL Total</Text>
              <Text style={styles.slTotalValue}>{oppSLTotal}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ─── Render phase content ─────────────────────────────────────────────────
  const renderContent = () => {
    // Offline fallback — let the scorekeeper manually set both players
    if (offlineFallback && phase !== 'loading' && phase !== 'ready') {
      const homeRosterForOffline = ourSide === 'home' ? roster : opponentRoster;
      const awayRosterForOffline = ourSide === 'away' ? roster : opponentRoster;

      return (
        <ScrollView contentContainerStyle={styles.offlineContainer}>
          <View style={styles.offlineBanner}>
            <Ionicons name="warning-outline" size={24} color="#F59E0B" />
            <Text style={styles.offlineBannerText}>
              No network — WiFi required for two-device put-up coordination.
              You can still proceed manually.
            </Text>
          </View>

          <Text style={styles.rosterLabel}>Home player:</Text>
          {homeRosterForOffline.map(p => (
            <Pressable
              key={`home-${p.id}`}
              style={[styles.rosterRow, offlineHomeId === p.id && styles.rosterRowSelected]}
              onPress={() => setOfflineHomeId(p.id)}
            >
              <View style={styles.rosterInfo}>
                <Text style={styles.rosterName}>{p.name}</Text>
                <Text style={styles.rosterStats}>SL {p.skill_level} · {p.matches_played} MP</Text>
              </View>
              {offlineHomeId === p.id && (
                <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
              )}
            </Pressable>
          ))}

          <Text style={[styles.rosterLabel, { marginTop: 20 }]}>Away player:</Text>
          {awayRosterForOffline.map(p => (
            <Pressable
              key={`away-${p.id}`}
              style={[styles.rosterRow, offlineAwayId === p.id && styles.rosterRowSelected]}
              onPress={() => setOfflineAwayId(p.id)}
            >
              <View style={styles.rosterInfo}>
                <Text style={styles.rosterName}>{p.name}</Text>
                <Text style={styles.rosterStats}>SL {p.skill_level} · {p.matches_played} MP</Text>
              </View>
              {offlineAwayId === p.id && (
                <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
              )}
            </Pressable>
          ))}

          <Pressable
            style={[
              styles.offlineProceedButton,
              (!offlineHomeId || !offlineAwayId || saving) && styles.offlineProceedDisabled,
            ]}
            onPress={proceedOffline}
            disabled={!offlineHomeId || !offlineAwayId || saving}
          >
            <Text style={styles.offlineProceedText}>
              {saving ? 'Starting…' : 'Start Match'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </Pressable>
        </ScrollView>
      );
    }

    switch (phase) {
      case 'loading':
        return (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        );

      case 'ready':
        return (
          <View style={styles.centered}>
            <Ionicons name="checkmark-circle" size={72} color={theme.colors.success} />
            <Text style={styles.readyTitle}>Both Players Ready!</Text>
            <Text style={styles.waitBody}>Starting Match {matchOrder}...</Text>
          </View>
        );

      case 'they_putting':
        return (
          <>
            <View style={styles.statusBanner}>
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.statusBannerText}>
                {opponentConnected
                  ? `Waiting for opponent to put up their player…`
                  : 'Waiting for the other team to open the app…'}
              </Text>
            </View>
            {renderSideBySideRosters(false)}
          </>
        );

      case 'we_put_up':
        return (
          <>
            <View style={[styles.statusBanner, styles.statusBannerActive]}>
              <Ionicons name="hand-left-outline" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.statusBannerText, { color: theme.colors.primary }]}>
                Your team puts up first for Match {matchOrder}. Tap a player, then confirm.
              </Text>
            </View>
            {renderSideBySideRosters(true)}
          </>
        );

      case 'we_respond':
        return (
          <>
            <View style={[styles.statusBanner, styles.statusBannerActive]}>
              <Ionicons name="hand-left-outline" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.statusBannerText, { color: theme.colors.primary }]}>
                {opponentPlayer?.name ?? 'Opponent'} is up. Choose your response player.
              </Text>
            </View>
            {renderSideBySideRosters(true)}
          </>
        );

      case 'we_waiting':
        return (
          <>
            <View style={styles.statusBanner}>
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.statusBannerText}>
                {opponentConnected
                  ? `You put up ${ourPlayerName ?? 'your player'}. Waiting for opponent to respond…`
                  : 'Waiting for the other team to open the app…'}
              </Text>
            </View>
            {renderSideBySideRosters(false)}
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View style={styles.headerBar}>
        <Pressable
          style={styles.headerButton}
          onPress={() => {}} // back locked during put-up
          hitSlop={12}
          disabled
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.border} />
        </Pressable>
        <Pressable style={styles.headerCenter} onPress={handleDevTap} hitSlop={8}>
          <Text style={styles.headerTitle}>Match {matchOrder} of 5</Text>
          <Text style={styles.headerSub}>
            Put Up{devTapCount > 0 ? ' ' + '·'.repeat(devTapCount) : ''}
          </Text>
        </Pressable>
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
  // Roster list (offline fallback uses these)
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
  // Status banner (above side-by-side rosters)
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    marginTop: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusBannerActive: {
    borderColor: theme.colors.primary + '50',
    backgroundColor: theme.colors.primary + '08',
  },
  statusBannerText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  // Side-by-side roster layout
  sideBySide: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 6,
  },
  rosterColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  columnScroll: {
    flex: 1,
  },
  columnFooter: {
    paddingTop: 6,
    paddingBottom: 8,
    gap: 6,
  },
  sideRosterRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 52,
    justifyContent: 'center',
  },
  sideRosterRowReadOnly: {
    opacity: 0.85,
  },
  sideRosterName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  sideRosterStats: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  rowTentative: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B12',
  },
  rowConfirmed: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '15',
  },
  rowIcon: {
    marginTop: 4,
  },
  slTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  slTotalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  slTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    minHeight: 40,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
  // Offline fallback
  offlineContainer: {
    padding: 20,
    paddingBottom: 40,
    gap: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F59E0B15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B40',
    padding: 14,
    marginBottom: 12,
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#F59E0B',
    lineHeight: 20,
  },
  rosterRowSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '15',
  },
  offlineProceedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    minHeight: 52,
  },
  offlineProceedDisabled: {
    opacity: 0.4,
  },
  offlineProceedText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyRosterText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
});
