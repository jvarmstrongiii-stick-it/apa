/**
 * BackfillScreen — Enter previously played matches for mid-night resume
 *
 * Home team: multi-step wizard → submits to DB → waits for away to verify
 * Away team: waits for home to submit → verifies read-only summary → proceed
 *
 * Home wizard steps:
 *   0. Which match are you starting on? (1–5); pick 1 → coin-flip directly
 *   1. Who won the coin flip? + did they put up or defer?
 *   2..N. Per-match entry: players + racks won
 *   N+1. Review & confirm → save → home_waiting phase
 *
 * Away phases:
 *   away_waiting → (Realtime: coin_flip_done) → away_verifying → putup
 */

import { useEffect, useRef, useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../../src/constants/theme';
import { supabase } from '../../../../../src/lib/supabase';
import { useAuthContext } from '../../../../../src/providers/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

type Side = 'home' | 'away';

type BackfillPhase =
  | 'loading'
  | 'wizard'          // home team only: wizard steps 0–N+1
  | 'home_waiting'    // home team: saved, waiting for away to verify
  | 'away_waiting'    // away team: waiting for home to finish
  | 'away_verifying'; // away team: reviewing home's entries

interface RosterPlayer {
  id: string;
  name: string;
  skill_level: number;
}

interface BackfillMatchData {
  homePlayerId: string;
  homeSL: number;
  awayPlayerId: string;
  awaySL: number;
  homeRacks: number;
  awayRacks: number;
}

interface VerifyMatch {
  matchOrder: number;
  homePlayerName: string;
  homeSL: number;
  awayPlayerName: string;
  awaySL: number;
  homeRacks: number;     // racks won
  awayRacks: number;
  homePts: number;       // APA points earned
  awayPts: number;
  homeRacksNeeded: number;
  awayRacksNeeded: number;
  winner: Side;
}

// ─── Race table ───────────────────────────────────────────────────────────────

const RACE: Record<number, Record<number, [number, number]>> = {
  2: { 2: [2, 2], 3: [2, 3], 4: [2, 4], 5: [2, 5], 6: [2, 6], 7: [2, 7] },
  3: { 2: [3, 2], 3: [2, 2], 4: [2, 3], 5: [2, 4], 6: [2, 5], 7: [2, 6] },
  4: { 2: [4, 2], 3: [3, 2], 4: [3, 3], 5: [3, 4], 6: [3, 5], 7: [2, 5] },
  5: { 2: [5, 2], 3: [4, 2], 4: [4, 3], 5: [4, 4], 6: [4, 5], 7: [3, 5] },
  6: { 2: [6, 2], 3: [5, 2], 4: [5, 3], 5: [5, 4], 6: [5, 5], 7: [4, 5] },
  7: { 2: [7, 2], 3: [6, 2], 4: [5, 2], 5: [5, 3], 6: [5, 4], 7: [5, 5] },
};

function getRacksNeeded(homeSL: number, awaySL: number): [number, number] {
  return RACE[homeSL]?.[awaySL] ?? [2, 2];
}

function calcApaPoints(
  homeRacks: number, awayRacks: number,
  homeRaceTo: number, awayRaceTo: number,
): [number, number] {
  if (homeRacks >= homeRaceTo) {
    if (awayRacks === 0)                   return [3, 0];
    if (awayRacks === awayRaceTo - 1)      return [2, 1];
    return [2, 0];
  }
  if (awayRacks >= awayRaceTo) {
    if (homeRacks === 0)                   return [0, 3];
    if (homeRacks === homeRaceTo - 1)      return [1, 2];
    return [0, 2];
  }
  return [0, 0];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BackfillScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { profile } = useAuthContext();
  const teamId = profile?.team_id;

  const [phase, setPhase] = useState<BackfillPhase>('loading');
  const [saving, setSaving] = useState(false);

  // Match info
  const [ourSide, setOurSide] = useState<Side | null>(null);
  const [gameFormat, setGameFormat] = useState<string>('eight_ball');
  const [homeTeamName, setHomeTeamName] = useState('Home');
  const [awayTeamName, setAwayTeamName] = useState('Away');
  const [homeRoster, setHomeRoster] = useState<RosterPlayer[]>([]);
  const [awayRoster, setAwayRoster] = useState<RosterPlayer[]>([]);

  // Home wizard state
  const [step, setStep] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [coinFlipWinner, setCoinFlipWinner] = useState<Side | null>(null);
  const [firstPutUpTeam, setFirstPutUpTeam] = useState<Side | null>(null);
  const [matches, setMatches] = useState<BackfillMatchData[]>([]);

  // Away verification state
  const [verifyMatches, setVerifyMatches] = useState<VerifyMatch[]>([]);
  const [verifyNextPutUpTeam, setVerifyNextPutUpTeam] = useState<Side>('home');
  const [verifyCompletedCount, setVerifyCompletedCount] = useState(0);
  const [verifyCoinFlipWinner, setVerifyCoinFlipWinner] = useState<Side | null>(null);
  const [verifyFirstPutUpTeam, setVerifyFirstPutUpTeam] = useState<Side | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Android back: navigate within wizard ─────────────────────────────────

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'wizard' && step > 0) {
        setStep(s => s - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [phase, step]);

  // ── Load team info + rosters ──────────────────────────────────────────────

  useEffect(() => {
    if (!matchId || !teamId) return;

    const load = async () => {
      const { data: tm } = await supabase
        .from('team_matches')
        .select(
          'home_team_id, away_team_id, game_format, coin_flip_done, ' +
          'home_team:teams!home_team_id(name), ' +
          'away_team:teams!away_team_id(name)'
        )
        .eq('id', matchId)
        .single();

      if (!tm) { setPhase('wizard'); return; }

      const fmt: string = (tm as any).game_format ?? 'eight_ball';
      const homeId: string = (tm as any).home_team_id;
      const awayId: string = (tm as any).away_team_id;
      const side: Side = homeId === teamId ? 'home' : 'away';

      setGameFormat(fmt);
      setOurSide(side);
      setHomeTeamName((tm as any).home_team?.name ?? 'Home');
      setAwayTeamName((tm as any).away_team?.name ?? 'Away');

      const slField = fmt === 'nine_ball' ? 'current_9_ball_sl' : 'current_8_ball_sl';
      const rosterSelect = `${slField}, player:players!player_id(id, first_name, last_name)`;

      const mapRoster = (data: any[]): RosterPlayer[] =>
        (data ?? [])
          .map((tp: any) => ({
            id: tp.player?.id ?? '',
            name: `${tp.player?.first_name ?? ''} ${tp.player?.last_name ?? ''}`.trim(),
            skill_level: tp[slField] ?? 0,
          }))
          .filter(p => p.id && p.name);

      const [{ data: homeData }, { data: awayData }] = await Promise.all([
        supabase.from('team_players').select(rosterSelect).eq('team_id', homeId).eq('is_active', true),
        supabase.from('team_players').select(rosterSelect).eq('team_id', awayId).eq('is_active', true),
      ]);

      setHomeRoster(mapRoster(homeData ?? []));
      setAwayRoster(mapRoster(awayData ?? []));

      // Away team: if home already saved, go straight to verification (if data exists)
      if (side === 'away' && (tm as any).coin_flip_done) {
        const count = await loadVerificationData();
        setPhase(count > 0 ? 'away_verifying' : 'away_waiting');
      } else if (side === 'away') {
        setPhase('away_waiting');
      } else {
        setPhase('wizard');
      }
    };

    load().catch(() => setPhase('wizard'));
  }, [matchId, teamId]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!matchId || !ourSide) return;

    const channel = supabase.channel(`backfill_${matchId}`, {
      config: { broadcast: { self: false } },
    });

    // Away: watch for home team events
    if (ourSide === 'away') {
      channel.on('broadcast', { event: 'backfill_saved' }, async () => {
        const count = await loadVerificationData();
        setPhase(count > 0 ? 'away_verifying' : 'away_waiting');
      });
      channel.on('broadcast', { event: 'match_reset' }, () => {
        setVerifyMatches([]);
        setVerifyCompletedCount(0);
        setPhase('away_waiting');
      });
    }

    // Home: watch for away to confirm or dispute
    if (ourSide === 'home') {
      channel.on('broadcast', { event: 'backfill_disputed' }, () => {
        // Away team disputed — return home to the wizard so they can correct entries
        setSaving(false);
        setStep(completedCount + 2); // back to review step so they can go back and edit
        setPhase('wizard');
      });
      channel.on('broadcast', { event: 'backfill_verified' }, (payload) => {
        const nextOrder: number = (payload.payload as any)?.nextMatchOrder ?? completedCount + 1;
        const nextPutUp: Side = (payload.payload as any)?.nextPutUpTeam ?? 'home';
        router.replace(
          `/(team)/(tabs)/scoring/${matchId}/putup?matchOrder=${nextOrder}&putUpTeam=${nextPutUp}`
        );
      });
    }

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [matchId, ourSide]);

  // ── Load verification data (away team) ───────────────────────────────────

  const loadVerificationData = async (): Promise<number> => {
    if (!matchId) return;

    const [{ data: tm }, { data: ims }] = await Promise.all([
      supabase
        .from('team_matches')
        .select('coin_flip_winner, first_put_up_team')
        .eq('id', matchId)
        .single(),
      supabase
        .from('individual_matches')
        .select(
          'match_order, home_skill_level, away_skill_level, ' +
          'home_racks_won, away_racks_won, home_points_earned, away_points_earned, ' +
          'home_racks_needed, away_racks_needed, ' +
          'home_player:players!home_player_id(first_name, last_name), ' +
          'away_player:players!away_player_id(first_name, last_name)'
        )
        .eq('team_match_id', matchId)
        .eq('is_completed', true)
        .order('match_order', { ascending: true }),
    ]);

    const rows = (ims ?? []) as any[];
    const count = rows.length;

    const built: VerifyMatch[] = rows.map((im) => {
      const hr: number = im.home_racks_needed ?? 0;
      const ar: number = im.away_racks_needed ?? 0;
      const hRacks: number = im.home_racks_won ?? 0;
      const aRacks: number = im.away_racks_won ?? 0;
      const hPts: number = im.home_points_earned ?? 0;
      const aPts: number = im.away_points_earned ?? 0;
      return {
        matchOrder: im.match_order,
        homePlayerName: im.home_player
          ? `${im.home_player.first_name ?? ''} ${im.home_player.last_name ?? ''}`.trim()
          : 'Unknown',
        homeSL: im.home_skill_level ?? 0,
        awayPlayerName: im.away_player
          ? `${im.away_player.first_name ?? ''} ${im.away_player.last_name ?? ''}`.trim()
          : 'Unknown',
        awaySL: im.away_skill_level ?? 0,
        homeRacks: hRacks,
        awayRacks: aRacks,
        homePts: hPts,
        awayPts: aPts,
        homeRacksNeeded: hr,
        awayRacksNeeded: ar,
        winner: hRacks >= hr ? 'home' : 'away',
      };
    });

    const lastWinner = built.length > 0 ? built[built.length - 1].winner : 'home';
    const nextPutUp: Side = lastWinner === 'home' ? 'away' : 'home';

    setVerifyMatches(built);
    setVerifyCompletedCount(count);
    setVerifyNextPutUpTeam(nextPutUp);
    setVerifyCoinFlipWinner(((tm as any)?.coin_flip_winner ?? null) as Side | null);
    setVerifyFirstPutUpTeam(((tm as any)?.first_put_up_team ?? null) as Side | null);
    return built.length;
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getPlayerName = (id: string, roster: RosterPlayer[]) =>
    roster.find(p => p.id === id)?.name ?? 'Unknown';

  const getMatchWinner = (m: BackfillMatchData): Side | null => {
    if (!m.homePlayerId || !m.awayPlayerId) return null;
    const [hr, ar] = getRacksNeeded(m.homeSL, m.awaySL);
    if (m.homeRacks >= hr) return 'home';
    if (m.awayRacks >= ar) return 'away';
    return null;
  };

  const isMatchValid = (m: BackfillMatchData) =>
    !!m.homePlayerId && !!m.awayPlayerId && getMatchWinner(m) !== null;

  const getPutUpTeam = (matchIndex: number): Side => {
    if (matchIndex === 0) return firstPutUpTeam!;
    const winner = getMatchWinner(matches[matchIndex - 1]);
    return winner === 'home' ? 'away' : 'home';
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSelectStartMatch = (startMatch: number) => {
    Haptics.selectionAsync();
    if (startMatch === 1) {
      // No prior matches — go directly to coin flip
      router.replace(`/(team)/(tabs)/scoring/${matchId}/coin-flip`);
      return;
    }
    const count = startMatch - 1;
    setCompletedCount(count);
    setMatches(Array.from({ length: count }, () => ({
      homePlayerId: '', homeSL: 0,
      awayPlayerId: '', awaySL: 0,
      homeRacks: 0, awayRacks: 0,
    })));
    setStep(1);
  };

  const handleCoinFlipWinner = (winner: Side) => {
    Haptics.selectionAsync();
    setCoinFlipWinner(winner);
    setFirstPutUpTeam(null);
  };

  const handlePutUpChoice = (winnerPutsUpFirst: boolean) => {
    if (!coinFlipWinner) return;
    const putUp: Side = winnerPutsUpFirst
      ? coinFlipWinner
      : (coinFlipWinner === 'home' ? 'away' : 'home');
    setFirstPutUpTeam(putUp);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep(2);
  };

  const updateMatch = (index: number, update: Partial<BackfillMatchData>) => {
    setMatches(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...update };
      return next;
    });
  };

  const handleSelectHome = (index: number, player: RosterPlayer) => {
    Haptics.selectionAsync();
    updateMatch(index, { homePlayerId: player.id, homeSL: player.skill_level, homeRacks: 0, awayRacks: 0 });
  };

  const handleSelectAway = (index: number, player: RosterPlayer) => {
    Haptics.selectionAsync();
    updateMatch(index, { awayPlayerId: player.id, awaySL: player.skill_level, homeRacks: 0, awayRacks: 0 });
  };

  const adjustRacks = (index: number, side: Side, delta: number) => {
    Haptics.selectionAsync();
    const m = matches[index];
    const [hr, ar] = getRacksNeeded(m.homeSL, m.awaySL);
    if (side === 'home') {
      updateMatch(index, { homeRacks: Math.max(0, Math.min(hr, m.homeRacks + delta)) });
    } else {
      updateMatch(index, { awayRacks: Math.max(0, Math.min(ar, m.awayRacks + delta)) });
    }
  };

  const handleSave = async () => {
    if (!matchId || saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const rows = matches.map((m, i) => {
        const [hr, ar] = getRacksNeeded(m.homeSL, m.awaySL);
        const [hPts, aPts] = calcApaPoints(m.homeRacks, m.awayRacks, hr, ar);
        return {
          team_match_id: matchId,
          match_order: i + 1,
          game_format: gameFormat,
          home_player_id: m.homePlayerId,
          away_player_id: m.awayPlayerId,
          home_skill_level: m.homeSL,
          away_skill_level: m.awaySL,
          home_racks_needed: hr,
          away_racks_needed: ar,
          home_points_earned: hPts,
          away_points_earned: aPts,
          home_racks_won: m.homeRacks,
          away_racks_won: m.awayRacks,
          put_up_team: getPutUpTeam(i),
          is_completed: true,
          is_backfilled: true,
          completed_at: now,
        };
      });

      await supabase
        .from('individual_matches')
        .upsert(rows, { onConflict: 'team_match_id,match_order' });

      await supabase
        .from('team_matches')
        .update({
          coin_flip_done: true,
          coin_flip_winner: coinFlipWinner,
          first_put_up_team: firstPutUpTeam,
          status: 'in_progress',
        })
        .eq('id', matchId);

      // Notify away device via broadcast (more reliable than postgres_changes)
      const lastWinner = getMatchWinner(matches[matches.length - 1]);
      const nextPutUp: Side = lastWinner === 'home' ? 'away' : 'home';
      channelRef.current?.send({
        type: 'broadcast',
        event: 'backfill_saved',
        payload: { nextMatchOrder: completedCount + 1, nextPutUpTeam: nextPutUp },
      });

      setPhase('home_waiting');
    } catch (e) {
      console.error('Backfill save failed:', e);
      setSaving(false);
    }
  };

  const handleAwayConfirm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextOrder = verifyCompletedCount + 1;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'backfill_verified',
      payload: { nextMatchOrder: nextOrder, nextPutUpTeam: verifyNextPutUpTeam },
    });
    router.replace(
      `/(team)/(tabs)/scoring/${matchId}/putup?matchOrder=${nextOrder}&putUpTeam=${verifyNextPutUpTeam}`
    );
  };

  const handleAwayDispute = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'backfill_disputed',
      payload: {},
    });
    setPhase('away_waiting');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Away: waiting for home ────────────────────────────────────────────────

  if (phase === 'away_waiting') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        <View style={styles.centered}>
          <Text style={styles.waitEmoji}>⏳</Text>
          <Text style={styles.waitTitle}>Waiting for {homeTeamName}</Text>
          <Text style={styles.waitSub}>
            The home team is entering previous match results.{'\n'}
            You'll be asked to verify once they're done.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Away: verification screen ─────────────────────────────────────────────

  if (phase === 'away_verifying') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.verifyTitle}>Verify Previous Matches</Text>
          <Text style={styles.verifySub}>
            Confirm that the results below match your scoresheet.
          </Text>

          {/* Coin flip summary */}
          {verifyCoinFlipWinner && (
            <View style={styles.reviewCard}>
              <Text style={styles.reviewCardTitle}>🪙 Coin Flip</Text>
              <Text style={styles.reviewCardLine}>
                Won by: {verifyCoinFlipWinner === 'home' ? homeTeamName : awayTeamName}
              </Text>
              {verifyFirstPutUpTeam && (
                <Text style={styles.reviewCardLine}>
                  First put-up: {verifyFirstPutUpTeam === 'home' ? homeTeamName : awayTeamName}
                </Text>
              )}
            </View>
          )}

          {verifyMatches.map((vm) => {
            const raceTo = vm.homeRacksNeeded === vm.awayRacksNeeded
              ? `Race to ${vm.homeRacksNeeded}`
              : `Race to ${vm.homeRacksNeeded}–${vm.awayRacksNeeded}`;
            const winnerName = vm.winner === 'home' ? vm.homePlayerName : vm.awayPlayerName;
            const winnerPts = vm.winner === 'home' ? vm.homePts : vm.awayPts;
            const loserPts = vm.winner === 'home' ? vm.awayPts : vm.homePts;
            return (
              <View key={vm.matchOrder} style={styles.reviewCard}>
                <Text style={styles.reviewCardTitle}>Match {vm.matchOrder}</Text>
                <Text style={styles.reviewCardLine}>
                  {vm.homePlayerName} (SL {vm.homeSL}) vs {vm.awayPlayerName} (SL {vm.awaySL})
                </Text>
                <Text style={styles.reviewCardLine}>
                  {raceTo} · Racks Won: {vm.homeRacks}–{vm.awayRacks}
                </Text>
                <Text style={[styles.reviewCardWinner, { color: theme.colors.primary }]}>
                  {winnerName} wins
                </Text>
                <Text style={styles.reviewCardPts}>
                  Points: {winnerPts}–{loserPts}
                </Text>
              </View>
            );
          })}

          <Text style={styles.nextMatchNote}>
            Next: Match {verifyCompletedCount + 1} put-up for{' '}
            {verifyNextPutUpTeam === 'home' ? homeTeamName : awayTeamName}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, { marginTop: 8 }]}
            onPress={handleAwayConfirm}
          >
            <Text style={styles.primaryBtnText}>Looks Correct — Start Match {verifyCompletedCount + 1}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.disputeBtn, pressed && styles.pressed]}
            onPress={handleAwayDispute}
          >
            <Text style={styles.disputeBtnText}>Something looks off — approach {homeTeamName}'s captain to resolve</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Home: waiting for away to verify ─────────────────────────────────────

  if (phase === 'home_waiting') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        <View style={styles.centered}>
          <Text style={styles.waitEmoji}>✓</Text>
          <Text style={styles.waitTitle}>Previous matches recorded.</Text>
          <Text style={styles.waitSub}>
            Waiting for {awayTeamName} to verify...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Home: wizard ──────────────────────────────────────────────────────────

  const totalSteps = completedCount + 2; // coin flip + N matches + review (step 0 not counted)

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />

      {/* ── Step 0: Which match are you starting on? ── */}
      {step === 0 && (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Resume Match</Text>
            <Text style={styles.headerSub}>Enter previously played matches</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.title}>Which match are you starting on?</Text>
            <Text style={styles.subtitle}>
              Select the first match that hasn't been played yet.
              Previous results will be entered from the official scoresheet.
            </Text>

            <View style={styles.countGrid}>
              {[1, 2, 3, 4, 5].map(n => (
                <Pressable
                  key={n}
                  style={({ pressed }) => [styles.countBtn, pressed && styles.pressed]}
                  onPress={() => handleSelectStartMatch(n)}
                >
                  <Text style={styles.countBtnNumber}>{n}</Text>
                  <Text style={styles.countBtnLabel}>
                    {n === 1 ? 'No prior matches' : `${n - 1} played`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ── Steps 1+: wizard header with progress + back ── */}
      {step >= 1 && (
        <View style={styles.container}>
          <View style={styles.wizardHeader}>
            <Pressable
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              onPress={() => setStep(s => s - 1)}
              hitSlop={12}
            >
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
            <Text style={styles.progressText}>Step {step} of {totalSteps}</Text>
            <View style={styles.backBtn} />
          </View>

          {/* ── Step 1: Coin flip ── */}
          {step === 1 && (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.coinEmoji}>🪙</Text>
              <Text style={styles.title}>Who won the coin flip?</Text>

              <View style={styles.twoColRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.teamBtn,
                    coinFlipWinner === 'home' && styles.teamBtnSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handleCoinFlipWinner('home')}
                >
                  <Text style={[styles.teamBtnText, coinFlipWinner === 'home' && styles.teamBtnTextSelected]}>
                    {homeTeamName}
                  </Text>
                  <Text style={[styles.teamBtnSub, coinFlipWinner === 'home' && styles.teamBtnTextSelected]}>
                    Home
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.teamBtn,
                    coinFlipWinner === 'away' && styles.teamBtnSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handleCoinFlipWinner('away')}
                >
                  <Text style={[styles.teamBtnText, coinFlipWinner === 'away' && styles.teamBtnTextSelected]}>
                    {awayTeamName}
                  </Text>
                  <Text style={[styles.teamBtnSub, coinFlipWinner === 'away' && styles.teamBtnTextSelected]}>
                    Away
                  </Text>
                </Pressable>
              </View>

              {coinFlipWinner && (
                <>
                  <Text style={[styles.title, { marginTop: 24 }]}>
                    Did {coinFlipWinner === 'home' ? homeTeamName : awayTeamName} put up first, or defer?
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                    onPress={() => handlePutUpChoice(true)}
                  >
                    <Text style={styles.primaryBtnText}>Put Up First</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                    onPress={() => handlePutUpChoice(false)}
                  >
                    <Text style={styles.secondaryBtnText}>Deferred to Opponent</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          )}

          {/* ── Steps 2..N+1: match entry ── */}
          {step >= 2 && step <= completedCount + 1 && (() => {
            const matchIndex = step - 2;
            const m = matches[matchIndex];
            const bothSelected = !!m.homePlayerId && !!m.awayPlayerId;
            const [hr, ar] = bothSelected ? getRacksNeeded(m.homeSL, m.awaySL) : [0, 0];
            const winner = getMatchWinner(m);
            const valid = isMatchValid(m);

            return (
              <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.matchStepTitle}>Match {matchIndex + 1}</Text>

                {/* Home player picker */}
                <Text style={styles.sectionLabel}>{homeTeamName} Player</Text>
                <View style={styles.playerList}>
                  {homeRoster.map(p => (
                    <Pressable
                      key={p.id}
                      style={({ pressed }) => [
                        styles.playerRow,
                        m.homePlayerId === p.id && styles.playerRowSelected,
                        m.awayPlayerId === p.id && styles.playerRowDisabled,
                        pressed && m.awayPlayerId !== p.id && styles.pressed,
                      ]}
                      onPress={() => m.awayPlayerId !== p.id && handleSelectHome(matchIndex, p)}
                      disabled={m.awayPlayerId === p.id}
                    >
                      <Text style={[
                        styles.playerRowName,
                        m.homePlayerId === p.id && styles.playerRowNameSelected,
                        m.awayPlayerId === p.id && styles.playerRowNameDisabled,
                      ]}>
                        {p.name}
                      </Text>
                      <View style={[styles.slBadge, m.homePlayerId === p.id && styles.slBadgeSelected]}>
                        <Text style={[styles.slBadgeText, m.homePlayerId === p.id && styles.slBadgeTextSelected]}>
                          SL {p.skill_level}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                {/* Away player picker */}
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>{awayTeamName} Player</Text>
                <View style={styles.playerList}>
                  {awayRoster.map(p => (
                    <Pressable
                      key={p.id}
                      style={({ pressed }) => [
                        styles.playerRow,
                        m.awayPlayerId === p.id && styles.playerRowSelected,
                        m.homePlayerId === p.id && styles.playerRowDisabled,
                        pressed && m.homePlayerId !== p.id && styles.pressed,
                      ]}
                      onPress={() => m.homePlayerId !== p.id && handleSelectAway(matchIndex, p)}
                      disabled={m.homePlayerId === p.id}
                    >
                      <Text style={[
                        styles.playerRowName,
                        m.awayPlayerId === p.id && styles.playerRowNameSelected,
                        m.homePlayerId === p.id && styles.playerRowNameDisabled,
                      ]}>
                        {p.name}
                      </Text>
                      <View style={[styles.slBadge, m.awayPlayerId === p.id && styles.slBadgeSelected]}>
                        <Text style={[styles.slBadgeText, m.awayPlayerId === p.id && styles.slBadgeTextSelected]}>
                          SL {p.skill_level}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                {/* Racks section */}
                {bothSelected && (
                  <>
                    <View style={styles.raceToBadge}>
                      <Text style={styles.raceToText}>
                        Race to {hr} ({homeTeamName}) — {ar} ({awayTeamName})
                      </Text>
                    </View>

                    <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Racks Won</Text>

                    <View style={styles.rackRow}>
                      <Text style={styles.rackTeamLabel}>{getPlayerName(m.homePlayerId, homeRoster)}</Text>
                      <View style={styles.stepper}>
                        <Pressable
                          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                          onPress={() => adjustRacks(matchIndex, 'home', -1)}
                          disabled={m.homeRacks === 0}
                        >
                          <Text style={[styles.stepBtnText, m.homeRacks === 0 && styles.stepBtnDisabled]}>−</Text>
                        </Pressable>
                        <Text style={styles.rackCount}>{m.homeRacks}</Text>
                        <Pressable
                          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                          onPress={() => adjustRacks(matchIndex, 'home', 1)}
                          disabled={m.homeRacks >= hr}
                        >
                          <Text style={[styles.stepBtnText, m.homeRacks >= hr && styles.stepBtnDisabled]}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.rackRow}>
                      <Text style={styles.rackTeamLabel}>{getPlayerName(m.awayPlayerId, awayRoster)}</Text>
                      <View style={styles.stepper}>
                        <Pressable
                          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                          onPress={() => adjustRacks(matchIndex, 'away', -1)}
                          disabled={m.awayRacks === 0}
                        >
                          <Text style={[styles.stepBtnText, m.awayRacks === 0 && styles.stepBtnDisabled]}>−</Text>
                        </Pressable>
                        <Text style={styles.rackCount}>{m.awayRacks}</Text>
                        <Pressable
                          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                          onPress={() => adjustRacks(matchIndex, 'away', 1)}
                          disabled={m.awayRacks >= ar}
                        >
                          <Text style={[styles.stepBtnText, m.awayRacks >= ar && styles.stepBtnDisabled]}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    {winner && (
                      <View style={styles.winnerBadge}>
                        <Text style={styles.winnerBadgeText}>
                          {winner === 'home' ? getPlayerName(m.homePlayerId, homeRoster) : getPlayerName(m.awayPlayerId, awayRoster)} wins this match
                        </Text>
                      </View>
                    )}
                  </>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    !valid && styles.primaryBtnDisabled,
                    pressed && valid && styles.pressed,
                    { marginTop: 24 },
                  ]}
                  onPress={() => valid && setStep(s => s + 1)}
                  disabled={!valid}
                >
                  <Text style={styles.primaryBtnText}>
                    {step === completedCount + 1 ? 'Review' : 'Next Match →'}
                  </Text>
                </Pressable>
              </ScrollView>
            );
          })()}

          {/* ── Step N+2: Review & confirm ── */}
          {step === completedCount + 2 && (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Review</Text>

              <View style={styles.reviewCard}>
                <Text style={styles.reviewCardTitle}>🪙 Coin Flip</Text>
                <Text style={styles.reviewCardLine}>
                  Won by: {coinFlipWinner === 'home' ? homeTeamName : awayTeamName}
                </Text>
                <Text style={styles.reviewCardLine}>
                  First put-up: {firstPutUpTeam === 'home' ? homeTeamName : awayTeamName}
                </Text>
              </View>

              {matches.map((m, i) => {
                const [hr, ar] = getRacksNeeded(m.homeSL, m.awaySL);
                const winner = getMatchWinner(m);
                return (
                  <View key={i} style={styles.reviewCard}>
                    <Text style={styles.reviewCardTitle}>Match {i + 1}</Text>
                    <Text style={styles.reviewCardLine}>
                      {getPlayerName(m.homePlayerId, homeRoster)} (SL {m.homeSL}) vs{' '}
                      {getPlayerName(m.awayPlayerId, awayRoster)} (SL {m.awaySL})
                    </Text>
                    <Text style={styles.reviewCardLine}>
                      Race to {hr}–{ar} · Result: {m.homeRacks}–{m.awayRacks}
                    </Text>
                    <Text style={[styles.reviewCardWinner, { color: theme.colors.primary }]}>
                      {winner === 'home' ? getPlayerName(m.homePlayerId, homeRoster) : getPlayerName(m.awayPlayerId, awayRoster)} wins
                    </Text>
                  </View>
                );
              })}

              <Text style={styles.nextMatchNote}>
                Next: Match {completedCount + 1} put-up for{' '}
                {(() => {
                  const lastWinner = getMatchWinner(matches[matches.length - 1]);
                  const nextPutUp: Side = lastWinner === 'home' ? 'away' : 'home';
                  return nextPutUp === 'home' ? homeTeamName : awayTeamName;
                })()}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  saving && styles.primaryBtnDisabled,
                  pressed && !saving && styles.pressed,
                  { marginTop: 8 },
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.primaryBtnText}>Confirm & Notify Visiting Team</Text>
                }
              </Pressable>
            </ScrollView>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  container: {
    flex: 1,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    marginBottom: 8,
    gap: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerSub: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  coinEmoji: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: 4,
  },
  // Waiting / verify screens
  waitEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  waitTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  waitSub: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  verifyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
  },
  verifySub: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Step 0 match picker
  countGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 8,
  },
  countBtn: {
    width: '44%',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    gap: 4,
  },
  countBtnNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  countBtnLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Wizard header (steps 1+)
  wizardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    minWidth: 60,
  },
  backBtnText: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  progressText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 12,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  teamBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    gap: 4,
  },
  teamBtnSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '18',
  },
  teamBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  teamBtnSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  teamBtnTextSelected: {
    color: theme.colors.primary,
  },
  matchStepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  playerList: {
    gap: 6,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  playerRowSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '14',
  },
  playerRowDisabled: {
    opacity: 0.35,
  },
  playerRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  playerRowNameSelected: {
    color: theme.colors.primary,
  },
  playerRowNameDisabled: {
    color: theme.colors.textMuted,
  },
  slBadge: {
    backgroundColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  slBadgeSelected: {
    backgroundColor: theme.colors.primary + '28',
  },
  slBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  slBadgeTextSelected: {
    color: theme.colors.primary,
  },
  raceToBadge: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 16,
  },
  raceToText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  rackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rackTeamLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 24,
  },
  stepBtnDisabled: {
    color: theme.colors.textMuted,
  },
  rackCount: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
  winnerBadge: {
    backgroundColor: theme.colors.primary + '18',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary + '40',
  },
  winnerBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  reviewCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reviewCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  reviewCardLine: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  reviewCardWinner: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  reviewCardPts: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: 2,
  },
  disputeBtn: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    marginTop: 8,
  },
  disputeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nextMatchNote: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 52,
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  pressed: {
    opacity: 0.75,
  },
});
