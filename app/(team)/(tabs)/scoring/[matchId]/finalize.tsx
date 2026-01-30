import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

interface IndividualMatchResult {
  match_number: number;
  home_player: string;
  away_player: string;
  home_skill: number;
  away_skill: number;
  home_score: number;
  away_score: number;
  winner: 'home' | 'away' | null;
  is_complete: boolean;
}

// TODO: Replace with actual match results from store/API
const PLACEHOLDER_RESULTS: IndividualMatchResult[] = [
  { match_number: 1, home_player: 'John D.', away_player: 'Mike S.', home_skill: 5, away_skill: 4, home_score: 3, away_score: 2, winner: 'home', is_complete: true },
  { match_number: 2, home_player: 'Sarah L.', away_player: 'Chris P.', home_skill: 3, away_skill: 6, home_score: 2, away_score: 3, winner: 'away', is_complete: true },
  { match_number: 3, home_player: 'Tom R.', away_player: 'Amy K.', home_skill: 4, away_skill: 3, home_score: 3, away_score: 1, winner: 'home', is_complete: true },
  { match_number: 4, home_player: 'Lisa M.', away_player: 'Dave W.', home_skill: 6, away_skill: 5, home_score: 2, away_score: 3, winner: 'away', is_complete: true },
  { match_number: 5, home_player: 'Bob N.', away_player: 'Jane F.', home_skill: 5, away_skill: 4, home_score: 3, away_score: 0, winner: 'home', is_complete: true },
];

export default function FinalizeScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [results] = useState<IndividualMatchResult[]>(PLACEHOLDER_RESULTS);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const homeTotalPoints = results.reduce(
    (sum, r) => sum + (r.winner === 'home' ? r.home_score : 0) + (r.winner === 'away' ? r.home_score : 0),
    0
  );
  const awayTotalPoints = results.reduce(
    (sum, r) => sum + (r.winner === 'home' ? r.away_score : 0) + (r.winner === 'away' ? r.away_score : 0),
    0
  );

  // Calculate total match wins (not game wins)
  const homeMatchWins = results.filter((r) => r.winner === 'home').length;
  const awayMatchWins = results.filter((r) => r.winner === 'away').length;

  const incompleteMatches = results.filter((r) => !r.is_complete);
  const hasIncompleteMatches = incompleteMatches.length > 0;

  const handleFinalize = async () => {
    if (hasIncompleteMatches) {
      Alert.alert(
        'Incomplete Matches',
        `${incompleteMatches.length} individual match(es) are incomplete. Please complete all matches before finalizing.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Finalize Match',
      'Are you sure you want to finalize this match? This action cannot be undone by team members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize',
          onPress: async () => {
            setIsFinalizing(true);
            try {
              // TODO: Submit finalized match to API
              await new Promise((resolve) => setTimeout(resolve, 500));

              Alert.alert('Match Finalized', 'The match has been submitted successfully.', [
                {
                  text: 'OK',
                  onPress: () => router.replace('/(team)/(tabs)'),
                },
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to finalize match. Please try again.');
            } finally {
              setIsFinalizing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Finalize Match</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning Banner */}
        {hasIncompleteMatches && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={22} color="#FF9800" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Incomplete Matches</Text>
              <Text style={styles.warningText}>
                {incompleteMatches.length} individual match(es) are not yet
                complete.
              </Text>
            </View>
          </View>
        )}

        {/* Total Score Card */}
        <View style={styles.totalScoreCard}>
          <Text style={styles.totalScoreLabel}>FINAL SCORE</Text>
          <View style={styles.totalScoreRow}>
            <View style={styles.totalScoreTeam}>
              <Text style={styles.totalTeamLabel}>Home</Text>
              <Text style={styles.totalScoreValue}>{homeMatchWins}</Text>
            </View>
            <View style={styles.totalScoreDivider}>
              <Text style={styles.totalScoreDash}>-</Text>
            </View>
            <View style={styles.totalScoreTeam}>
              <Text style={styles.totalTeamLabel}>Away</Text>
              <Text style={styles.totalScoreValue}>{awayMatchWins}</Text>
            </View>
          </View>
          <View style={styles.totalPointsRow}>
            <Text style={styles.totalPointsLabel}>
              Total Points: {homeTotalPoints} - {awayTotalPoints}
            </Text>
          </View>
        </View>

        {/* Individual Match Results */}
        <Text style={styles.sectionTitle}>Individual Matches</Text>
        <View style={styles.resultsContainer}>
          {results.map((result, index) => (
            <View
              key={result.match_number}
              style={[
                styles.resultRow,
                index === results.length - 1 && styles.resultRowLast,
                !result.is_complete && styles.resultRowIncomplete,
              ]}
            >
              <View style={styles.matchNumberBadge}>
                <Text style={styles.matchNumberText}>{result.match_number}</Text>
              </View>
              <View style={styles.resultContent}>
                <View style={styles.resultPlayersRow}>
                  <View style={styles.resultPlayer}>
                    <Text
                      style={[
                        styles.resultPlayerName,
                        result.winner === 'home' && styles.winnerName,
                      ]}
                    >
                      {result.home_player}
                    </Text>
                    <Text style={styles.resultPlayerSkill}>
                      SL {result.home_skill}
                    </Text>
                  </View>
                  <Text style={styles.resultScore}>
                    {result.home_score} - {result.away_score}
                  </Text>
                  <View style={[styles.resultPlayer, styles.resultPlayerRight]}>
                    <Text
                      style={[
                        styles.resultPlayerName,
                        styles.textRight,
                        result.winner === 'away' && styles.winnerName,
                      ]}
                    >
                      {result.away_player}
                    </Text>
                    <Text style={[styles.resultPlayerSkill, styles.textRight]}>
                      SL {result.away_skill}
                    </Text>
                  </View>
                </View>
                {!result.is_complete && (
                  <View style={styles.incompleteLabel}>
                    <Ionicons name="alert-circle" size={14} color="#FF9800" />
                    <Text style={styles.incompleteLabelText}>Incomplete</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Finalize Button */}
      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [
            styles.finalizeButton,
            pressed && styles.buttonPressed,
            hasIncompleteMatches && styles.finalizeButtonDisabled,
            isFinalizing && styles.finalizeButtonDisabled,
          ]}
          onPress={handleFinalize}
          disabled={isFinalizing}
        >
          {isFinalizing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text style={styles.finalizeButtonText}>Finalize Match</Text>
            </>
          )}
        </Pressable>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FF980015',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF980040',
    marginBottom: 20,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF9800',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  totalScoreCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginBottom: 24,
  },
  totalScoreLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  totalScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalScoreTeam: {
    alignItems: 'center',
    minWidth: 80,
  },
  totalTeamLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  totalScoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.text,
  },
  totalScoreDivider: {
    paddingHorizontal: 20,
  },
  totalScoreDash: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  totalPointsRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  totalPointsLabel: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },
  resultsContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  resultRowLast: {
    borderBottomWidth: 0,
  },
  resultRowIncomplete: {
    backgroundColor: '#FF980008',
  },
  matchNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  resultContent: {
    flex: 1,
  },
  resultPlayersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultPlayer: {
    flex: 1,
  },
  resultPlayerRight: {
    alignItems: 'flex-end',
  },
  resultPlayerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  winnerName: {
    color: '#4CAF50',
  },
  resultPlayerSkill: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  textRight: {
    textAlign: 'right',
  },
  resultScore: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    paddingHorizontal: 10,
  },
  incompleteLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  incompleteLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
  },
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
  finalizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 18,
    minHeight: 56,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  finalizeButtonDisabled: {
    opacity: 0.5,
  },
  finalizeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
