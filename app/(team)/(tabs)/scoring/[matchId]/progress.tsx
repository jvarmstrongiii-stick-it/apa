/**
 * MatchProgressScreen — Individual match slot list for an in-progress team match.
 *
 * Shown when "Continue Scoring" is tapped on an in-progress match.
 * Lists all 5 individual match slots with their current state and appropriate CTA:
 *   - needs_putup → "Put Up →" → putup screen
 *   - in_progress → "Continue →" → scoring screen (0-indexed)
 *   - complete    → dimmed card, no action
 *
 * Also serves multi-table: if two individual matches are running simultaneously,
 * both show "Continue →" and the scorekeeper taps whichever they want.
 */

import { useState, useEffect } from 'react';
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
import { theme } from '../../../../../src/constants/theme';
import { supabase } from '../../../../../src/lib/supabase';

type Side = 'home' | 'away';

interface MatchSlot {
  slotNumber: number;           // 1–5
  individualMatchId: string | null;
  homePlayerName: string | null;
  awayPlayerName: string | null;
  homeSL: number | null;
  awaySL: number | null;
  homePoints: number;
  awayPoints: number;
  homeRaceTo: number;
  awayRaceTo: number;
  status: 'complete' | 'in_progress' | 'needs_putup';
  putUpTeam: Side;
}

export default function MatchProgressScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  const [loading, setLoading] = useState(true);
  const [homeTeamName, setHomeTeamName] = useState('Home');
  const [awayTeamName, setAwayTeamName] = useState('Away');
  const [slots, setSlots] = useState<MatchSlot[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!matchId) return;

      const { data: tm } = await supabase
        .from('team_matches')
        .select(
          'put_up_team, home_team_id, away_team_id, ' +
          'home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)'
        )
        .eq('id', matchId)
        .single();

      if (!tm) { setLoading(false); return; }

      setHomeTeamName((tm as any).home_team?.name ?? 'Home');
      setAwayTeamName((tm as any).away_team?.name ?? 'Away');

      const { data: ims } = await supabase
        .from('individual_matches')
        .select(
          'id, match_order, home_player_id, away_player_id, ' +
          'home_race_to, away_race_to, home_points_earned, away_points_earned, ' +
          'home_player:players!home_player_id(first_name, last_name, skill_level), ' +
          'away_player:players!away_player_id(first_name, last_name, skill_level)'
        )
        .eq('team_match_id', matchId)
        .order('match_order', { ascending: true });

      const rows = (ims ?? []) as any[];

      // Build all 5 slots; track the loser of each completed match to determine
      // who puts up first for the next slot.
      const firstPutUp: Side = ((tm as any).put_up_team ?? 'home') as Side;
      let nextPutUpTeam: Side = firstPutUp;
      const built: MatchSlot[] = [];

      for (let slot = 1; slot <= 5; slot++) {
        const row = rows.find(r => r.match_order === slot);
        const putUpTeam = slot === 1 ? firstPutUp : nextPutUpTeam;

        if (!row || !row.home_player_id || !row.away_player_id) {
          built.push({
            slotNumber: slot,
            individualMatchId: row?.id ?? null,
            homePlayerName: null,
            awayPlayerName: null,
            homeSL: null,
            awaySL: null,
            homePoints: 0,
            awayPoints: 0,
            homeRaceTo: 0,
            awayRaceTo: 0,
            status: 'needs_putup',
            putUpTeam,
          });
          continue;
        }

        const hp: number = row.home_points_earned ?? 0;
        const ap: number = row.away_points_earned ?? 0;
        const hr: number = row.home_race_to ?? 0;
        const ar: number = row.away_race_to ?? 0;
        const isComplete = hr > 0 && (hp >= hr || ap >= ar);

        if (isComplete) {
          // Winner won → loser puts up next
          nextPutUpTeam = hp >= hr ? 'away' : 'home';
        }

        const homeName = row.home_player
          ? `${row.home_player.first_name ?? ''} ${row.home_player.last_name ?? ''}`.trim()
          : null;
        const awayName = row.away_player
          ? `${row.away_player.first_name ?? ''} ${row.away_player.last_name ?? ''}`.trim()
          : null;

        built.push({
          slotNumber: slot,
          individualMatchId: row.id,
          homePlayerName: homeName,
          awayPlayerName: awayName,
          homeSL: row.home_player?.skill_level ?? null,
          awaySL: row.away_player?.skill_level ?? null,
          homePoints: hp,
          awayPoints: ap,
          homeRaceTo: hr,
          awayRaceTo: ar,
          status: isComplete ? 'complete' : 'in_progress',
          putUpTeam,
        });
      }

      setSlots(built);
      setLoading(false);
    };

    load();
  }, [matchId]);

  const handleSlotPress = (slot: MatchSlot) => {
    if (slot.status === 'complete') return;
    if (slot.status === 'needs_putup') {
      router.push(
        `/(team)/(tabs)/scoring/${matchId}/putup?matchOrder=${slot.slotNumber}&putUpTeam=${slot.putUpTeam}`
      );
    } else {
      // in_progress — scoring screen is 0-indexed
      router.push(`/(team)/(tabs)/scoring/${matchId}/${slot.slotNumber - 1}`);
    }
  };

  const renderSlot = ({ item }: { item: MatchSlot }) => {
    const isComplete = item.status === 'complete';
    const isInProgress = item.status === 'in_progress';
    const isNeedsPutup = item.status === 'needs_putup';

    return (
      <Pressable
        style={({ pressed }) => [
          styles.slotCard,
          isComplete && styles.slotCardComplete,
          !isComplete && pressed && styles.slotCardPressed,
        ]}
        onPress={() => handleSlotPress(item)}
        disabled={isComplete}
      >
        {/* Header row: match number + status pill */}
        <View style={styles.slotHeader}>
          <Text style={[styles.slotNumber, isComplete && styles.slotNumberDim]}>
            Match {item.slotNumber} of 5
          </Text>
          {isComplete && (
            <View style={[styles.pill, styles.pillComplete]}>
              <Ionicons name="checkmark" size={11} color={theme.colors.success} />
              <Text style={[styles.pillText, { color: theme.colors.success }]}>Complete</Text>
            </View>
          )}
          {isInProgress && (
            <View style={[styles.pill, styles.pillInProgress]}>
              <View style={styles.activeDot} />
              <Text style={[styles.pillText, { color: '#FF9800' }]}>In Progress</Text>
            </View>
          )}
          {isNeedsPutup && (
            <View style={[styles.pill, styles.pillPutup]}>
              <Text style={[styles.pillText, { color: theme.colors.textSecondary }]}>Put-Up Needed</Text>
            </View>
          )}
        </View>

        {/* Matchup: player names + score */}
        {item.homePlayerName || item.awayPlayerName ? (
          <View style={styles.matchupRow}>
            <View style={styles.playerSide}>
              <Text style={styles.playerName} numberOfLines={1}>
                {item.homePlayerName ?? '—'}
              </Text>
              {item.homeSL !== null && (
                <Text style={styles.playerMeta}>SL {item.homeSL}</Text>
              )}
            </View>
            <Text style={styles.scoreText}>
              {isComplete ? `${item.homePoints}–${item.awayPoints}` : 'vs'}
            </Text>
            <View style={[styles.playerSide, styles.playerSideRight]}>
              <Text style={[styles.playerName, styles.textRight]} numberOfLines={1}>
                {item.awayPlayerName ?? '—'}
              </Text>
              {item.awaySL !== null && (
                <Text style={[styles.playerMeta, styles.textRight]}>SL {item.awaySL}</Text>
              )}
            </View>
          </View>
        ) : (
          <Text style={styles.noPlayersText}>Players not yet selected</Text>
        )}

        {/* Race-to info */}
        {item.homeRaceTo > 0 && (
          <Text style={styles.raceTo}>
            Race to {item.homeRaceTo} – {item.awayRaceTo}
          </Text>
        )}

        {/* CTA */}
        {!isComplete && (
          <View style={styles.ctaRow}>
            <Text style={[styles.ctaText, isNeedsPutup && styles.ctaTextSecondary]}>
              {isNeedsPutup ? 'Put Up' : 'Continue Scoring'}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={isNeedsPutup ? theme.colors.textSecondary : theme.colors.primary}
            />
          </View>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable style={styles.headerButton} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Match Progress</Text>
          <Text style={styles.headerSub}>{homeTeamName} vs {awayTeamName}</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      <FlatList
        data={slots}
        keyExtractor={(item) => String(item.slotNumber)}
        renderItem={renderSlot}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

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
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  slotCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  slotCardComplete: {
    opacity: 0.55,
  },
  slotCardPressed: {
    opacity: 0.88,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  slotNumberDim: {
    color: theme.colors.textSecondary,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillComplete: {
    backgroundColor: theme.colors.success + '18',
  },
  pillInProgress: {
    backgroundColor: '#FF980018',
  },
  pillPutup: {
    backgroundColor: theme.colors.border,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF9800',
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerSide: {
    flex: 1,
    gap: 2,
  },
  playerSideRight: {
    alignItems: 'flex-end',
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  playerMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  textRight: {
    textAlign: 'right',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    minWidth: 44,
    textAlign: 'center',
  },
  noPlayersText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  raceTo: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  ctaTextSecondary: {
    color: theme.colors.textSecondary,
  },
});
