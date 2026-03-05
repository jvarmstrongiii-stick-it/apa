import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RosterPlayer {
  id: string;
  firstName: string;
  lastName: string;
  skillLevel: number;
}

interface RetroMatchData {
  homePlayerId: string;
  awayPlayerId: string;
  winnerId: string;
  homeRacks: number;
  awayRacks: number;
}

type Phase =
  | 'loading'
  | 'select_start'
  | 'retro_home_player'
  | 'retro_away_player'
  | 'retro_winner'
  | 'retro_racks'
  | 'current_home_player'
  | 'current_away_player'
  | 'current_partial_yes_no'
  | 'current_winner'
  | 'current_racks'
  | 'saving';

// ---------------------------------------------------------------------------
// RACE table — [homeSL][awaySL] = [homeRaceTo, awayRaceTo]
// ---------------------------------------------------------------------------
const RACE: Record<number, Record<number, [number, number]>> = {
  1: { 1:[2,2], 2:[2,2], 3:[3,2], 4:[3,2], 5:[3,2], 6:[4,2], 7:[4,2], 8:[4,2], 9:[5,2] },
  2: { 1:[2,2], 2:[2,2], 3:[3,2], 4:[3,2], 5:[3,2], 6:[4,2], 7:[4,2], 8:[5,2], 9:[5,2] },
  3: { 1:[2,3], 2:[2,3], 3:[3,3], 4:[3,3], 5:[3,3], 6:[4,3], 7:[4,3], 8:[5,3], 9:[5,3] },
  4: { 1:[2,3], 2:[2,3], 3:[3,3], 4:[3,3], 5:[4,3], 6:[4,4], 7:[5,4], 8:[5,4], 9:[6,4] },
  5: { 1:[2,3], 2:[2,3], 3:[3,3], 4:[3,4], 5:[4,4], 6:[4,4], 7:[5,4], 8:[5,5], 9:[6,5] },
  6: { 1:[2,4], 2:[2,4], 3:[3,4], 4:[4,4], 5:[4,4], 6:[5,5], 7:[5,5], 8:[6,5], 9:[6,6] },
  7: { 1:[2,4], 2:[2,4], 3:[3,4], 4:[4,5], 5:[4,5], 6:[5,5], 7:[5,6], 8:[6,6], 9:[7,6] },
  8: { 1:[2,4], 2:[2,5], 3:[3,5], 4:[4,5], 5:[5,5], 6:[5,6], 7:[6,6], 8:[6,7], 9:[7,7] },
  9: { 1:[2,5], 2:[2,5], 3:[3,5], 4:[4,6], 5:[5,6], 6:[6,6], 7:[6,7], 8:[7,7], 9:[7,8] },
};

function getRaceTo(homeSL: number, awaySL: number): [number, number] {
  return RACE[homeSL]?.[awaySL] ?? [3, 3];
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function CatchupScreen() {
  const { matchId, putUpTeam: putUpTeamParam } = useLocalSearchParams<{
    matchId: string;
    putUpTeam: string;
  }>();

  // The putUpTeam from the coin flip (for match 1 if we start from match 1)
  const coinFlipPutUpTeam = (putUpTeamParam ?? 'home') as 'home' | 'away';

  const { profile } = useAuthContext();
  const teamId = profile?.team_id;

  // Match info
  const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<string | null>(null);
  const [homePlayers, setHomePlayers] = useState<RosterPlayer[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<RosterPlayer[]>([]);

  // Wizard state
  const [phase, setPhase] = useState<Phase>('loading');
  const [startingMatch, setStartingMatch] = useState<number>(1); // 1-based
  const [retroMatches, setRetroMatches] = useState<RetroMatchData[]>([]);

  // Working variables for the current retroactive match being built
  const [workingHomePlayerId, setWorkingHomePlayerId] = useState<string | null>(null);
  const [workingAwayPlayerId, setWorkingAwayPlayerId] = useState<string | null>(null);
  const [workingWinnerId, setWorkingWinnerId] = useState<string | null>(null);

  // For the starting match partial racks
  const [currentHomePlayerId, setCurrentHomePlayerId] = useState<string | null>(null);
  const [currentAwayPlayerId, setCurrentAwayPlayerId] = useState<string | null>(null);
  const [hasPartialRacks, setHasPartialRacks] = useState(false);
  const [currentWinnerId, setCurrentWinnerId] = useState<string | null>(null);
  const [currentWinnerRacks, setCurrentWinnerRacks] = useState(0);

  // ---------------------------------------------------------------------------
  // Load match + rosters
  // ---------------------------------------------------------------------------

  const loadMatch = useCallback(async () => {
    if (!matchId) return;

    const { data: matchData, error: matchError } = await supabase
      .from('team_matches')
      .select('home_team_id, away_team_id')
      .eq('id', matchId)
      .single();

    if (matchError || !matchData) {
      console.error('Failed to load match:', matchError);
      return;
    }

    setHomeTeamId(matchData.home_team_id);
    setAwayTeamId(matchData.away_team_id);

    const [homeResult, awayResult] = await Promise.all([
      supabase
        .from('team_players')
        .select('player_id, skill_level, players!inner(id, first_name, last_name)')
        .eq('team_id', matchData.home_team_id)
        .eq('is_active', true),
      supabase
        .from('team_players')
        .select('player_id, skill_level, players!inner(id, first_name, last_name)')
        .eq('team_id', matchData.away_team_id)
        .eq('is_active', true),
    ]);

    const mapPlayers = (rows: any[]): RosterPlayer[] =>
      (rows ?? []).map((r: any) => ({
        id: r.player_id,
        firstName: r.players.first_name,
        lastName: r.players.last_name,
        skillLevel: r.skill_level,
      }));

    setHomePlayers(mapPlayers(homeResult.data ?? []));
    setAwayPlayers(mapPlayers(awayResult.data ?? []));
    // Default to match 1 — skip the select_start screen for a fresh match.
    // The select_start screen remains for future mid-session start support.
    router.replace(
      `/(team)/(tabs)/scoring/${matchId}/putup?matchOrder=1&putUpTeam=${coinFlipPutUpTeam}`
    );
  }, [matchId]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const playerName = (p: RosterPlayer) => `${p.firstName} ${p.lastName}`;

  const findPlayer = (id: string, side: 'home' | 'away') =>
    (side === 'home' ? homePlayers : awayPlayers).find(p => p.id === id);

  // Which retroactive match index are we currently building? (0-based)
  const currentRetroIndex = retroMatches.length; // next one to fill

  // Rack options for a completed retroactive match
  function rackOptions(homePlayerId: string, awayPlayerId: string, winnerId: string): number[] {
    const hp = findPlayer(homePlayerId, 'home');
    const ap = findPlayer(awayPlayerId, 'away');
    const hsl = hp?.skillLevel ?? 5;
    const asl = ap?.skillLevel ?? 5;
    const [homeRaceTo, awayRaceTo] = getRaceTo(hsl, asl);
    const isHomeWinner = winnerId === homePlayerId;
    const winRaceTo = isHomeWinner ? homeRaceTo : awayRaceTo;
    // Winner won winRaceTo racks. Loser could have won 0 to winRaceTo-1 racks.
    // We just need the loser rack count (winner racks are always raceTo).
    const loseRaceTo = isHomeWinner ? awayRaceTo : homeRaceTo;
    return Array.from({ length: loseRaceTo }, (_, i) => i); // 0 to loseRaceTo-1
  }

  // Current partial rack options for starting match
  function partialRackOptions(winnerId: string): number[] {
    const hp = findPlayer(currentHomePlayerId!, 'home');
    const ap = findPlayer(currentAwayPlayerId!, 'away');
    const hsl = hp?.skillLevel ?? 5;
    const asl = ap?.skillLevel ?? 5;
    const [homeRaceTo, awayRaceTo] = getRaceTo(hsl, asl);
    const isHomeWinner = winnerId === currentHomePlayerId;
    const maxRacks = isHomeWinner ? homeRaceTo : awayRaceTo;
    // Winner has already won 1 to maxRacks-1 racks (can't have won all yet, game still going)
    return Array.from({ length: maxRacks - 1 }, (_, i) => i + 1);
  }

  // ---------------------------------------------------------------------------
  // Navigation: phase advancement
  // ---------------------------------------------------------------------------

  const handleSelectStart = (matchNum: number) => {
    setStartingMatch(matchNum);
    if (matchNum === 1) {
      // No retroactive data needed — skip straight to putup for match 1
      router.replace(
        `/(team)/(tabs)/scoring/${matchId}/putup?matchOrder=1&putUpTeam=${coinFlipPutUpTeam}`
      );
      return;
    }
    // Need to collect data for matches 1 through matchNum-1
    setPhase('retro_home_player');
  };

  const handleRetroHomePlayer = (playerId: string) => {
    setWorkingHomePlayerId(playerId);
    setPhase('retro_away_player');
  };

  const handleRetroAwayPlayer = (playerId: string) => {
    setWorkingAwayPlayerId(playerId);
    setPhase('retro_winner');
  };

  const handleRetroWinner = (winnerId: string) => {
    setWorkingWinnerId(winnerId);
    setPhase('retro_racks');
  };

  const handleRetroRacks = (loserRacks: number) => {
    const isHomeWinner = workingWinnerId === workingHomePlayerId;
    const hp = findPlayer(workingHomePlayerId!, 'home');
    const ap = findPlayer(workingAwayPlayerId!, 'away');
    const hsl = hp?.skillLevel ?? 5;
    const asl = ap?.skillLevel ?? 5;
    const [homeRaceTo, awayRaceTo] = getRaceTo(hsl, asl);

    const homeRacks = isHomeWinner ? homeRaceTo : loserRacks;
    const awayRacks = isHomeWinner ? loserRacks : awayRaceTo;

    const newRetro: RetroMatchData = {
      homePlayerId: workingHomePlayerId!,
      awayPlayerId: workingAwayPlayerId!,
      winnerId: workingWinnerId!,
      homeRacks,
      awayRacks,
    };

    const updated = [...retroMatches, newRetro];
    setRetroMatches(updated);
    setWorkingHomePlayerId(null);
    setWorkingAwayPlayerId(null);
    setWorkingWinnerId(null);

    // Done with all retroactive matches?
    if (updated.length >= startingMatch - 1) {
      setPhase('current_home_player');
    } else {
      setPhase('retro_home_player');
    }
  };

  const handleCurrentHomePlayer = (playerId: string) => {
    setCurrentHomePlayerId(playerId);
    setPhase('current_away_player');
  };

  const handleCurrentAwayPlayer = (playerId: string) => {
    setCurrentAwayPlayerId(playerId);
    setPhase('current_partial_yes_no');
  };

  const handlePartialYesNo = (hasPartial: boolean) => {
    setHasPartialRacks(hasPartial);
    if (hasPartial) {
      setPhase('current_winner');
    } else {
      saveAndNavigate(false, null, 0);
    }
  };

  const handleCurrentWinner = (winnerId: string) => {
    setCurrentWinnerId(winnerId);
    setPhase('current_racks');
  };

  const handleCurrentRacks = (racks: number) => {
    setCurrentWinnerRacks(racks);
    saveAndNavigate(true, currentWinnerId, racks);
  };

  // ---------------------------------------------------------------------------
  // Save retroactive data + navigate
  // ---------------------------------------------------------------------------

  const saveAndNavigate = async (
    hasPartial: boolean,
    partialWinnerId: string | null,
    partialWinnerRacks: number,
  ) => {
    setPhase('saving');

    try {
      // Save each retroactive individual match
      for (let i = 0; i < retroMatches.length; i++) {
        const r = retroMatches[i];
        const matchOrder = i + 1;
        const hp = findPlayer(r.homePlayerId, 'home');
        const ap = findPlayer(r.awayPlayerId, 'away');

        const { error } = await supabase.from('individual_matches').upsert(
          {
            team_match_id:    matchId,
            match_order:      matchOrder,
            home_player_id:   r.homePlayerId,
            away_player_id:   r.awayPlayerId,
            home_skill_level: hp?.skillLevel ?? 5,
            away_skill_level: ap?.skillLevel ?? 5,
            home_racks:       r.homeRacks,
            away_racks:       r.awayRacks,
            winner_player_id: r.winnerId,
            status:           'completed',
          },
          { onConflict: 'team_match_id,match_order' },
        );

        if (error) throw new Error(`Failed to save match ${matchOrder}: ${error.message}`);
      }

      // Update team_match status to in_progress
      await supabase
        .from('team_matches')
        .update({ status: 'in_progress' })
        .eq('id', matchId);

      // Determine putUpTeam for the starting match
      // → loser of the previous individual match puts up first
      const lastRetro = retroMatches[retroMatches.length - 1];
      const lastLoserIsHome = lastRetro.winnerId === lastRetro.awayPlayerId;
      const putUpTeam: 'home' | 'away' = lastLoserIsHome ? 'home' : 'away';

      if (hasPartial && currentHomePlayerId && currentAwayPlayerId) {
        // Save partial starting match record
        const hp = findPlayer(currentHomePlayerId, 'home');
        const ap = findPlayer(currentAwayPlayerId, 'away');
        const isHomeWinner = partialWinnerId === currentHomePlayerId;
        const homeRacks = isHomeWinner ? partialWinnerRacks : 0;
        const awayRacks = isHomeWinner ? 0 : partialWinnerRacks;

        await supabase.from('individual_matches').upsert(
          {
            team_match_id:    matchId,
            match_order:      startingMatch,
            home_player_id:   currentHomePlayerId,
            away_player_id:   currentAwayPlayerId,
            home_skill_level: hp?.skillLevel ?? 5,
            away_skill_level: ap?.skillLevel ?? 5,
            home_racks:       homeRacks,
            away_racks:       awayRacks,
            status:           'in_progress',
          },
          { onConflict: 'team_match_id,match_order' },
        );

        // Navigate directly to the scoring screen for the starting match
        router.replace(
          `/(team)/(tabs)/scoring/${matchId}/${startingMatch - 1}`
        );
      } else {
        // No partial racks — go through putup for the starting match
        router.replace(
          `/(team)/(tabs)/scoring/${matchId}/putup?matchOrder=${startingMatch}&putUpTeam=${putUpTeam}`
        );
      }
    } catch (err: any) {
      console.error('Catchup save failed:', err.message);
      setPhase('select_start'); // Let them retry
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderHeader = (title: string, subtitle?: string) => (
    <View style={styles.headerBlock}>
      <Text style={styles.headerTitle}>{title}</Text>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
    </View>
  );

  const renderPlayerList = (
    players: RosterPlayer[],
    onSelect: (id: string) => void,
    excludeId?: string,
  ) => (
    <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
      {players
        .filter(p => p.id !== excludeId)
        .map(p => (
          <Pressable
            key={p.id}
            style={({ pressed }) => [styles.playerRow, pressed && styles.rowPressed]}
            onPress={() => onSelect(p.id)}
          >
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{playerName(p)}</Text>
              <Text style={styles.playerMeta}>SL {p.skillLevel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        ))}
    </ScrollView>
  );

  // ---------------------------------------------------------------------------
  // Render phases
  // ---------------------------------------------------------------------------

  if (phase === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (phase === 'saving') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.savingText}>Saving match history…</Text>
      </View>
    );
  }

  // ── Select starting match ─────────────────────────────────────────────────
  if (phase === 'select_start') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader(
          'Which match are you starting from?',
          'Select the individual match where scoring begins. Prior matches will be entered manually.',
        )}
        <View style={styles.matchGrid}>
          {[1, 2, 3, 4, 5].map(n => (
            <Pressable
              key={n}
              style={({ pressed }) => [styles.matchNumButton, pressed && styles.rowPressed]}
              onPress={() => handleSelectStart(n)}
            >
              <Text style={styles.matchNumText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // ── Retroactive home player ───────────────────────────────────────────────
  if (phase === 'retro_home_player') {
    const matchNum = currentRetroIndex + 1;
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader(
          `Match ${matchNum} — Home Player`,
          'Who played for the home team?',
        )}
        {renderPlayerList(homePlayers, handleRetroHomePlayer)}
      </SafeAreaView>
    );
  }

  // ── Retroactive away player ───────────────────────────────────────────────
  if (phase === 'retro_away_player') {
    const matchNum = currentRetroIndex + 1;
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader(
          `Match ${matchNum} — Away Player`,
          'Who played for the away team?',
        )}
        {renderPlayerList(awayPlayers, handleRetroAwayPlayer)}
      </SafeAreaView>
    );
  }

  // ── Retroactive winner ────────────────────────────────────────────────────
  if (phase === 'retro_winner') {
    const matchNum = currentRetroIndex + 1;
    const hp = findPlayer(workingHomePlayerId!, 'home');
    const ap = findPlayer(workingAwayPlayerId!, 'away');
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader(`Match ${matchNum} — Who Won?`)}
        <View style={styles.choiceList}>
          {hp && (
            <Pressable
              style={({ pressed }) => [styles.choiceButton, pressed && styles.rowPressed]}
              onPress={() => handleRetroWinner(hp.id)}
            >
              <Text style={styles.choiceLabel}>{playerName(hp)}</Text>
              <Text style={styles.choiceMeta}>Home · SL {hp.skillLevel}</Text>
            </Pressable>
          )}
          {ap && (
            <Pressable
              style={({ pressed }) => [styles.choiceButton, pressed && styles.rowPressed]}
              onPress={() => handleRetroWinner(ap.id)}
            >
              <Text style={styles.choiceLabel}>{playerName(ap)}</Text>
              <Text style={styles.choiceMeta}>Away · SL {ap.skillLevel}</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Retroactive loser rack count ──────────────────────────────────────────
  if (phase === 'retro_racks') {
    const matchNum = currentRetroIndex + 1;
    const loserOptions = rackOptions(workingHomePlayerId!, workingAwayPlayerId!, workingWinnerId!);
    const isHomeWinner = workingWinnerId === workingHomePlayerId;
    const loserPlayer = isHomeWinner
      ? findPlayer(workingAwayPlayerId!, 'away')
      : findPlayer(workingHomePlayerId!, 'home');
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader(
          `Match ${matchNum} — Loser Racks`,
          `How many racks did ${loserPlayer ? playerName(loserPlayer) : 'the loser'} win?`,
        )}
        <View style={styles.rackGrid}>
          {loserOptions.map(n => (
            <Pressable
              key={n}
              style={({ pressed }) => [styles.rackButton, pressed && styles.rowPressed]}
              onPress={() => handleRetroRacks(n)}
            >
              <Text style={styles.rackText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // ── Current match home player ─────────────────────────────────────────────
  if (phase === 'current_home_player') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader(
          `Match ${startingMatch} — Home Player`,
          'Who is playing for the home team in this match?',
        )}
        {renderPlayerList(
          homePlayers,
          handleCurrentHomePlayer,
          retroMatches.map(r => r.homePlayerId).pop(), // soft exclude — not strictly required
        )}
      </SafeAreaView>
    );
  }

  // ── Current match away player ─────────────────────────────────────────────
  if (phase === 'current_away_player') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader(
          `Match ${startingMatch} — Away Player`,
          'Who is playing for the away team in this match?',
        )}
        {renderPlayerList(awayPlayers, handleCurrentAwayPlayer)}
      </SafeAreaView>
    );
  }

  // ── Did any racks already play? ───────────────────────────────────────────
  if (phase === 'current_partial_yes_no') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader(
          `Match ${startingMatch} — Racks Already Played?`,
          'Did either player already win a rack before the app started?',
        )}
        <View style={styles.choiceList}>
          <Pressable
            style={({ pressed }) => [styles.choiceButton, pressed && styles.rowPressed]}
            onPress={() => handlePartialYesNo(false)}
          >
            <Text style={styles.choiceLabel}>No — match hasn't started yet</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.choiceButton, pressed && styles.rowPressed]}
            onPress={() => handlePartialYesNo(true)}
          >
            <Text style={styles.choiceLabel}>Yes — some racks were already played</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Current match partial winner ──────────────────────────────────────────
  if (phase === 'current_winner') {
    const hp = findPlayer(currentHomePlayerId!, 'home');
    const ap = findPlayer(currentAwayPlayerId!, 'away');
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader(
          `Match ${startingMatch} — Who's Winning?`,
          'Who has won racks so far?',
        )}
        <View style={styles.choiceList}>
          {hp && (
            <Pressable
              style={({ pressed }) => [styles.choiceButton, pressed && styles.rowPressed]}
              onPress={() => handleCurrentWinner(hp.id)}
            >
              <Text style={styles.choiceLabel}>{playerName(hp)}</Text>
              <Text style={styles.choiceMeta}>Home · SL {hp.skillLevel}</Text>
            </Pressable>
          )}
          {ap && (
            <Pressable
              style={({ pressed }) => [styles.choiceButton, pressed && styles.rowPressed]}
              onPress={() => handleCurrentWinner(ap.id)}
            >
              <Text style={styles.choiceLabel}>{playerName(ap)}</Text>
              <Text style={styles.choiceMeta}>Away · SL {ap.skillLevel}</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Current match partial rack count ──────────────────────────────────────
  if (phase === 'current_racks') {
    const options = currentWinnerId ? partialRackOptions(currentWinnerId) : [];
    const wp = currentWinnerId
      ? (findPlayer(currentWinnerId, 'home') ?? findPlayer(currentWinnerId, 'away'))
      : null;
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {renderHeader(
          `Match ${startingMatch} — Racks Won`,
          `How many racks has ${wp ? playerName(wp) : 'the leader'} won so far?`,
        )}
        <View style={styles.rackGrid}>
          {options.map(n => (
            <Pressable
              key={n}
              style={({ pressed }) => [styles.rackButton, pressed && styles.rowPressed]}
              onPress={() => handleCurrentRacks(n)}
            >
              <Text style={styles.rackText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    gap: 16,
  },
  savingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  headerBlock: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },

  // Match number grid
  matchGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  matchNumButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchNumText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Player list
  listScroll: {
    flex: 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowPressed: {
    opacity: 0.7,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
  },
  playerMeta: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  // Choice buttons (winner, yes/no)
  choiceList: {
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 14,
  },
  choiceButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  choiceLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  choiceMeta: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },

  // Rack number grid
  rackGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  rackButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rackText: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
