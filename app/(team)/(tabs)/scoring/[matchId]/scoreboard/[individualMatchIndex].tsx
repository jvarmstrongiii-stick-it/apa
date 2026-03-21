/**
 * Match Detail — per-rack breakdown for a single individual match.
 *
 * Shows:
 *   - Player names, skill levels, points earned, race-to
 *   - Rack-by-rack W / L badges with break-and-run / 8-on-break indicators
 *   - Stats table: innings, timeouts, defensive shots, break & run, 8 on break
 *
 * Navigated to from the Scoreboard summary screen.
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../../../../src/lib/supabase';

// ─── Colors ──────────────────────────────────────────────────────────────────

const C = {
  headerBg: '#1565C0',
  headerText: '#ffffff',
  screenBg: '#1a1a1a',
  cardBg: '#242424',
  cardBorder: '#2e2e2e',
  sectionLabel: '#888',
  text: '#e0e0e0',
  textDim: '#999',
  winBg: '#1b5e20',
  winBorder: '#2e7d32',
  winText: '#a5d6a7',
  lossBg: '#212121',
  lossBorder: '#444',
  lossText: '#888',
  homeAccent: '#1565C0',
  awayAccent: '#6a1b9a',
  barBg: '#2a2a2a',
  statRow: '#1e1e1e',
};

// ─── Types ───────────────────────────────────────────────────────────────────

type Side = 'home' | 'away';

interface MatchInfo {
  id: string;
  match_order: number;
  innings: number;
  defensive_shots: number;
  timeouts_home: number;
  timeouts_away: number;
  lag_winner: Side | null;
  home_points_earned: number;
  away_points_earned: number;
  home_skill_level: number;
  away_skill_level: number;
  home_race_to: number;
  away_race_to: number;
  home_player: { first_name: string; last_name: string } | null;
  away_player: { first_name: string; last_name: string } | null;
}

interface RackRow {
  id: string;
  rack_number: number;
  won_by: Side | null;
  is_break_and_run: boolean;
  is_eight_on_break: boolean;
  dead_rack: boolean;
  innings_home: number | null;
  innings_away: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function playerName(p: { first_name: string; last_name: string } | null, fallback: string) {
  if (!p) return fallback;
  return `${p.first_name} ${p.last_name}`.trim() || fallback;
}

function countRacks(racks: RackRow[], side: Side, flag?: 'bar' | 'eight') {
  return racks.filter(r => {
    if (flag === 'bar') return r.won_by === side && r.is_break_and_run;
    if (flag === 'eight') return r.won_by === side && r.is_eight_on_break;
    return r.won_by === side;
  }).length;
}

function totalInningsFromRacks(racks: RackRow[]) {
  // Per-rack innings (innings_home after two-device verification = single agreed value)
  let home = 0, away = 0;
  for (const r of racks) {
    home += r.innings_home ?? 0;
    away += r.innings_away ?? 0;
  }
  return { home, away };
}

// ─── Rack Badge ──────────────────────────────────────────────────────────────

function RackBadge({ won, side }: { won: boolean; side: 'home' | 'away' }) {
  return (
    <View style={[
      styles.rackBadge,
      won
        ? side === 'home' ? styles.rackWinHome : styles.rackWinAway
        : styles.rackLoss,
    ]}>
      <Text style={[styles.rackBadgeText, won ? styles.rackWinText : styles.rackLossText]}>
        {won ? 'W' : 'L'}
      </Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MatchDetailScreen() {
  const { matchId, individualMatchIndex } = useLocalSearchParams<{
    matchId: string;
    individualMatchIndex: string;
  }>();

  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [racks, setRacks] = useState<RackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameFormat, setGameFormat] = useState<'8-ball' | '9-ball'>('8-ball');

  const matchOrder = Number(individualMatchIndex ?? '0') + 1;

  const fetchData = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    try {
      // Fetch game format for the team match
      const { data: tm } = await supabase
        .from('team_matches')
        .select('game_format')
        .eq('id', matchId)
        .single();
      const fmt = (tm as any)?.game_format === 'nine_ball' ? '9-ball' : '8-ball';
      setGameFormat(fmt);

      // Fetch individual match info
      const { data: im, error: imErr } = await supabase
        .from('individual_matches')
        .select(`
          id, match_order, innings, defensive_shots,
          timeouts_home, timeouts_away, lag_winner,
          home_points_earned, away_points_earned,
          home_skill_level, away_skill_level,
          home_race_to, away_race_to,
          home_player:players!home_player_id(first_name, last_name),
          away_player:players!away_player_id(first_name, last_name)
        `)
        .eq('team_match_id', matchId)
        .eq('match_order', matchOrder)
        .single();

      if (imErr) throw imErr;
      setMatchInfo(im as MatchInfo);

      // Fetch racks
      const racksTable = fmt === '9-ball' ? 'racks_nine_ball' : 'racks_eight_ball';
      const { data: rackData, error: rackErr } = await supabase
        .from(racksTable)
        .select('id, rack_number, won_by, is_break_and_run, is_eight_on_break, dead_rack, innings_home, innings_away')
        .eq('individual_match_id', (im as any).id)
        .order('rack_number', { ascending: true });

      if (rackErr) throw rackErr;
      setRacks((rackData ?? []) as RackRow[]);
    } catch (err) {
      console.error('[MatchDetail] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId, matchOrder]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={C.headerText} />
          </Pressable>
          <Text style={styles.headerTitle}>Match {matchOrder} of 5</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.homeAccent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!matchInfo) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={C.headerText} />
          </Pressable>
          <Text style={styles.headerTitle}>Match {matchOrder} of 5</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={{ color: C.textDim }}>Match data not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const homeName = playerName(matchInfo.home_player, 'Home Player');
  const awayName = playerName(matchInfo.away_player, 'Away Player');

  const rackInnings = totalInningsFromRacks(racks);
  // Fall back to match-level innings if rack-level isn't populated
  const homeInnings = rackInnings.home || matchInfo.innings;
  const awayInnings = rackInnings.away || matchInfo.innings;

  const homeWins = countRacks(racks, 'home');
  const awayWins = countRacks(racks, 'away');
  const homeBAR = countRacks(racks, 'home', 'bar');
  const awayBAR = countRacks(racks, 'away', 'bar');
  const homeEOB = countRacks(racks, 'home', 'eight');
  const awayEOB = countRacks(racks, 'away', 'eight');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={C.headerText} />
        </Pressable>
        <Text style={styles.headerTitle}>Match {matchOrder} of 5</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Players & score */}
        <View style={styles.playersCard}>
          <View style={styles.playersSide}>
            <Text style={styles.playerName}>{homeName}</Text>
            <Text style={styles.playerSL}>SL {matchInfo.home_skill_level}</Text>
            <Text style={styles.playerScore}>
              {matchInfo.home_points_earned} pts
              <Text style={styles.raceTo}> (race to {matchInfo.home_race_to})</Text>
            </Text>
          </View>
          <View style={styles.vsCol}>
            <Text style={styles.vsText}>vs</Text>
          </View>
          <View style={[styles.playersSide, styles.playersSideRight]}>
            <Text style={[styles.playerName, styles.textRight]}>{awayName}</Text>
            <Text style={[styles.playerSL, styles.textRight]}>SL {matchInfo.away_skill_level}</Text>
            <Text style={[styles.playerScore, styles.textRight]}>
              {matchInfo.away_points_earned} pts
              <Text style={styles.raceTo}> (race to {matchInfo.away_race_to})</Text>
            </Text>
          </View>
        </View>

        {/* Rack breakdown */}
        {racks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RACK BREAKDOWN</Text>
            <View style={styles.sectionCard}>
              {racks.map((rack, idx) => {
                const homeWon = rack.won_by === 'home';
                const awayWon = rack.won_by === 'away';
                return (
                  <View key={rack.id} style={[styles.rackRow, idx > 0 && styles.rackRowBorder]}>
                    {/* Home side */}
                    <View style={styles.rackSide}>
                      <RackBadge won={homeWon} side="home" />
                      {homeWon && rack.is_break_and_run && (
                        <Text style={styles.rackSpecial}>✦ B&R</Text>
                      )}
                      {homeWon && rack.is_eight_on_break && (
                        <Text style={styles.rackSpecial}>8-Break</Text>
                      )}
                    </View>

                    {/* Rack number */}
                    <Text style={styles.rackNum}>Rack {rack.rack_number}</Text>

                    {/* Away side */}
                    <View style={[styles.rackSide, styles.rackSideRight]}>
                      {awayWon && rack.is_break_and_run && (
                        <Text style={styles.rackSpecial}>B&R ✦</Text>
                      )}
                      {awayWon && rack.is_eight_on_break && (
                        <Text style={styles.rackSpecial}>8-Break</Text>
                      )}
                      <RackBadge won={awayWon} side="away" />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Stats table */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STATS</Text>
          <View style={styles.sectionCard}>
            {/* Column headers */}
            <View style={styles.statHeaderRow}>
              <View style={styles.statLabelCol} />
              <Text style={styles.statColHeader}>{homeName.split(' ')[0]}</Text>
              <Text style={styles.statColHeader}>{awayName.split(' ')[0]}</Text>
            </View>

            <StatRow label="Innings" homeVal={homeInnings} awayVal={awayInnings} />
            <StatRow label="Timeouts" homeVal={matchInfo.timeouts_home} awayVal={matchInfo.timeouts_away} />
            <StatRow label="Def. Shots" homeVal={matchInfo.defensive_shots} awayVal={matchInfo.defensive_shots} shared />
            {gameFormat === '8-ball' && (
              <>
                <StatRow label="Break & Run" homeVal={homeBAR} awayVal={awayBAR} />
                <StatRow label="8 on Break" homeVal={homeEOB} awayVal={awayEOB} />
              </>
            )}
            <StatRow label="Racks Won" homeVal={homeWins} awayVal={awayWins} highlight />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stat Row ────────────────────────────────────────────────────────────────

function StatRow({
  label,
  homeVal,
  awayVal,
  shared,
  highlight,
}: {
  label: string;
  homeVal: number;
  awayVal: number;
  shared?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.statRow, highlight && styles.statRowHighlight]}>
      <Text style={[styles.statLabel, highlight && styles.statLabelHighlight]}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{homeVal}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>
        {shared ? '—' : awayVal}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.screenBg,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 32 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: C.headerText,
  },
  headerSpacer: { width: 32 },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    padding: 16,
    gap: 20,
    paddingBottom: 40,
  },

  // Players card
  playersCard: {
    flexDirection: 'row',
    backgroundColor: C.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    alignItems: 'flex-start',
    gap: 8,
  },
  playersSide: {
    flex: 1,
    gap: 2,
  },
  playersSideRight: {
    alignItems: 'flex-end',
  },
  vsCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    width: 32,
  },
  vsText: {
    color: C.textDim,
    fontSize: 14,
  },
  playerName: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
  },
  playerSL: {
    fontSize: 12,
    color: C.textDim,
  },
  playerScore: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
    marginTop: 4,
  },
  raceTo: {
    fontSize: 12,
    fontWeight: '400',
    color: C.textDim,
  },
  textRight: {
    textAlign: 'right',
  },

  // Sections
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: C.sectionLabel,
    paddingHorizontal: 2,
  },
  sectionCard: {
    backgroundColor: C.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
  },

  // Rack rows
  rackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rackRowBorder: {
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
  },
  rackSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rackSideRight: {
    justifyContent: 'flex-end',
  },
  rackNum: {
    fontSize: 13,
    color: C.textDim,
    width: 72,
    textAlign: 'center',
  },
  rackSpecial: {
    fontSize: 11,
    color: '#FFD54F',
    fontWeight: '600',
  },

  // Rack badges
  rackBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  rackBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rackWinHome: {
    backgroundColor: C.winBg,
    borderColor: C.winBorder,
  },
  rackWinAway: {
    backgroundColor: '#1a237e',
    borderColor: '#283593',
  },
  rackWinText: {
    color: '#a5d6a7',
  },
  rackLoss: {
    backgroundColor: C.lossBg,
    borderColor: C.lossBorder,
  },
  rackLossText: {
    color: C.lossText,
  },

  // Stats table
  statHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  statLabelCol: {
    flex: 1,
  },
  statColHeader: {
    width: 64,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: C.textDim,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    backgroundColor: C.statRow,
  },
  statRowHighlight: {
    backgroundColor: '#1e2a1e',
  },
  statLabel: {
    flex: 1,
    fontSize: 14,
    color: C.text,
  },
  statLabelHighlight: {
    fontWeight: '700',
  },
  statValue: {
    width: 64,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },
  statValueHighlight: {
    fontWeight: '700',
    color: '#a5d6a7',
  },
});
