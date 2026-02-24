/**
 * Finalize Screen
 *
 * Shown after all 5 individual matches are complete.
 * Displays per-match APA points (3/0, 2/0, 2/1 based on hill logic),
 * requires "Both captains agree" before locking, and supports
 * UNLOCK → edit flow for already-finalized matches.
 *
 * APA 8-ball points:
 *   Winner racks = race_to, loser has 0 racks      → winner 3, loser 0
 *   Winner racks = race_to, loser on hill           → winner 2, loser 1
 *   Winner racks = race_to, loser has ≥1 but not hill → winner 2, loser 0
 */

import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../../src/constants/theme';
import { supabase } from '../../../../../src/lib/supabase';
import { useAuthContext } from '../../../../../src/providers/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchResult {
  match_number: number;
  home_player: string;
  away_player: string;
  home_sl: number;
  away_sl: number;
  home_race: number;
  away_race: number;
  home_racks: number;
  away_racks: number;
  innings: number;
  home_pts: number; // APA points
  away_pts: number;
  winner: 'home' | 'away' | null;
  is_complete: boolean;
}

// ─── 8-ball race table ────────────────────────────────────────────────────────

const RACE: Record<number, Record<number, [number, number]>> = {
  2: { 2: [2, 2], 3: [2, 3], 4: [2, 4], 5: [2, 5], 6: [2, 6], 7: [2, 7] },
  3: { 2: [3, 2], 3: [2, 2], 4: [2, 3], 5: [2, 4], 6: [2, 5], 7: [2, 6] },
  4: { 2: [4, 2], 3: [3, 2], 4: [3, 3], 5: [3, 4], 6: [3, 5], 7: [2, 5] },
  5: { 2: [5, 2], 3: [4, 2], 4: [4, 3], 5: [4, 4], 6: [4, 5], 7: [3, 5] },
  6: { 2: [6, 2], 3: [5, 2], 4: [5, 3], 5: [5, 4], 6: [5, 5], 7: [4, 5] },
  7: { 2: [7, 2], 3: [6, 2], 4: [5, 2], 5: [5, 3], 6: [5, 4], 7: [5, 5] },
};

function getRace(hsl: number, asl: number): [number, number] {
  return RACE[hsl]?.[asl] ?? [2, 2];
}

/**
 * APA points for a single individual match.
 * Returns [homePoints, awayPoints].
 */
function calcApaPoints(
  homeRacks: number,
  awayRacks: number,
  homeRaceTo: number,
  awayRaceTo: number,
): [number, number] {
  const homeWon = homeRacks >= homeRaceTo;
  const awayWon = awayRacks >= awayRaceTo;

  if (homeWon) {
    if (awayRacks === 0)                        return [3, 0];
    if (awayRacks === awayRaceTo - 1)           return [2, 1]; // loser on hill
    return [2, 0];
  }
  if (awayWon) {
    if (homeRacks === 0)                        return [0, 3];
    if (homeRacks === homeRaceTo - 1)           return [1, 2]; // loser on hill
    return [0, 2];
  }
  return [0, 0]; // incomplete
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinalizeScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [teamMatchStatus, setTeamMatchStatus] = useState<string>('in_progress');
  const [results, setResults] = useState<MatchResult[]>([]);
  const [captainsAgreed, setCaptainsAgreed] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // UNLOCK flow
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockText, setUnlockText] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      if (!matchId) return;
      try {
        // Fetch team match status
        const { data: tm } = await supabase
          .from('team_matches')
          .select('status')
          .eq('id', matchId)
          .single();
        if (tm) setTeamMatchStatus(tm.status);

        // Fetch individual match results
        const { data, error } = await supabase
          .from('individual_matches')
          .select([
            '*',
            'home_player:players!home_player_id(first_name, last_name, skill_level)',
            'away_player:players!away_player_id(first_name, last_name, skill_level)',
          ].join(', '))
          .eq('team_match_id', matchId)
          .order('match_order');

        if (error) {
          console.error('Failed to fetch results:', error.message);
          return;
        }

        const mapped: MatchResult[] = (data ?? []).map((im: any) => {
          const hsl: number = im.home_player?.skill_level ?? im.home_skill_level ?? 3;
          const asl: number = im.away_player?.skill_level ?? im.away_skill_level ?? 3;
          const [hRace, aRace] = getRace(hsl, asl);
          const hRacks: number = im.home_points_earned ?? 0;
          const aRacks: number = im.away_points_earned ?? 0;
          const [hPts, aPts] = calcApaPoints(hRacks, aRacks, hRace, aRace);
          const winner: 'home' | 'away' | null =
            hRacks >= hRace ? 'home' : aRacks >= aRace ? 'away' : null;
          return {
            match_number: im.match_order,
            home_player:
              `${im.home_player?.first_name ?? ''} ${im.home_player?.last_name ?? ''}`.trim() ||
              'Home Player',
            away_player:
              `${im.away_player?.first_name ?? ''} ${im.away_player?.last_name ?? ''}`.trim() ||
              'Away Player',
            home_sl: hsl,
            away_sl: asl,
            home_race: hRace,
            away_race: aRace,
            home_racks: hRacks,
            away_racks: aRacks,
            innings: im.innings ?? 0,
            home_pts: hPts,
            away_pts: aPts,
            winner,
            is_complete: winner !== null,
          };
        });
        setResults(mapped);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [matchId]);

  // ── Computed totals ────────────────────────────────────────────────────────

  const totalHomePts = results.reduce((s, r) => s + r.home_pts, 0);
  const totalAwayPts = results.reduce((s, r) => s + r.away_pts, 0);
  const homeMatchWins = results.filter(r => r.winner === 'home').length;
  const awayMatchWins = results.filter(r => r.winner === 'away').length;
  const incompleteCount = results.filter(r => !r.is_complete).length;
  const isLocked = teamMatchStatus === 'completed';

  // ── Finalize ───────────────────────────────────────────────────────────────

  const handleFinalize = async () => {
    if (incompleteCount > 0 || !captainsAgreed || isFinalizing) return;
    setIsFinalizing(true);
    try {
      const { error } = await supabase
        .from('team_matches')
        .update({
          status: 'completed',
          home_score: totalHomePts,
          away_score: totalAwayPts,
          finalized_by: user?.id ?? null,
          finalized_at: new Date().toISOString(),
        })
        .eq('id', matchId!);

      if (error) throw error;
      setTeamMatchStatus('completed');
    } catch (e: any) {
      console.error('Finalize error:', e?.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  // ── UNLOCK ─────────────────────────────────────────────────────────────────

  const handleUnlockConfirm = async () => {
    if (unlockText.trim().toUpperCase() !== 'UNLOCK') {
      setUnlockError('Type UNLOCK exactly to proceed.');
      return;
    }
    setIsUnlocking(true);
    try {
      const { error } = await supabase
        .from('team_matches')
        .update({ status: 'in_progress' })
        .eq('id', matchId!);
      if (error) throw error;
      setTeamMatchStatus('in_progress');
      setShowUnlock(false);
      setUnlockText('');
      setUnlockError('');
      setCaptainsAgreed(false);
    } catch (e: any) {
      setUnlockError('Failed to unlock. Try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.headerBar}>
        {!isLocked ? (
          <Pressable style={styles.headerButton} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Match Summary</Text>
          {isLocked && (
            <View style={styles.lockedBadge}>
              <Ionicons name="lock-closed" size={12} color="#4CAF50" />
              <Text style={styles.lockedBadgeText}>FINALIZED</Text>
            </View>
          )}
        </View>
        {isLocked ? (
          <Pressable
            style={styles.headerButton}
            onPress={() => { setShowUnlock(true); setUnlockText(''); setUnlockError(''); }}
            hitSlop={12}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Warnings ── */}
        {incompleteCount > 0 && !isLocked && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color="#FF9800" />
            <Text style={styles.warningText}>
              {incompleteCount} match{incompleteCount > 1 ? 'es' : ''} incomplete — cannot finalize yet.
            </Text>
          </View>
        )}

        {/* ── Total score ── */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>FINAL SCORE</Text>
          <View style={styles.totalRow}>
            <View style={styles.totalSide}>
              <Text style={styles.totalTeam}>Home</Text>
              <Text style={styles.totalPts}>{totalHomePts}</Text>
              <Text style={styles.totalWins}>{homeMatchWins} wins</Text>
            </View>
            <Text style={styles.totalDash}>–</Text>
            <View style={styles.totalSide}>
              <Text style={styles.totalTeam}>Away</Text>
              <Text style={styles.totalPts}>{totalAwayPts}</Text>
              <Text style={styles.totalWins}>{awayMatchWins} wins</Text>
            </View>
          </View>
        </View>

        {/* ── Individual match results ── */}
        <Text style={styles.sectionTitle}>Individual Matches</Text>
        <View style={styles.resultsCard}>
          {results.map((r, idx) => (
            <View
              key={r.match_number}
              style={[
                styles.resultRow,
                idx < results.length - 1 && styles.resultRowBorder,
                !r.is_complete && styles.resultRowIncomplete,
              ]}
            >
              {/* Match # */}
              <View style={styles.matchNumBadge}>
                <Text style={styles.matchNumText}>{r.match_number}</Text>
              </View>

              {/* Players & racks */}
              <View style={styles.resultBody}>
                <View style={styles.resultPlayersRow}>
                  {/* Home player */}
                  <View style={styles.resultPlayer}>
                    <Text
                      style={[styles.resultName, r.winner === 'home' && styles.winnerName]}
                      numberOfLines={1}
                    >
                      {r.home_player}
                    </Text>
                    <Text style={styles.resultMeta}>
                      SL {r.home_sl} · Race {r.home_race}
                    </Text>
                  </View>

                  {/* Racks */}
                  <View style={styles.resultScoreCol}>
                    <Text style={styles.resultRacks}>
                      {r.home_racks} – {r.away_racks}
                    </Text>
                    {r.innings > 0 && (
                      <Text style={styles.resultInnings}>{r.innings} inn</Text>
                    )}
                  </View>

                  {/* Away player */}
                  <View style={[styles.resultPlayer, styles.resultPlayerRight]}>
                    <Text
                      style={[styles.resultName, styles.textRight, r.winner === 'away' && styles.winnerName]}
                      numberOfLines={1}
                    >
                      {r.away_player}
                    </Text>
                    <Text style={[styles.resultMeta, styles.textRight]}>
                      SL {r.away_sl} · Race {r.away_race}
                    </Text>
                  </View>
                </View>

                {/* APA points row */}
                {r.is_complete && (
                  <View style={styles.ptsRow}>
                    <View style={[styles.ptsBadge, r.home_pts > 0 && styles.ptsBadgeActive]}>
                      <Text style={[styles.ptsValue, r.home_pts > 0 && styles.ptsValueActive]}>
                        {r.home_pts} pts
                      </Text>
                    </View>
                    <View style={[styles.ptsBadge, r.away_pts > 0 && styles.ptsBadgeActive]}>
                      <Text style={[styles.ptsValue, r.away_pts > 0 && styles.ptsValueActive]}>
                        {r.away_pts} pts
                      </Text>
                    </View>
                  </View>
                )}

                {!r.is_complete && (
                  <Text style={styles.incompleteText}>⚠ Incomplete</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* ── Captains agree (only when not locked) ── */}
        {!isLocked && (
          <Pressable
            style={[styles.agreeRow, captainsAgreed && styles.agreeRowChecked]}
            onPress={() => setCaptainsAgreed(v => !v)}
          >
            <View style={[styles.checkbox, captainsAgreed && styles.checkboxChecked]}>
              {captainsAgreed && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.agreeText}>Both captains agree the results are correct.</Text>
          </Pressable>
        )}

        {/* ── UNLOCK panel (shown when Edit is tapped) ── */}
        {showUnlock && (
          <View style={styles.unlockPanel}>
            <Text style={styles.unlockTitle}>Unlock Match</Text>
            <Text style={styles.unlockBody}>
              Type UNLOCK to re-open this match for editing. It will need to be re-finalized afterward.
            </Text>
            <TextInput
              style={[styles.unlockInput, unlockError ? styles.unlockInputError : null]}
              value={unlockText}
              onChangeText={t => { setUnlockText(t); setUnlockError(''); }}
              placeholder="Type UNLOCK"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {unlockError !== '' && (
              <Text style={styles.unlockErrorText}>{unlockError}</Text>
            )}
            <View style={styles.unlockBtnRow}>
              <Pressable
                style={({ pressed }) => [styles.unlockCancelBtn, pressed && styles.pressed]}
                onPress={() => { setShowUnlock(false); setUnlockText(''); setUnlockError(''); }}
              >
                <Text style={styles.unlockCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.unlockConfirmBtn, pressed && styles.pressed]}
                onPress={handleUnlockConfirm}
                disabled={isUnlocking}
              >
                {isUnlocking
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.unlockConfirmText}>Unlock</Text>
                }
              </Pressable>
            </View>
          </View>
        )}

        {/* Bottom padding for fixed button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom bar ── */}
      {!isLocked && (
        <View style={styles.bottomBar}>
          <Pressable
            style={({ pressed }) => [
              styles.finalizeBtn,
              (!captainsAgreed || incompleteCount > 0 || isFinalizing) && styles.finalizeBtnDisabled,
              pressed && captainsAgreed && incompleteCount === 0 && styles.pressed,
            ]}
            onPress={handleFinalize}
            disabled={!captainsAgreed || incompleteCount > 0 || isFinalizing}
          >
            {isFinalizing
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <Ionicons name="lock-closed" size={20} color="#fff" />
                  <Text style={styles.finalizeBtnText}>Finalize & Lock</Text>
                </>
              )
            }
          </Pressable>
        </View>
      )}

      {/* ── Locked: Done button ── */}
      {isLocked && !showUnlock && (
        <View style={styles.bottomBar}>
          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}
            onPress={() => router.replace('/(team)/(tabs)')}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
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
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4CAF5018',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4CAF50',
    letterSpacing: 1,
  },
  editBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // Warning
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FF980015',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FF980040',
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '600',
  },

  // Total score card
  totalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginBottom: 24,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 2,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  totalSide: {
    alignItems: 'center',
    minWidth: 80,
  },
  totalTeam: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  totalPts: {
    fontSize: 52,
    fontWeight: '900',
    color: theme.colors.text,
    lineHeight: 58,
  },
  totalWins: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  totalDash: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },

  // Section title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },

  // Results card
  resultsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  resultRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  resultRowIncomplete: {
    backgroundColor: '#FF980008',
  },
  matchNumBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  matchNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  resultBody: {
    flex: 1,
    gap: 8,
  },
  resultPlayersRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  resultPlayer: {
    flex: 1,
  },
  resultPlayerRight: {
    alignItems: 'flex-end',
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  winnerName: {
    color: '#4CAF50',
  },
  resultMeta: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  resultScoreCol: {
    alignItems: 'center',
    paddingHorizontal: 8,
    minWidth: 60,
  },
  resultRacks: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  resultInnings: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  ptsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ptsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ptsBadgeActive: {
    backgroundColor: '#4CAF5015',
    borderColor: '#4CAF5050',
  },
  ptsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  ptsValueActive: {
    color: '#4CAF50',
  },
  incompleteText: {
    fontSize: 13,
    color: '#FF9800',
    fontWeight: '600',
  },

  // Captains agree
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  agreeRowChecked: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF5008',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  agreeText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    lineHeight: 21,
  },

  // UNLOCK panel
  unlockPanel: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FF9800',
    marginBottom: 16,
    gap: 12,
  },
  unlockTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  unlockBody: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  unlockInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 2,
  },
  unlockInputError: {
    borderColor: '#F44336',
  },
  unlockErrorText: {
    fontSize: 13,
    color: '#F44336',
    fontWeight: '600',
  },
  unlockBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  unlockCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  unlockCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  unlockConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#FF9800',
    alignItems: 'center',
  },
  unlockConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Bottom bar
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
  finalizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 14,
    paddingVertical: 18,
    minHeight: 56,
  },
  finalizeBtnDisabled: {
    opacity: 0.4,
  },
  finalizeBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  doneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    minHeight: 56,
  },
  doneBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Misc
  pressed: { opacity: 0.8 },
  textRight: { textAlign: 'right' },
});
