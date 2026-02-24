/**
 * ResumeScreen — Individual match selector for resuming an in-progress team match
 *
 * Shown when "Score Match" is tapped and the user indicates this is NOT
 * the first match of the night (i.e., the match was already started and
 * the app needs to be resumed).
 *
 * Displays all 5 individual matches with their current status and
 * player names. Tapping a match records a resumed_at timestamp
 * and navigates to the scoring screen for that individual match.
 *
 * Format: "Match 3 resumed at 9:35 PM" is stored on individual_matches.resumed_at
 */

import { useState, useEffect } from 'react';
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
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../../src/constants/theme';
import { supabase } from '../../../../../src/lib/supabase';

interface IndividualMatchSummary {
  id: string | null;          // null if match hasn't started yet
  match_order: number;
  home_player_name: string | null;
  away_player_name: string | null;
  is_completed: boolean;
  resumed_at: string | null;
}

const MATCH_SLOTS = [1, 2, 3, 4, 5];

export default function ResumeScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<IndividualMatchSummary[]>([]);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!matchId) return;

      const { data } = await supabase
        .from('individual_matches')
        .select(
          'id, match_order, is_completed, resumed_at, ' +
          'home_player:players!home_player_id(first_name, last_name), ' +
          'away_player:players!away_player_id(first_name, last_name)'
        )
        .eq('team_match_id', matchId)
        .order('match_order', { ascending: true });

      const existingByOrder = new Map(
        (data ?? []).map((im: any) => [im.match_order, im])
      );

      // Build all 5 slots (even for matches not yet created in the DB)
      const slots: IndividualMatchSummary[] = MATCH_SLOTS.map((order) => {
        const im = existingByOrder.get(order) as any;
        if (!im) {
          return {
            id: null,
            match_order: order,
            home_player_name: null,
            away_player_name: null,
            is_completed: false,
            resumed_at: null,
          };
        }
        const homeName =
          im.home_player
            ? `${im.home_player.first_name ?? ''} ${im.home_player.last_name ?? ''}`.trim()
            : null;
        const awayName =
          im.away_player
            ? `${im.away_player.first_name ?? ''} ${im.away_player.last_name ?? ''}`.trim()
            : null;
        return {
          id: im.id,
          match_order: order,
          home_player_name: homeName || null,
          away_player_name: awayName || null,
          is_completed: im.is_completed ?? false,
          resumed_at: im.resumed_at ?? null,
        };
      });

      setMatches(slots);
      setLoading(false);
    };

    fetchMatches();
  }, [matchId]);

  const handleResumeMatch = async (match: IndividualMatchSummary) => {
    if (!matchId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Write resumed_at timestamp if the individual_match exists
    if (match.id) {
      await supabase
        .from('individual_matches')
        .update({ resumed_at: new Date().toISOString() })
        .eq('id', match.id);
    }

    // Navigate to the scoring screen for this individual match
    router.push(
      `/(team)/(tabs)/scoring/${matchId}/${match.match_order - 1}`
    );
  };

  const formatResumedAt = (ts: string | null): string | null => {
    if (!ts) return null;
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (match: IndividualMatchSummary) => {
    if (match.is_completed) return 'Completed';
    if (match.id) return 'In Progress';
    return 'Not Started';
  };

  const getStatusColor = (match: IndividualMatchSummary) => {
    if (match.is_completed) return theme.colors.success;
    if (match.id) return '#FF9800';
    return theme.colors.textMuted;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Resume Match</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.instructions}>
          Select the individual match to resume scoring.
        </Text>

        {matches.map((match) => {
          const statusColor = getStatusColor(match);
          const resumedTime = formatResumedAt(match.resumed_at);
          const canResume = !match.is_completed;

          return (
            <Pressable
              key={match.match_order}
              style={({ pressed }) => [
                styles.matchCard,
                match.is_completed && styles.matchCardCompleted,
                pressed && canResume && styles.cardPressed,
              ]}
              onPress={() => canResume && handleResumeMatch(match)}
              disabled={!canResume}
            >
              <View style={styles.matchCardLeft}>
                <View style={styles.matchNumberBadge}>
                  <Text style={styles.matchNumberText}>{match.match_order}</Text>
                </View>
              </View>

              <View style={styles.matchCardCenter}>
                {match.home_player_name && match.away_player_name ? (
                  <>
                    <Text style={styles.playerNames}>
                      {match.home_player_name}
                    </Text>
                    <Text style={styles.vsText}>vs</Text>
                    <Text style={styles.playerNames}>
                      {match.away_player_name}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.noPlayersText}>
                    {match.id ? 'Players not yet set' : 'Not started'}
                  </Text>
                )}

                <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {getStatusLabel(match)}
                  </Text>
                </View>

                {resumedTime && (
                  <Text style={styles.resumedText}>
                    Last resumed at {resumedTime}
                  </Text>
                )}
              </View>

              <View style={styles.matchCardRight}>
                {canResume ? (
                  <Ionicons
                    name="arrow-forward-circle"
                    size={28}
                    color={match.id ? theme.colors.primary : theme.colors.textMuted}
                  />
                ) : (
                  <Ionicons
                    name="checkmark-circle"
                    size={28}
                    color={theme.colors.success}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  scrollContent: {
    padding: 20,
    gap: 12,
  },
  instructions: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 22,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 80,
    gap: 14,
  },
  matchCardCompleted: {
    opacity: 0.55,
  },
  cardPressed: {
    opacity: 0.85,
    backgroundColor: theme.colors.surfaceLight,
  },
  matchCardLeft: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchNumberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  matchCardCenter: {
    flex: 1,
    gap: 4,
  },
  playerNames: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  vsText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  noPlayersText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resumedText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  matchCardRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
