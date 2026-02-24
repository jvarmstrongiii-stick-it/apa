/**
 * Individual Match Scoring Screen
 *
 * Turn-based 8-ball (and basic 9-ball) scorekeeper.
 *
 * Flow per rack:
 *   1. Lag for break (first rack) or winner-breaks (subsequent racks)
 *   2. Turn buttons: Turn Over / Defensive Shot / Time Out / Foul / Game Over
 *   3. Innings auto-increment when non-breaker ends their turn
 *   4. Innings verification (two-device agreement) before next rack
 *   5. Match ends when a player reaches their race-to target
 *
 * Innings rule: inning completes when the non-breaker ends their turn.
 * Winner of each rack breaks the next rack.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../../../src/constants/theme';
import { supabase } from '../../../../../../src/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type GameFormat = '8-ball' | '9-ball';
type Side = 'home' | 'away';
type ActionPhase = 'turn' | 'foul_options' | 'game_over_options' | 'innings_verify';

interface PlayerInfo {
  name: string;
  skill_level: number;
  race_to: number;
}

interface GameOverOption {
  label: string;
  winner: 'current' | 'opponent';
  special: 'eight_on_break' | 'break_and_run' | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * 8-ball race table: RACE[homeSL][awaySL] = [homeRaceTo, awayRaceTo]
 * Based on the APA skill level chart.
 */
const RACE: Record<number, Record<number, [number, number]>> = {
  2: { 2: [2, 2], 3: [2, 3], 4: [2, 4], 5: [2, 5], 6: [2, 6], 7: [2, 7] },
  3: { 2: [3, 2], 3: [2, 2], 4: [2, 3], 5: [2, 4], 6: [2, 5], 7: [2, 6] },
  4: { 2: [4, 2], 3: [3, 2], 4: [3, 3], 5: [3, 4], 6: [3, 5], 7: [2, 5] },
  5: { 2: [5, 2], 3: [4, 2], 4: [4, 3], 5: [4, 4], 6: [4, 5], 7: [3, 5] },
  6: { 2: [6, 2], 3: [5, 2], 4: [5, 3], 5: [5, 4], 6: [5, 5], 7: [4, 5] },
  7: { 2: [7, 2], 3: [6, 2], 4: [5, 2], 5: [5, 3], 6: [5, 4], 7: [5, 5] },
};

function getRace(homeSL: number, awaySL: number): [number, number] {
  return RACE[homeSL]?.[awaySL] ?? [2, 2];
}

/** SL ≤ 3 → 2 timeouts/rack; SL ≥ 4 → 1 timeout/rack */
function timeoutsForSL(sl: number): number {
  return sl <= 3 ? 2 : 1;
}

const FOUL_OPTIONS: string[] = [
  'Scratch on Break',
  'Scratched',
  'Hit Wrong Ball First',
  'Legal Contact',
  'No Rail Hit',
];

const GAME_OVER_BREAK: GameOverOption[] = [
  { label: 'Made 8 on the Break',        winner: 'current',  special: 'eight_on_break' },
  { label: 'Break and Run',              winner: 'current',  special: 'break_and_run'  },
  { label: 'Fouled & Pocketed 8 Ball',   winner: 'opponent', special: null             },
];

const GAME_OVER_NORMAL_8: GameOverOption[] = [
  { label: 'Made 8 Ball',                     winner: 'current',  special: null },
  { label: 'Scratched on 8 Ball',             winner: 'opponent', special: null },
  { label: '8 Ball in Wrong Pocket',          winner: 'opponent', special: null },
  { label: 'Made 8 Ball, Pocket Not Marked',  winner: 'opponent', special: null },
];

const GAME_OVER_NORMAL_9: GameOverOption[] = [
  { label: 'Made 9 Ball',        winner: 'current',  special: null },
  { label: 'Scratched on 9 Ball', winner: 'opponent', special: null },
];

const INACTIVITY_TIMEOUT_MS = 60_000;

// ─── Component ────────────────────────────────────────────────────────────────

export default function IndividualMatchScoringScreen() {
  const { matchId, individualMatchIndex } = useLocalSearchParams<{
    matchId: string;
    individualMatchIndex: string;
  }>();
  const matchIndex = parseInt(individualMatchIndex ?? '0');

  // ── Data loading ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [gameFormat, setGameFormat] = useState<GameFormat>('8-ball');
  const [individualMatchId, setIndividualMatchId] = useState<string | null>(null);
  const [homePlayer, setHomePlayer] = useState<PlayerInfo>({
    name: 'Home Player', skill_level: 3, race_to: 2,
  });
  const [awayPlayer, setAwayPlayer] = useState<PlayerInfo>({
    name: 'Away Player', skill_level: 3, race_to: 2,
  });

  // ── Match-level aggregates ───────────────────────────────────────────────────
  const [racksWonHome, setRacksWonHome] = useState(0);
  const [racksWonAway, setRacksWonAway] = useState(0);
  const [totalInnings, setTotalInnings] = useState(0);
  const [defShotsHome, setDefShotsHome] = useState(0);
  const [defShotsAway, setDefShotsAway] = useState(0);
  const [breakAndRunHome, setBreakAndRunHome] = useState(false);
  const [breakAndRunAway, setBreakAndRunAway] = useState(false);
  const [eightOnBreakHome, setEightOnBreakHome] = useState(false);
  const [eightOnBreakAway, setEightOnBreakAway] = useState(false);

  // ── Rack state ───────────────────────────────────────────────────────────────
  const [rackNumber, setRackNumber] = useState(1);
  const [breakPlayer, setBreakPlayer] = useState<Side | null>(null); // null = lag not done yet
  const [isBreakTurn, setIsBreakTurn] = useState(true);   // breaker's first turn of this rack
  const [currentShooterIsBreaker, setCurrentShooterIsBreaker] = useState(true);
  const [rackInnings, setRackInnings] = useState(0);
  const [timeoutsHome, setTimeoutsHome] = useState(2);
  const [timeoutsAway, setTimeoutsAway] = useState(2);

  // ── Innings verification (two-device agreement before next rack) ─────────────
  //  After a rack ends both scorekeepers enter their inning count independently.
  //  If they match → proceed. If not → use +/- to reconcile.
  const [verifyMyInnings, setVerifyMyInnings] = useState<number>(0);  // this device's entry
  const [verifyTheirInnings, setVerifyTheirInnings] = useState<number | null>(null); // DB value
  const [pendingRackWinner, setPendingRackWinner] = useState<Side | null>(null);

  // ── Action phase ─────────────────────────────────────────────────────────────
  const [actionPhase, setActionPhase] = useState<ActionPhase>('turn');

  // ── Timeout (per-turn, 60 s) ─────────────────────────────────────────────────
  const [timeoutActive, setTimeoutActive] = useState(false);
  const [timeoutExpired, setTimeoutExpired] = useState(false);
  const [timeoutSecsLeft, setTimeoutSecsLeft] = useState(60);
  const timeoutFlash = useRef(new Animated.Value(1)).current;
  const timeoutFlashLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Inactivity alert (60 s no tap) ───────────────────────────────────────────
  const [inactivityVisible, setInactivityVisible] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Derived state ───────────────────────────────────────────────────────────

  const currentShooter: Side | null =
    breakPlayer === null
      ? null
      : currentShooterIsBreaker
        ? breakPlayer
        : breakPlayer === 'home' ? 'away' : 'home';

  const currentPlayer = currentShooter === 'home' ? homePlayer : awayPlayer;
  const currentTimeouts = currentShooter === 'home' ? timeoutsHome : timeoutsAway;

  const homeOnHill =
    racksWonHome === homePlayer.race_to - 1 && racksWonHome < homePlayer.race_to;
  const awayOnHill =
    racksWonAway === awayPlayer.race_to - 1 && racksWonAway < awayPlayer.race_to;

  const gameOverOptions: GameOverOption[] =
    isBreakTurn
      ? GAME_OVER_BREAK
      : gameFormat === '8-ball'
        ? GAME_OVER_NORMAL_8
        : GAME_OVER_NORMAL_9;

  // ─── Load match data ─────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      if (!matchId) return;
      try {
        const { data: tm } = await supabase
          .from('team_matches')
          .select('division:divisions!division_id(league:leagues!league_id(game_format))')
          .eq('id', matchId)
          .single();

        const fmt: GameFormat =
          (tm?.division as any)?.league?.game_format === 'nine_ball' ? '9-ball' : '8-ball';
        setGameFormat(fmt);

        const { data: ims } = await supabase
          .from('individual_matches')
          .select([
            'id',
            'home_player:players!home_player_id(first_name, last_name, skill_level)',
            'away_player:players!away_player_id(first_name, last_name, skill_level)',
          ].join(', '))
          .eq('team_match_id', matchId)
          .eq('match_order', matchIndex + 1)
          .limit(1);

        if (ims && ims.length > 0) {
          const im = ims[0] as any;
          setIndividualMatchId(im.id);
          const hsl: number = im.home_player?.skill_level ?? 3;
          const asl: number = im.away_player?.skill_level ?? 3;
          const [rh, ra] = getRace(hsl, asl);
          setHomePlayer({
            name:
              `${im.home_player?.first_name ?? ''} ${im.home_player?.last_name ?? ''}`.trim() ||
              'Home Player',
            skill_level: hsl,
            race_to: rh,
          });
          setAwayPlayer({
            name:
              `${im.away_player?.first_name ?? ''} ${im.away_player?.last_name ?? ''}`.trim() ||
              'Away Player',
            skill_level: asl,
            race_to: ra,
          });
          setTimeoutsHome(timeoutsForSL(hsl));
          setTimeoutsAway(timeoutsForSL(asl));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [matchId, matchIndex]);

  // ─── Inactivity timer ────────────────────────────────────────────────────────

  const resetInactivity = useCallback(() => {
    setInactivityVisible(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      setInactivityVisible(true);
    }, INACTIVITY_TIMEOUT_MS);
  }, []);

  // Start inactivity timer once scoring begins
  useEffect(() => {
    if (breakPlayer !== null) resetInactivity();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [breakPlayer, resetInactivity]);

  // ─── Timeout countdown ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!timeoutActive) return;
    if (timeoutSecsLeft <= 0) {
      setTimeoutActive(false);
      setTimeoutExpired(true);
      timeoutFlashLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(timeoutFlash, { toValue: 0.15, duration: 350, useNativeDriver: true }),
          Animated.timing(timeoutFlash, { toValue: 1,    duration: 350, useNativeDriver: true }),
        ])
      );
      timeoutFlashLoop.current.start();
      return;
    }
    const t = setTimeout(() => setTimeoutSecsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeoutActive, timeoutSecsLeft, timeoutFlash]);

  function stopTimeoutFlash() {
    timeoutFlashLoop.current?.stop();
    timeoutFlashLoop.current = null;
    timeoutFlash.setValue(1);
  }

  // ─── Rack helpers ────────────────────────────────────────────────────────────

  function initRack(breaker: Side) {
    setBreakPlayer(breaker);
    setIsBreakTurn(true);
    setCurrentShooterIsBreaker(true);
    setRackInnings(0);
    setTimeoutsHome(timeoutsForSL(homePlayer.skill_level));
    setTimeoutsAway(timeoutsForSL(awayPlayer.skill_level));
    setActionPhase('turn');
    setTimeoutActive(false);
    setTimeoutExpired(false);
    stopTimeoutFlash();
    resetInactivity();
  }

  /**
   * End the current shooter's turn.
   * Inning increments when the non-breaker ends their turn
   * (i.e., both players have shot since the last count).
   */
  function endTurn() {
    if (!isBreakTurn && !currentShooterIsBreaker) {
      // Non-breaker finishing their turn → inning complete
      setRackInnings(r => r + 1);
      setTotalInnings(t => t + 1);
    }
    if (isBreakTurn) setIsBreakTurn(false);
    setCurrentShooterIsBreaker(v => !v);
    setActionPhase('turn');
    setTimeoutActive(false);
    setTimeoutExpired(false);
    stopTimeoutFlash();
    resetInactivity();
  }

  // ─── Turn action handlers ────────────────────────────────────────────────────

  function handleTurnOver() {
    endTurn();
  }

  function handleDefensiveShot() {
    if (currentShooter === 'home') setDefShotsHome(d => d + 1);
    else setDefShotsAway(d => d + 1);
    endTurn();
  }

  function handleTimeout() {
    if (currentTimeouts <= 0) {
      Alert.alert('No Timeouts Left', `${currentPlayer.name} has no timeouts remaining this rack.`);
      return;
    }
    if (currentShooter === 'home') setTimeoutsHome(t => t - 1);
    else setTimeoutsAway(t => t - 1);
    setTimeoutSecsLeft(60);
    setTimeoutExpired(false);
    setTimeoutActive(true);
    resetInactivity();
  }

  function dismissTimeout() {
    stopTimeoutFlash();
    setTimeoutExpired(false);
    resetInactivity();
  }

  function handleFoul(_foulType: string) {
    // Foul ends the turn (ball-in-hand to opponent)
    endTurn();
  }

  /**
   * A rack-ending action was selected.
   * winner: 'current' = the shooter wins the rack; 'opponent' = opponent wins.
   */
  function handleGameOver(winner: 'current' | 'opponent', special: string | null) {
    if (!currentShooter) return;

    const rackWinner: Side =
      winner === 'current' ? currentShooter : (currentShooter === 'home' ? 'away' : 'home');

    if (special === 'break_and_run') {
      if (rackWinner === 'home') setBreakAndRunHome(true);
      else setBreakAndRunAway(true);
    }
    if (special === 'eight_on_break') {
      if (rackWinner === 'home') setEightOnBreakHome(true);
      else setEightOnBreakAway(true);
    }

    // Pause for innings verification before advancing
    setPendingRackWinner(rackWinner);
    setVerifyMyInnings(rackInnings);  // pre-fill with our live count
    setVerifyTheirInnings(null);       // will be read from DB
    setActionPhase('innings_verify');
    resetInactivity();
  }

  /**
   * Called when the user confirms the innings count after verification.
   * finalInnings: the agreed-upon count.
   */
  function confirmInnings(finalInnings: number) {
    const rackWinner = pendingRackWinner!;

    // Reconcile: update running totals if innings changed from live count
    const diff = finalInnings - rackInnings;
    if (diff !== 0) {
      setRackInnings(finalInnings);
      setTotalInnings(t => t + diff);
    }

    const newHome = rackWinner === 'home' ? racksWonHome + 1 : racksWonHome;
    const newAway = rackWinner === 'away' ? racksWonAway + 1 : racksWonAway;
    setRacksWonHome(newHome);
    setRacksWonAway(newAway);
    setPendingRackWinner(null);

    if (newHome >= homePlayer.race_to || newAway >= awayPlayer.race_to) {
      saveAndNavigate(newHome, newAway);
    } else {
      // Winner breaks next rack
      setRackNumber(n => n + 1);
      initRack(rackWinner);
    }
  }

  // ─── Save & navigate ─────────────────────────────────────────────────────────

  async function saveAndNavigate(finalHome: number, finalAway: number) {
    if (individualMatchId) {
      try {
        await supabase
          .from('individual_matches')
          .update({
            home_points_earned: finalHome,
            away_points_earned: finalAway,
            innings: totalInnings,
          })
          .eq('id', individualMatchId);

        await supabase
          .from('team_matches')
          .update({ status: 'in_progress' })
          .eq('id', matchId!)
          .in('status', ['lineup_set', 'scheduled']);
      } catch (e) {
        console.error('Save error:', e);
      }
    }

    if (matchIndex < 4) {
      const loser: Side = finalHome > finalAway ? 'away' : 'home';
      router.push(
        `/(team)/(tabs)/scoring/${matchId}/putup?matchOrder=${matchIndex + 2}&putUpTeam=${loser}`
      );
    } else {
      router.push(`/(team)/(tabs)/scoring/${matchId}/finalize`);
    }
  }

  // ─── Render: Loading ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerFill}>
          <Text style={styles.loadingText}>Loading match…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render: Lag for break ───────────────────────────────────────────────────

  if (breakPlayer === null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerBar}>
          <Pressable style={styles.headerButton} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Match {matchIndex + 1} of 5</Text>
            <Text style={styles.headerSubtitle}>Lag for Break</Text>
          </View>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.lagContainer}>
          <Text style={styles.lagTitle}>Who won the lag?</Text>
          <Text style={styles.lagBody}>The lag winner breaks first.</Text>

          <Pressable
            style={({ pressed }) => [styles.lagBtn, pressed && styles.pressed]}
            onPress={() => initRack('home')}
          >
            <Text style={styles.lagBtnName}>{homePlayer.name}</Text>
            <Text style={styles.lagBtnSub}>Home · SL {homePlayer.skill_level}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.lagBtn, pressed && styles.pressed]}
            onPress={() => initRack('away')}
          >
            <Text style={styles.lagBtnName}>{awayPlayer.name}</Text>
            <Text style={styles.lagBtnSub}>Away · SL {awayPlayer.skill_level}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render: Main scoring screen ─────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.headerBar}>
        <Pressable style={styles.headerButton} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Match {matchIndex + 1} of 5</Text>
          <Text style={styles.headerSubtitle}>{gameFormat} · Rack {rackNumber}</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      {/* ── Scoreboard ── */}
      <View style={styles.scoreboard}>
        {/* Home side */}
        <View style={styles.sbColumn}>
          <Text style={styles.sbName} numberOfLines={1}>{homePlayer.name}</Text>
          <Text style={styles.sbMeta}>SL {homePlayer.skill_level} · Race {homePlayer.race_to}</Text>
          <View style={styles.rackDots}>
            {Array.from({ length: homePlayer.race_to }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < racksWonHome && styles.dotFilled,
                  homeOnHill && i === homePlayer.race_to - 1 && styles.dotHill,
                ]}
              />
            ))}
          </View>
          {homeOnHill && <Text style={styles.hillText}>ON THE HILL</Text>}
        </View>

        {/* Center score */}
        <View style={styles.sbCenter}>
          <Text style={styles.sbScore}>{racksWonHome} – {racksWonAway}</Text>
          <Text style={styles.sbInnings}>Inn: {rackInnings}</Text>
          <Text style={styles.sbDefensive}>Def {defShotsHome} | {defShotsAway}</Text>
        </View>

        {/* Away side */}
        <View style={[styles.sbColumn, styles.sbRight]}>
          <Text style={[styles.sbName, styles.textRight]} numberOfLines={1}>
            {awayPlayer.name}
          </Text>
          <Text style={[styles.sbMeta, styles.textRight]}>
            SL {awayPlayer.skill_level} · Race {awayPlayer.race_to}
          </Text>
          <View style={[styles.rackDots, styles.rackDotsRight]}>
            {Array.from({ length: awayPlayer.race_to }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < racksWonAway && styles.dotFilled,
                  awayOnHill && i === awayPlayer.race_to - 1 && styles.dotHill,
                ]}
              />
            ))}
          </View>
          {awayOnHill && <Text style={[styles.hillText, styles.textRight]}>ON THE HILL</Text>}
        </View>
      </View>

      {/* ── Timeout banner ── */}
      {(timeoutActive || timeoutExpired) && (
        <View style={[styles.timeoutBanner, timeoutExpired && styles.timeoutBannerExpired]}>
          {timeoutActive ? (
            <>
              <Text style={styles.timeoutLabel}>TIME OUT</Text>
              <Text style={styles.timeoutCountdown}>{timeoutSecsLeft}s</Text>
            </>
          ) : (
            <Animated.View style={{ opacity: timeoutFlash, width: '100%', alignItems: 'center' }}>
              <Pressable
                style={({ pressed }) => [styles.timeoutDismissBtn, pressed && styles.pressed]}
                onPress={dismissTimeout}
              >
                <Text style={styles.timeoutDismissText}>TAP — TIMEOUT OVER</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      )}

      {/* ── Inactivity alert ── */}
      {inactivityVisible && (
        <View style={styles.inactivityBanner}>
          <Text style={styles.inactivityText}>⚠️ Scorekeeper — still active?</Text>
          <Pressable
            style={({ pressed }) => [styles.inactivityDismiss, pressed && styles.pressed]}
            onPress={resetInactivity}
          >
            <Text style={styles.inactivityDismissText}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      {/* ── Action area ── */}
      <ScrollView
        style={styles.actionScroll}
        contentContainerStyle={styles.actionContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={resetInactivity}
      >
        {/* Current shooter indicator */}
        {actionPhase !== 'innings_verify' && currentShooter !== null && (
          <View style={styles.shooterRow}>
            <View style={[
              styles.shooterBadge,
              currentShooter === 'home' ? styles.shooterHome : styles.shooterAway,
            ]}>
              <Text style={styles.shooterText}>
                {currentPlayer.name}'s Turn
              </Text>
              {isBreakTurn && (
                <View style={styles.breakPill}>
                  <Text style={styles.breakPillText}>BREAK</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Main turn buttons ── */}
        {actionPhase === 'turn' && !timeoutActive && !timeoutExpired && (
          <View style={styles.btnGrid}>

            <Pressable
              style={({ pressed }) => [styles.actBtn, styles.actBtnTurnOver, pressed && styles.pressed]}
              onPress={() => { resetInactivity(); handleTurnOver(); }}
            >
              <Text style={styles.actBtnText}>Turn Over</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actBtn, styles.actBtnDefensive, pressed && styles.pressed]}
              onPress={() => { resetInactivity(); handleDefensiveShot(); }}
            >
              <Text style={styles.actBtnText}>Defensive Shot</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actBtn,
                styles.actBtnTimeout,
                currentTimeouts === 0 && styles.actBtnDisabled,
                pressed && styles.pressed,
              ]}
              onPress={() => { resetInactivity(); handleTimeout(); }}
            >
              <Text style={[styles.actBtnText, currentTimeouts === 0 && styles.actBtnTextDimmed]}>
                {currentTimeouts > 0 ? `Time Out (${currentTimeouts})` : 'Time Out'}
              </Text>
              {currentTimeouts === 0 && (
                <Text style={styles.noTimeoutsHint}>None Left</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actBtn, styles.actBtnFoul, pressed && styles.pressed]}
              onPress={() => { resetInactivity(); setActionPhase('foul_options'); }}
            >
              <Text style={styles.actBtnText}>Foul</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actBtn, styles.actBtnGameOver, pressed && styles.pressed]}
              onPress={() => { resetInactivity(); setActionPhase('game_over_options'); }}
            >
              <Text style={styles.actBtnText}>Game Over</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* ── Foul sub-options ── */}
        {actionPhase === 'foul_options' && (
          <View style={styles.subPanel}>
            <Text style={styles.subPanelTitle}>Select Foul Type</Text>
            {FOUL_OPTIONS.map(foul => (
              <Pressable
                key={foul}
                style={({ pressed }) => [styles.subOptionBtn, styles.subOptNeutral, pressed && styles.pressed]}
                onPress={() => { resetInactivity(); handleFoul(foul); }}
              >
                <Text style={styles.subOptionText}>{foul}</Text>
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              onPress={() => setActionPhase('turn')}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* ── Game Over sub-options ── */}
        {actionPhase === 'game_over_options' && (
          <View style={styles.subPanel}>
            <Text style={styles.subPanelTitle}>
              {isBreakTurn ? 'Break Result' : 'End of Rack'}
            </Text>
            {gameOverOptions.map(opt => (
              <Pressable
                key={opt.label}
                style={({ pressed }) => [
                  styles.subOptionBtn,
                  opt.winner === 'current' ? styles.subOptWin : styles.subOptLose,
                  pressed && styles.pressed,
                ]}
                onPress={() => { resetInactivity(); handleGameOver(opt.winner, opt.special); }}
              >
                <Text style={styles.subOptionText}>{opt.label}</Text>
                <Text style={[
                  styles.subOptResult,
                  opt.winner === 'current' ? styles.subOptResultWin : styles.subOptResultLose,
                ]}>
                  {opt.winner === 'current' ? 'WIN' : 'LOSS'}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              onPress={() => setActionPhase('turn')}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* ── Innings verification ── */}
        {actionPhase === 'innings_verify' && (
          <View style={styles.verifyPanel}>
            <Text style={styles.verifyTitle}>Verify Innings</Text>
            <Text style={styles.verifyBody}>
              Confirm the inning count with the other scorekeeper before starting the next rack.
              Adjust below if needed.
            </Text>

            <View style={styles.verifyCounterRow}>
              <Pressable
                style={styles.verifyCounterBtn}
                onPress={() => setVerifyMyInnings(n => Math.max(0, n - 1))}
              >
                <Ionicons name="remove" size={28} color={theme.colors.text} />
              </Pressable>
              <Text style={styles.verifyCounterValue}>{verifyMyInnings}</Text>
              <Pressable
                style={styles.verifyCounterBtn}
                onPress={() => setVerifyMyInnings(n => n + 1)}
              >
                <Ionicons name="add" size={28} color={theme.colors.text} />
              </Pressable>
            </View>

            <Text style={styles.verifyHint}>
              Innings must match on both devices before continuing.
            </Text>

            {/* Confirm button — in a two-device setup, both devices will enter the same
                count before proceeding. For now this single-device path confirms directly. */}
            <Pressable
              style={({ pressed }) => [styles.verifyConfirmBtn, pressed && styles.pressed]}
              onPress={() => confirmInnings(verifyMyInnings)}
            >
              <Text style={styles.verifyConfirmText}>Confirmed — Start Next Rack</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },

  // ── Header ──
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  // ── Lag ──
  lagContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
  },
  lagTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  lagBody: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  lagBtn: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    gap: 4,
  },
  lagBtnName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  lagBtnSub: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  // ── Scoreboard ──
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 6,
  },
  sbColumn: {
    flex: 1,
  },
  sbRight: {
    alignItems: 'flex-end',
  },
  sbCenter: {
    alignItems: 'center',
    paddingHorizontal: 6,
    minWidth: 72,
  },
  sbName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  sbMeta: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sbScore: {
    fontSize: 30,
    fontWeight: '900',
    color: theme.colors.text,
  },
  sbInnings: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  sbDefensive: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  rackDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 8,
  },
  rackDotsRight: {
    justifyContent: 'flex-end',
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dotHill: {
    borderColor: '#F59E0B',
    borderWidth: 3,
  },
  hillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 1,
    marginTop: 4,
  },

  // ── Timeout banner ──
  timeoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    backgroundColor: '#0D1B2A',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A5F',
  },
  timeoutBannerExpired: {
    backgroundColor: '#5C0A0A',
    borderBottomColor: '#8B0000',
  },
  timeoutLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 2,
  },
  timeoutCountdown: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    minWidth: 64,
    textAlign: 'center',
  },
  timeoutDismissBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#CC2222',
  },
  timeoutDismissText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  // ── Inactivity banner ──
  inactivityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2D1B00',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#5C3A00',
  },
  inactivityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    flex: 1,
  },
  inactivityDismiss: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#5C3A00',
  },
  inactivityDismissText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
  },

  // ── Action area ──
  actionScroll: {
    flex: 1,
  },
  actionContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 12,
  },

  // Shooter indicator
  shooterRow: {
    marginBottom: 4,
  },
  shooterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 10,
  },
  shooterHome: {
    backgroundColor: theme.colors.primary + '22',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  shooterAway: {
    backgroundColor: '#E91E6322',
    borderWidth: 2,
    borderColor: '#E91E63',
  },
  shooterText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  breakPill: {
    backgroundColor: '#F59E0B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  breakPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },

  // Action buttons
  btnGrid: {
    gap: 10,
  },
  actBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 20,
    minHeight: 64,
  },
  actBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actBtnTextDimmed: {
    opacity: 0.6,
  },
  actBtnTurnOver:  { backgroundColor: '#2196F3' },
  actBtnDefensive: { backgroundColor: '#9C27B0' },
  actBtnTimeout:   { backgroundColor: '#FF9800' },
  actBtnFoul:      { backgroundColor: '#607D8B' },
  actBtnGameOver:  { backgroundColor: '#4CAF50' },
  actBtnDisabled:  { opacity: 0.45 },
  noTimeoutsHint: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.75,
  },

  // Sub-panels (foul / game over)
  subPanel: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  subPanelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 54,
  },
  subOptNeutral: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
  },
  subOptWin: {
    backgroundColor: '#4CAF5010',
    borderColor: '#4CAF5060',
  },
  subOptLose: {
    backgroundColor: '#F4433610',
    borderColor: '#F4433660',
  },
  subOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  subOptResult: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subOptResultWin:  { color: '#4CAF50' },
  subOptResultLose: { color: '#F44336' },

  cancelBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },

  // Innings verification panel
  verifyPanel: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#F59E0B',
    gap: 12,
    alignItems: 'center',
  },
  verifyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  verifyBody: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  verifyCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginVertical: 8,
  },
  verifyCounterBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyCounterValue: {
    fontSize: 48,
    fontWeight: '900',
    color: theme.colors.text,
    minWidth: 72,
    textAlign: 'center',
  },
  verifyHint: {
    fontSize: 13,
    color: '#F59E0B',
    textAlign: 'center',
    fontWeight: '600',
  },
  verifyConfirmBtn: {
    width: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  verifyConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Misc
  pressed: { opacity: 0.8 },
  textRight: { textAlign: 'right' },
});
