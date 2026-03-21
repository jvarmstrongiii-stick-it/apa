/**
 * Match Detail Screen (read-only)
 *
 * Shown when a player taps a match card on the Schedule tab.
 * Renders a status-appropriate view:
 *
 *   scheduled   → Both team rosters (SL, MP) side by side
 *   in_progress → 5-slot progress list with scores, no action buttons
 *   completed / finalized → Full match results: per-game player names,
 *                           racks won, race-to, innings, APA points
 */

import { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../../src/constants/theme';
import { supabase } from '../../../../../src/lib/supabase';
import { useAuthContext } from '../../../../../src/providers/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchStatus = 'scheduled' | 'lineup_set' | 'in_progress' | 'completed' | 'finalized';

interface TeamMatchInfo {
  id: string;
  status: MatchStatus;
  match_date: string;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  location: string;
  game_format: '8-ball' | '9-ball';
  put_up_team: 'home' | 'away' | null;
}

interface IndividualMatchRow {
  id: string;
  match_order: number;
  home_player_id: string | null;
  away_player_id: string | null;
  home_skill_level: number | null;
  away_skill_level: number | null;
  home_race_to: number | null;
  away_race_to: number | null;
  home_points_earned: number;
  away_points_earned: number;
  innings: number | null;
  home_player_name: string;
  away_player_name: string;
}

interface RosterEntry {
  id: string;
  name: string;
  skill_level: number;
  matches_played: number;
  is_captain: boolean;
}

// ─── RACE table + APA points (mirrors finalize.tsx) ──────────────────────────

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

function calcApaPoints(
  homeRacks: number,
  awayRacks: number,
  homeRaceTo: number,
  awayRaceTo: number,
): [number, number] {
  const homeWon = homeRacks >= homeRaceTo;
  const awayWon = awayRacks >= awayRaceTo;
  if (homeWon) {
    if (awayRacks === 0)              return [3, 0];
    if (awayRacks === awayRaceTo - 1) return [2, 1];
    return [2, 0];
  }
  if (awayWon) {
    if (homeRacks === 0)              return [0, 3];
    if (homeRacks === homeRaceTo - 1) return [1, 2];
    return [0, 2];
  }
  return [0, 0];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<MatchStatus, string> = {
  scheduled: '#2196F3',
  lineup_set: '#9C27B0',
  in_progress: '#FF9800',
  completed: '#4CAF50',
  finalized: '#607D8B',
};

const STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Scheduled',
  lineup_set: 'Lineup Set',
  in_progress: 'In Progress',
  completed: 'Completed',
  finalized: 'Finalized',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { profile, isCaptain } = useAuthContext();
  const teamId = profile?.team_id;

  const [loading, setLoading] = useState(true);
  const [matchInfo, setMatchInfo] = useState<TeamMatchInfo | null>(null);
  const [individualMatches, setIndividualMatches] = useState<IndividualMatchRow[]>([]);
  const [homeRoster, setHomeRoster] = useState<RosterEntry[]>([]);
  const [awayRoster, setAwayRoster] = useState<RosterEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!matchId) return;

      // Fetch team match info
      const { data: tm } = await supabase
        .from('team_matches')
        .select(`
          id, status, match_date, home_team_id, away_team_id,
          home_score, away_score, put_up_team, game_format,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          division:divisions!division_id(location)
        `)
        .eq('id', matchId)
        .single();

      if (!tm) { setLoading(false); return; }

      const info: TeamMatchInfo = {
        id: (tm as any).id,
        status: (tm as any).status as MatchStatus,
        match_date: (tm as any).match_date,
        home_team_id: (tm as any).home_team_id,
        away_team_id: (tm as any).away_team_id,
        home_team_name: (tm as any).home_team?.name ?? 'Home',
        away_team_name: (tm as any).away_team?.name ?? 'Away',
        home_score: (tm as any).home_score,
        away_score: (tm as any).away_score,
        location: (tm as any).division?.location ?? '',
        game_format: (tm as any).game_format === 'nine_ball' ? '9-ball' : '8-ball',
        put_up_team: (tm as any).put_up_team ?? null,
      };
      setMatchInfo(info);

      const status = info.status;

      if (status === 'scheduled' || status === 'lineup_set') {
        // Fetch both rosters
        const { data: rosterData } = await supabase
          .from('team_players')
          .select('team_id, matches_played, is_captain, current_8_ball_sl, current_9_ball_sl, player:players!player_id(id, first_name, last_name)')
          .in('team_id', [info.home_team_id, info.away_team_id])
          .eq('is_active', true);

        const mapRoster = (data: any[], forTeamId: string): RosterEntry[] =>
          (data ?? [])
            .filter((tp: any) => tp.team_id === forTeamId)
            .map((tp: any) => ({
              id: tp.player?.id ?? '',
              name: `${tp.player?.first_name ?? ''} ${tp.player?.last_name ?? ''}`.trim(),
              skill_level: tp.current_8_ball_sl ?? tp.current_9_ball_sl ?? 0,
              matches_played: tp.matches_played ?? 0,
              is_captain: tp.is_captain ?? false,
            }))
            .filter((p: RosterEntry) => p.id)
            .sort((a: RosterEntry, b: RosterEntry) => {
              if (a.is_captain !== b.is_captain) return a.is_captain ? -1 : 1;
              return a.name.localeCompare(b.name);
            });

        setHomeRoster(mapRoster(rosterData ?? [], info.home_team_id));
        setAwayRoster(mapRoster(rosterData ?? [], info.away_team_id));
      } else {
        // Fetch individual matches with player details
        const { data: ims } = await supabase
          .from('individual_matches')
          .select(`
            id, match_order, home_player_id, away_player_id,
            home_skill_level, away_skill_level, home_race_to, away_race_to,
            home_points_earned, away_points_earned, innings,
            home_player:players!home_player_id(first_name, last_name, current_8_ball_sl, current_9_ball_sl),
            away_player:players!away_player_id(first_name, last_name, current_8_ball_sl, current_9_ball_sl)
          `)
          .eq('team_match_id', matchId)
          .order('match_order', { ascending: true });

        const mapped: IndividualMatchRow[] = (ims ?? []).map((im: any) => {
          const hsl = im.home_skill_level ?? im.home_player?.current_8_ball_sl ?? im.home_player?.current_9_ball_sl ?? 3;
          const asl = im.away_skill_level ?? im.away_player?.current_8_ball_sl ?? im.away_player?.current_9_ball_sl ?? 3;
          const [rh, ra] = im.home_race_to && im.away_race_to
            ? [im.home_race_to, im.away_race_to]
            : getRace(hsl, asl);
          return {
            id: im.id,
            match_order: im.match_order,
            home_player_id: im.home_player_id,
            away_player_id: im.away_player_id,
            home_skill_level: hsl,
            away_skill_level: asl,
            home_race_to: rh,
            away_race_to: ra,
            home_points_earned: im.home_points_earned ?? 0,
            away_points_earned: im.away_points_earned ?? 0,
            innings: im.innings ?? null,
            home_player_name: im.home_player
              ? `${im.home_player.first_name ?? ''} ${im.home_player.last_name ?? ''}`.trim()
              : 'Home Player',
            away_player_name: im.away_player
              ? `${im.away_player.first_name ?? ''} ${im.away_player.last_name ?? ''}`.trim()
              : 'Away Player',
          };
        });
        setIndividualMatches(mapped);
      }

      setLoading(false);
    };

    load();
  }, [matchId]);

  if (loading || !matchInfo) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isHome = matchInfo.home_team_id === teamId;
  const matchDate = new Date(matchInfo.match_date);
  const opponentName = isHome ? matchInfo.away_team_name : matchInfo.home_team_name;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isHome ? 'vs' : '@'} {opponentName}
          </Text>
          <Text style={styles.headerSub}>
            {matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {matchInfo.location ? `  ·  ${matchInfo.location}` : ''}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[matchInfo.status] + '20' }]}>
          <Text style={[styles.statusPillText, { color: STATUS_COLORS[matchInfo.status] }]}>
            {STATUS_LABELS[matchInfo.status]}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── SCHEDULED / LINEUP SET: roster preview ──────────────────── */}
        {(matchInfo.status === 'scheduled' || matchInfo.status === 'lineup_set') && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Rosters</Text>
              {isCaptain && (
                <Pressable
                  style={({ pressed }) => [styles.editRosterBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push('/(team)/(tabs)/roster')}
                >
                  <Ionicons name="create-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.editRosterBtnText}>Edit Roster</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.rosterColumns}>
              {/* Home column */}
              <View style={styles.rosterColumn}>
                <Text style={styles.rosterTeamName}>{matchInfo.home_team_name}</Text>
                {homeRoster.length === 0 ? (
                  <Text style={styles.emptyRoster}>No roster</Text>
                ) : (
                  homeRoster.map((p) => (
                    <View key={p.id} style={styles.rosterCard}>
                      <View style={styles.rosterCardTop}>
                        <Text style={styles.rosterPlayerName} numberOfLines={1}>{p.name}</Text>
                        {p.is_captain && (
                          <View style={styles.captainDot} />
                        )}
                      </View>
                      <View style={styles.rosterCardStats}>
                        <View style={styles.slBadge}>
                          <Text style={styles.slBadgeText}>SL {p.skill_level}</Text>
                        </View>
                        <Text style={styles.mpText}>{p.matches_played} MP</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.rosterDivider} />

              {/* Away column */}
              <View style={styles.rosterColumn}>
                <Text style={styles.rosterTeamName}>{matchInfo.away_team_name}</Text>
                {awayRoster.length === 0 ? (
                  <Text style={styles.emptyRoster}>No roster</Text>
                ) : (
                  awayRoster.map((p) => (
                    <View key={p.id} style={styles.rosterCard}>
                      <View style={styles.rosterCardTop}>
                        <Text style={styles.rosterPlayerName} numberOfLines={1}>{p.name}</Text>
                        {p.is_captain && (
                          <View style={styles.captainDot} />
                        )}
                      </View>
                      <View style={styles.rosterCardStats}>
                        <View style={styles.slBadge}>
                          <Text style={styles.slBadgeText}>SL {p.skill_level}</Text>
                        </View>
                        <Text style={styles.mpText}>{p.matches_played} MP</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
            <Text style={styles.captainNote}>· = Captain</Text>
          </>
        )}

        {/* ── IN PROGRESS: slot list (read-only) ──────────────────────── */}
        {matchInfo.status === 'in_progress' && (
          <>
            <Text style={styles.sectionLabel}>Match Progress</Text>
            <View style={styles.teamScoreRow}>
              <Text style={styles.teamScoreName}>{matchInfo.home_team_name}</Text>
              <Text style={styles.teamScoreVs}>vs</Text>
              <Text style={styles.teamScoreName}>{matchInfo.away_team_name}</Text>
            </View>
            {[1, 2, 3, 4, 5].map((slot) => {
              const im = individualMatches.find((m) => m.match_order === slot);
              const hasPlayers = im && im.home_player_id && im.away_player_id;
              const isComplete = hasPlayers &&
                im.home_race_to !== null && im.away_race_to !== null &&
                (im.home_points_earned >= im.home_race_to! || im.away_points_earned >= im.away_race_to!);

              return (
                <View key={slot} style={[styles.slotCard, isComplete && styles.slotCardComplete]}>
                  <View style={styles.slotHeader}>
                    <Text style={styles.slotNumber}>Match {slot} of 5</Text>
                    {isComplete && (
                      <View style={[styles.slotPill, { backgroundColor: theme.colors.success + '20' }]}>
                        <Ionicons name="checkmark" size={11} color={theme.colors.success} />
                        <Text style={[styles.slotPillText, { color: theme.colors.success }]}>Complete</Text>
                      </View>
                    )}
                    {hasPlayers && !isComplete && (
                      <View style={[styles.slotPill, { backgroundColor: '#FF980018' }]}>
                        <View style={styles.activeDot} />
                        <Text style={[styles.slotPillText, { color: '#FF9800' }]}>In Progress</Text>
                      </View>
                    )}
                    {!hasPlayers && (
                      <View style={[styles.slotPill, { backgroundColor: theme.colors.border }]}>
                        <Text style={[styles.slotPillText, { color: theme.colors.textSecondary }]}>Pending</Text>
                      </View>
                    )}
                  </View>
                  {hasPlayers ? (() => {
                    const homeWon = im.home_race_to !== null &&
                      im.home_points_earned >= im.home_race_to!;
                    const awayWon = im.away_race_to !== null &&
                      im.away_points_earned >= im.away_race_to!;
                    return (
                      <View style={styles.slotMatchup}>
                        <View style={styles.slotPlayerCol}>
                          <Text
                            style={[styles.slotPlayerName, homeWon && styles.slotWinner]}
                            numberOfLines={1}
                          >
                            {im.home_player_name}
                          </Text>
                          {im.home_skill_level !== null && (
                            <View style={styles.slBadge}>
                              <Text style={styles.slBadgeText}>SL {im.home_skill_level}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.slotScoreCol}>
                          <Text style={styles.slotScore}>
                            {im.home_points_earned} – {im.away_points_earned}
                          </Text>
                          {im.home_race_to !== null && im.away_race_to !== null && (
                            <Text style={styles.slotRaceTo}>
                              ({im.home_race_to} / {im.away_race_to})
                            </Text>
                          )}
                        </View>
                        <View style={[styles.slotPlayerCol, styles.slotPlayerColRight]}>
                          <Text
                            style={[styles.slotPlayerName, styles.textRight, awayWon && styles.slotWinner]}
                            numberOfLines={1}
                          >
                            {im.away_player_name}
                          </Text>
                          {im.away_skill_level !== null && (
                            <View style={[styles.slBadge, styles.slBadgeRight]}>
                              <Text style={styles.slBadgeText}>SL {im.away_skill_level}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })() : (
                    <Text style={styles.slotPending}>Players not yet selected</Text>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ── COMPLETED / FINALIZED: full results ─────────────────────── */}
        {(matchInfo.status === 'completed' || matchInfo.status === 'finalized') && (
          <>
            {/* Final score card */}
            {matchInfo.home_score !== null && matchInfo.away_score !== null && (
              <View style={styles.finalScoreCard}>
                <Text style={styles.finalScoreLabel}>FINAL SCORE</Text>
                <View style={styles.finalScoreRow}>
                  <View style={styles.finalScoreSide}>
                    <Text style={styles.finalScoreTeam} numberOfLines={1}>{matchInfo.home_team_name}</Text>
                    <Text style={styles.finalScorePoints}>{matchInfo.home_score}</Text>
                    <Text style={styles.finalScorePtsLabel}>pts</Text>
                  </View>
                  <Text style={styles.finalScoreDash}>–</Text>
                  <View style={[styles.finalScoreSide, styles.finalScoreSideRight]}>
                    <Text style={styles.finalScoreTeam} numberOfLines={1}>{matchInfo.away_team_name}</Text>
                    <Text style={styles.finalScorePoints}>{matchInfo.away_score}</Text>
                    <Text style={styles.finalScorePtsLabel}>pts</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Individual match results */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Individual Matches</Text>
              <Pressable
                style={({ pressed }) => [styles.detailsBtn, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(`/(team)/(tabs)/schedule/${matchInfo.id}/details`)}
              >
                <Ionicons name="list-outline" size={14} color={theme.colors.primary} />
                <Text style={styles.detailsBtnText}>Details</Text>
              </Pressable>
            </View>

            {individualMatches.map((im) => {
              const hsl = im.home_skill_level ?? 3;
              const asl = im.away_skill_level ?? 3;
              const homeRaceTo = im.home_race_to ?? getRace(hsl, asl)[0];
              const awayRaceTo = im.away_race_to ?? getRace(hsl, asl)[1];
              const [homePts, awayPts] = calcApaPoints(
                im.home_points_earned, im.away_points_earned, homeRaceTo, awayRaceTo
              );
              const homeWon = im.home_points_earned >= homeRaceTo;
              const awayWon = im.away_points_earned >= awayRaceTo;

              return (
                <View key={im.id} style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultMatchNum}>Match {im.match_order}</Text>
                    {im.innings !== null && (
                      <Text style={styles.resultInnings}>{im.innings} innings</Text>
                    )}
                  </View>

                  <View style={styles.resultMatchup}>
                    {/* Home player */}
                    <View style={styles.resultPlayerSide}>
                      <Text
                        style={[styles.resultPlayerName, homeWon && styles.resultWinner]}
                        numberOfLines={1}
                      >
                        {im.home_player_name}
                      </Text>
                      <Text style={styles.resultSlText}>SL {hsl}</Text>
                      {homePts > 0 && (
                        <Text style={styles.resultPts}>{homePts} pts</Text>
                      )}
                    </View>

                    {/* Score */}
                    <View style={styles.resultScoreCol}>
                      <Text style={styles.resultScore}>
                        {im.home_points_earned} – {im.away_points_earned}
                      </Text>
                      <Text style={styles.resultRaceTo}>
                        ({homeRaceTo} / {awayRaceTo})
                      </Text>
                    </View>

                    {/* Away player */}
                    <View style={[styles.resultPlayerSide, styles.resultPlayerSideRight]}>
                      <Text
                        style={[styles.resultPlayerName, styles.textRight, awayWon && styles.resultWinner]}
                        numberOfLines={1}
                      >
                        {im.away_player_name}
                      </Text>
                      <Text style={[styles.resultSlText, styles.textRight]}>SL {asl}</Text>
                      {awayPts > 0 && (
                        <Text style={[styles.resultPts, styles.textRight]}>{awayPts} pts</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  backButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },

  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  editRosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary + '40',
    backgroundColor: theme.colors.primary + '10',
    marginBottom: 4,
  },
  editRosterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary + '40',
    backgroundColor: theme.colors.primary + '10',
    marginBottom: 4,
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },

  // Roster columns
  rosterColumns: {
    flexDirection: 'row',
    gap: 0,
  },
  rosterColumn: {
    flex: 1,
    gap: 6,
  },
  rosterDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 10,
  },
  rosterTeamName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  rosterCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  rosterCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rosterPlayerName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  captainDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF9800',
  },
  rosterCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slBadge: {
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  slBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  mpText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  emptyRoster: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  captainNote: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: -8,
  },

  // In-progress slots
  teamScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  teamScoreName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  teamScoreVs: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginHorizontal: 8,
  },
  slotCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  slotCardComplete: {
    opacity: 0.6,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slotPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF9800',
  },
  slotMatchup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotPlayerCol: {
    flex: 1,
    gap: 3,
  },
  slotPlayerColRight: {
    alignItems: 'flex-end',
  },
  slotScoreCol: {
    alignItems: 'center',
    gap: 2,
    minWidth: 56,
  },
  slotPlayerName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  slotWinner: {
    color: theme.colors.success,
  },
  slotScore: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  slotRaceTo: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  textRight: {
    textAlign: 'right',
  },
  slotPending: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },

  // Completed results
  finalScoreCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    gap: 12,
  },
  finalScoreLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    letterSpacing: 1.2,
  },
  finalScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  finalScoreSide: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  finalScoreSideRight: {
    alignItems: 'flex-end',
  },
  finalScoreTeam: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  finalScorePoints: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.text,
  },
  finalScorePtsLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  finalScoreDash: {
    fontSize: 28,
    fontWeight: '300',
    color: theme.colors.textSecondary,
  },
  resultCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultMatchNum: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultInnings: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  resultMatchup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  resultPlayerSide: {
    flex: 1,
    gap: 2,
  },
  resultPlayerSideRight: {
    alignItems: 'flex-end',
  },
  resultPlayerName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  resultWinner: {
    color: theme.colors.success,
  },
  resultSlText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  resultPts: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  resultScoreCol: {
    alignItems: 'center',
    gap: 2,
    minWidth: 60,
  },
  resultScore: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  resultRaceTo: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
});
