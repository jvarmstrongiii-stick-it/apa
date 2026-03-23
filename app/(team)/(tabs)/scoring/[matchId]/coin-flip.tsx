/**
 * Coin Flip Screen — Two-Device Synchronized Ceremony
 *
 * Both teams navigate here when pressing "Score Match" on a scheduled session.
 *
 * Home device:
 *   waiting_for_away  → Flip button disabled; waiting for Away to pick H/T
 *   ready_to_flip     → Away picked; Flip button active
 *   flipping          → Animation playing
 *   won               → "Put-Up or Defer?" choice
 *   lost_waiting      → Waiting for Away to decide put-up/defer
 *
 * Away device:
 *   choosing_sides    → Heads / Tails buttons
 *   waiting_for_flip  → Picked; waiting for Home to flip
 *   flipping          → Animation playing (synced)
 *   won               → "Put-Up or Defer?" choice
 *   lost_waiting      → Waiting for Home to decide put-up/defer
 *
 * Realtime broadcast channel: coin_flip_${matchId}
 * Events: away_picked | flip_result | winner_decides | cancel
 *
 * After ceremony: writes coin_flip_done + first_put_up_team to team_matches,
 * then both navigate to putup?matchOrder=1&putUpTeam=…
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../../src/constants/theme';
import { supabase } from '../../../../../src/lib/supabase';
import { useAuthContext } from '../../../../../src/providers/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

type Side = 'home' | 'away';
type HeadsTails = 'heads' | 'tails';

type Phase =
  // Home phases
  | 'waiting_for_away'
  | 'ready_to_flip'
  | 'flipping'
  | 'home_won'
  | 'home_lost_waiting'
  // Away phases
  | 'waiting_for_home'      // Away waits here until Home joins the channel
  | 'choosing_sides'
  | 'away_waiting_flip'
  | 'away_won'
  | 'away_lost_waiting'
  // Shared terminal
  | 'navigating';

// ─── Coin animation ────────────────────────────────────────────────────────────

const COIN_SIZE = 120;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CoinFlipScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { profile } = useAuthContext();
  const teamId = profile?.team_id;

  const [loading, setLoading] = useState(true);
  const [ourSide, setOurSide] = useState<Side>('home');
  const [opponentName, setOpponentName] = useState('');
  const [awayChoice, setAwayChoice] = useState<HeadsTails | null>(null);
  const [flipResult, setFlipResult] = useState<HeadsTails | null>(null);
  const [phase, setPhase] = useState<Phase>('waiting_for_away');
  const [flipEarlyTapped, setFlipEarlyTapped] = useState(false);
  const [channelReady, setChannelReady] = useState(false);

  const scaleX = useRef(new Animated.Value(1)).current;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ourSideRef = useRef<Side>('home');
  const awayChoiceRef = useRef<HeadsTails | null>(null);

  // Block Android hardware back button during ceremony
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // ── Init + Realtime channel (merged so channel is created after side is known) ─

  useEffect(() => {
    if (!matchId || !teamId) return;
    let cancelled = false;

    const setup = async () => {
      const { data: tm } = await supabase
        .from('team_matches')
        .select('home_team_id, away_team_id, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
        .eq('id', matchId)
        .single();

      if (!tm || cancelled) { setLoading(false); return; }

      const side: Side = (tm as any).home_team_id === teamId ? 'home' : 'away';
      const oppName = side === 'home'
        ? ((tm as any).away_team?.name ?? 'Away Team')
        : ((tm as any).home_team?.name ?? 'Home Team');

      setOurSide(side);
      ourSideRef.current = side;
      setOpponentName(oppName);
      // Away starts at waiting_for_home — H/T buttons only unlock after Home joins
      setPhase(side === 'home' ? 'waiting_for_away' : 'waiting_for_home');
      setLoading(false);

      if (cancelled) return;

      // ── Channel (created after side is known) ──────────────────────────────
      const channel = supabase.channel(`coin_flip_${matchId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on('broadcast', { event: 'home_ready' }, () => {
          // Away: Home joined — unlock H/T selection
          if (ourSideRef.current === 'away') {
            setPhase(ph => ph === 'waiting_for_home' ? 'choosing_sides' : ph);
          }
        })
        .on('broadcast', { event: 'away_picked' }, ({ payload }) => {
          const choice = payload.choice as HeadsTails;
          setAwayChoice(choice);
          awayChoiceRef.current = choice;
          if (ourSideRef.current === 'home') {
            setPhase('ready_to_flip');
            setFlipEarlyTapped(false);
          }
        })
        .on('broadcast', { event: 'flip_result' }, ({ payload }) => {
          const result = payload.result as HeadsTails;
          const awayPick = payload.awayChoice as HeadsTails;
          setFlipResult(result);
          setAwayChoice(awayPick);
          awayChoiceRef.current = awayPick;
          const awayWon = result === awayPick;
          const weWon = ourSideRef.current === 'away' ? awayWon : !awayWon;
          runFlipAnimation(result, () => {
            setPhase(weWon
              ? (ourSideRef.current === 'home' ? 'home_won' : 'away_won')
              : (ourSideRef.current === 'home' ? 'home_lost_waiting' : 'away_lost_waiting'));
          });
        })
        .on('broadcast', { event: 'winner_decides' }, ({ payload }) => {
          navigateToPutUp(payload.putUpTeam as Side);
        })
        .on('broadcast', { event: 'cancel' }, () => {
          router.replace('/(team)/(tabs)/scoring');
        })
        .on('presence', { event: 'sync' }, () => {
          // Away: if Home is already present (Home arrived before Away), unlock immediately
          if (ourSideRef.current !== 'away') return;
          const state = channel.presenceState<{ side?: Side }>();
          const homePresent = Object.values(state)
            .flat()
            .some((p: any) => p.side === 'home');
          if (homePresent) {
            setPhase(ph => ph === 'waiting_for_home' ? 'choosing_sides' : ph);
          }
        })
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') return;
          setChannelReady(true);
          // Announce presence so the other device can detect us
          channel.track({ side });
          // Home: signal to Away that they may now choose H/T
          if (side === 'home') {
            channel.send({ type: 'broadcast', event: 'home_ready', payload: {} });
          }
        });

      if (!cancelled) channelRef.current = channel;
    };

    setup().catch((e) => {
      console.error('CoinFlip setup failed:', e);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [matchId, teamId]);

  // ── Flip animation ──────────────────────────────────────────────────────────

  const runFlipAnimation = (result: HeadsTails, onDone: () => void) => {
    setPhase('flipping');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(scaleX, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleX, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleX, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleX, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleX, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleX, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
    });
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleAwayPick = (choice: HeadsTails) => {
    setAwayChoice(choice);
    awayChoiceRef.current = choice;
    setPhase('away_waiting_flip');
    Haptics.selectionAsync();
    channelRef.current?.send({
      type: 'broadcast',
      event: 'away_picked',
      payload: { choice },
    });
  };

  const handleFlip = () => {
    if (!awayChoiceRef.current) {
      setFlipEarlyTapped(true);
      return;
    }
    const result: HeadsTails = Math.random() < 0.5 ? 'heads' : 'tails';
    const awayPick = awayChoiceRef.current;

    // Broadcast result to away device
    channelRef.current?.send({
      type: 'broadcast',
      event: 'flip_result',
      payload: { result, awayChoice: awayPick },
    });

    // Determine winner for home device
    const awayWon = result === awayPick;
    const homeWon = !awayWon;
    setFlipResult(result);

    runFlipAnimation(result, () => {
      setPhase(homeWon ? 'home_won' : 'home_lost_waiting');
    });
  };

  const handleWinnerDecides = (putUpFirst: boolean) => {
    const putUpTeam: Side = putUpFirst ? ourSide : (ourSide === 'home' ? 'away' : 'home');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'winner_decides',
      payload: { putUpTeam },
    });

    navigateToPutUp(putUpTeam);
  };

  const navigateToPutUp = async (putUpTeam: Side) => {
    setPhase('navigating');

    // Write result to DB — winner is the side that called handleWinnerDecides (ourSideRef.current)
    await supabase
      .from('team_matches')
      .update({
        coin_flip_done: true,
        first_put_up_team: putUpTeam,
        coin_flip_winner: ourSideRef.current,
      })
      .eq('id', matchId)
      .then(({ error }) => { if (error) console.error('coin_flip write failed:', error.message); });

    router.replace(
      `/(team)/(tabs)/scoring/${matchId}/putup?matchOrder=1&putUpTeam=${putUpTeam}`
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Coin Flip?',
      'This will cancel the match for both scorekeepers, and will need to be restarted from the beginning. Do you want to continue?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            channelRef.current?.send({ type: 'broadcast', event: 'cancel', payload: {} });
            router.replace('/(team)/(tabs)/scoring');
          },
        },
      ]
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const coinLabel = flipResult
    ? (flipResult === 'heads' ? 'H' : 'T')
    : '?';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Coin Flip</Text>
          <Text style={styles.headerSub}>vs {opponentName}</Text>
        </View>

        <View style={styles.body}>

          {/* ── HOME: waiting for away ── */}
          {phase === 'waiting_for_away' && (
            <>
              <Text style={styles.title}>Flip the Coin</Text>
              <Text style={styles.subtitle}>
                Waiting for {opponentName} to choose Heads or Tails…
              </Text>
              <ActivityIndicator size="large" color={theme.colors.primary} style={styles.spinner} />

              {flipEarlyTapped && (
                <View style={styles.warningBox}>
                  <Ionicons name="information-circle-outline" size={18} color="#F59E0B" />
                  <Text style={styles.warningText}>
                    Waiting for {opponentName} to choose Heads or Tails first.
                  </Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [styles.primaryBtn, styles.btnDisabled, pressed && styles.pressed]}
                onPress={() => setFlipEarlyTapped(true)}
              >
                <Text style={styles.primaryBtnText}>Flip!</Text>
              </Pressable>
            </>
          )}

          {/* ── HOME: ready to flip ── */}
          {phase === 'ready_to_flip' && (
            <>
              <Text style={styles.title}>Flip the Coin</Text>
              <Text style={styles.subtitle}>
                {opponentName} chose{' '}
                <Text style={styles.choiceHighlight}>
                  {awayChoice === 'heads' ? 'Heads' : 'Tails'}
                </Text>
                . Tap to flip!
              </Text>

              <Pressable onPress={handleFlip} style={styles.coinWrapper}>
                <Animated.View style={[styles.coin, { transform: [{ scaleX }] }]}>
                  <Text style={styles.coinSymbol}>?</Text>
                </Animated.View>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={handleFlip}
              >
                <Text style={styles.primaryBtnText}>Flip!</Text>
              </Pressable>
            </>
          )}

          {/* ── BOTH: flipping ── */}
          {phase === 'flipping' && (
            <>
              <Text style={styles.title}>Flipping…</Text>
              <View style={styles.coinWrapper}>
                <Animated.View style={[styles.coin, { transform: [{ scaleX }] }]}>
                  <Text style={styles.coinSymbol}>?</Text>
                </Animated.View>
              </View>
            </>
          )}

          {/* ── HOME: won ── */}
          {phase === 'home_won' && (
            <>
              <View style={styles.coin}>
                <Text style={styles.coinSymbol}>{coinLabel}</Text>
              </View>
              <Text style={[styles.resultLabel, { color: '#22C55E' }]}>
                {flipResult === 'heads' ? 'HEADS' : 'TAILS'}!
              </Text>
              <Text style={styles.title}>🏆 You Won the Flip!</Text>
              <Text style={styles.subtitle}>
                Accept the put-up and name your player first, or defer to {opponentName}?
              </Text>

              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={() => handleWinnerDecides(true)}
              >
                <Text style={styles.primaryBtnText}>Accept Put-Up</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={() => handleWinnerDecides(false)}
              >
                <Text style={styles.secondaryBtnText}>Defer to {opponentName}</Text>
              </Pressable>
            </>
          )}

          {/* ── HOME: lost, waiting ── */}
          {phase === 'home_lost_waiting' && (
            <>
              <View style={styles.coin}>
                <Text style={styles.coinSymbol}>{coinLabel}</Text>
              </View>
              <Text style={[styles.resultLabel, { color: '#EF4444' }]}>
                {flipResult === 'heads' ? 'HEADS' : 'TAILS'}!
              </Text>
              <Text style={styles.title}>You Lost the Flip</Text>
              <Text style={styles.subtitle}>
                Waiting for {opponentName} to decide whether to put-up or defer…
              </Text>
              <ActivityIndicator size="large" color={theme.colors.primary} style={styles.spinner} />
            </>
          )}

          {/* ── AWAY: choosing sides ── */}
          {phase === 'choosing_sides' && (
            <>
              <Text style={styles.coinEmoji}>🪙</Text>
              <Text style={styles.title}>Choose Your Side</Text>
              <Text style={styles.subtitle}>
                {opponentName} will flip the coin after you pick.
              </Text>

              <View style={styles.headsOrTailsRow}>
                <Pressable
                  style={({ pressed }) => [styles.htBtn, pressed && styles.pressed]}
                  onPress={() => handleAwayPick('heads')}
                >
                  <Text style={styles.htBtnText}>Heads</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.htBtn, pressed && styles.pressed]}
                  onPress={() => handleAwayPick('tails')}
                >
                  <Text style={styles.htBtnText}>Tails</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* ── AWAY: waiting for home to arrive ── */}
          {phase === 'waiting_for_home' && (
            <>
              <Text style={styles.coinEmoji}>🪙</Text>
              <Text style={styles.title}>Get Ready</Text>
              <Text style={styles.subtitle}>
                Waiting for {opponentName} to open Score Match…
              </Text>
              <ActivityIndicator size="large" color={theme.colors.primary} style={styles.spinner} />
            </>
          )}

          {/* ── AWAY: waiting for flip ── */}
          {phase === 'away_waiting_flip' && (
            <>
              <Text style={styles.coinEmoji}>🪙</Text>
              <Text style={styles.title}>
                You chose{' '}
                <Text style={styles.choiceHighlight}>
                  {awayChoice === 'heads' ? 'Heads' : 'Tails'}
                </Text>
              </Text>
              <Text style={styles.subtitle}>
                Waiting for {opponentName} to flip…
              </Text>
              <ActivityIndicator size="large" color={theme.colors.primary} style={styles.spinner} />
            </>
          )}

          {/* ── AWAY: won ── */}
          {phase === 'away_won' && (
            <>
              <View style={styles.coin}>
                <Text style={styles.coinSymbol}>{coinLabel}</Text>
              </View>
              <Text style={[styles.resultLabel, { color: '#22C55E' }]}>
                {flipResult === 'heads' ? 'HEADS' : 'TAILS'}!
              </Text>
              <Text style={styles.title}>🏆 You Won the Flip!</Text>
              <Text style={styles.subtitle}>
                You picked{' '}
                <Text style={styles.choiceHighlight}>
                  {awayChoice === 'heads' ? 'Heads' : 'Tails'}
                </Text>
                {' '}and the coin landed on it.{'\n'}
                Accept the put-up or defer to {opponentName}?
              </Text>

              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={() => handleWinnerDecides(true)}
              >
                <Text style={styles.primaryBtnText}>Accept Put-Up</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={() => handleWinnerDecides(false)}
              >
                <Text style={styles.secondaryBtnText}>Defer to {opponentName}</Text>
              </Pressable>
            </>
          )}

          {/* ── AWAY: lost, waiting ── */}
          {phase === 'away_lost_waiting' && (
            <>
              <View style={styles.coin}>
                <Text style={styles.coinSymbol}>{coinLabel}</Text>
              </View>
              <Text style={[styles.resultLabel, { color: '#EF4444' }]}>
                {flipResult === 'heads' ? 'HEADS' : 'TAILS'}!
              </Text>
              <Text style={styles.title}>You Lost the Flip</Text>
              <Text style={styles.subtitle}>
                Waiting for {opponentName} to decide whether to put-up or defer…
              </Text>
              <ActivityIndicator size="large" color={theme.colors.primary} style={styles.spinner} />
            </>
          )}

          {/* ── Navigating ── */}
          {phase === 'navigating' && (
            <>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.subtitle}>Starting session…</Text>
            </>
          )}

        </View>

        {/* Cancel — always visible except during navigation */}
        {phase !== 'navigating' && (
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            onPress={handleCancel}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        )}

      </View>
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
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  spinner: {
    marginVertical: 12,
  },
  coinEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  coinWrapper: {
    marginVertical: 8,
  },
  coin: {
    width: COIN_SIZE,
    height: COIN_SIZE,
    borderRadius: COIN_SIZE / 2,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#D97706',
    marginVertical: 8,
  },
  coinSymbol: {
    fontSize: 42,
    fontWeight: '900',
    color: '#92400E',
  },
  resultLabel: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  choiceHighlight: {
    fontWeight: '700',
    color: theme.colors.primary,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F59E0B18',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B40',
    padding: 12,
    width: '100%',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#F59E0B',
    lineHeight: 18,
  },
  headsOrTailsRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  htBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  htBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
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
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.4,
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
  cancelBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
});
