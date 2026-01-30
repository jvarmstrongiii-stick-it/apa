/**
 * TeamMatchSummary - Card listing all 5 individual matches in a team match
 *
 * Shows a summary of each individual match within the team match,
 * including player names, scores, and points earned. Completed
 * matches display a checkmark. Total team points are shown at the bottom.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { theme } from '../../constants/theme';

interface IndividualMatch {
  matchOrder: number;
  homePlayerName: string;
  awayPlayerName: string;
  homeScore: number;
  awayScore: number;
  homePoints: number;
  awayPoints: number;
  isCompleted: boolean;
  gameFormat: 'eight_ball' | 'nine_ball';
}

interface TeamMatchSummaryProps {
  homeTeamName: string;
  awayTeamName: string;
  individualMatches: IndividualMatch[];
  totalHomePoints: number;
  totalAwayPoints: number;
}

export const TeamMatchSummary: React.FC<TeamMatchSummaryProps> = ({
  homeTeamName,
  awayTeamName,
  individualMatches,
  totalHomePoints,
  totalAwayPoints,
}) => {
  const homeLeading = totalHomePoints > totalAwayPoints;
  const awayLeading = totalAwayPoints > totalHomePoints;

  return (
    <View style={styles.container}>
      {/* Team Names Header */}
      <View style={styles.headerRow}>
        <Text style={styles.teamName} numberOfLines={1}>
          {homeTeamName}
        </Text>
        <Text style={styles.headerVs}>vs</Text>
        <Text style={styles.teamName} numberOfLines={1}>
          {awayTeamName}
        </Text>
      </View>

      {/* Column Labels */}
      <View style={styles.columnLabelsRow}>
        <Text style={[styles.columnLabel, styles.matchColumn]}>#</Text>
        <Text style={[styles.columnLabel, styles.playerColumn]}>Home</Text>
        <Text style={[styles.columnLabel, styles.scoreColumn]}>Score</Text>
        <Text style={[styles.columnLabel, styles.playerColumn]}>Away</Text>
        <Text style={[styles.columnLabel, styles.pointsColumn]}>Pts</Text>
        <View style={styles.statusColumn} />
      </View>

      {/* Individual Matches */}
      {individualMatches.map((match) => {
        const formatLabel =
          match.gameFormat === 'eight_ball' ? '8' : '9';

        return (
          <View
            key={match.matchOrder}
            style={[
              styles.matchRow,
              match.isCompleted && styles.completedRow,
            ]}
          >
            <View style={styles.matchColumn}>
              <Text style={styles.matchOrderText}>{match.matchOrder}</Text>
              <View style={styles.formatMini}>
                <Text style={styles.formatMiniText}>{formatLabel}</Text>
              </View>
            </View>

            <View style={styles.playerColumn}>
              <Text style={styles.playerNameText} numberOfLines={1}>
                {match.homePlayerName}
              </Text>
            </View>

            <View style={styles.scoreColumn}>
              <Text style={styles.scoreText}>
                <Text
                  style={
                    match.homeScore > match.awayScore
                      ? styles.winningScore
                      : undefined
                  }
                >
                  {match.homeScore}
                </Text>
                <Text style={styles.scoreDash}> - </Text>
                <Text
                  style={
                    match.awayScore > match.homeScore
                      ? styles.winningScore
                      : undefined
                  }
                >
                  {match.awayScore}
                </Text>
              </Text>
            </View>

            <View style={styles.playerColumn}>
              <Text style={styles.playerNameText} numberOfLines={1}>
                {match.awayPlayerName}
              </Text>
            </View>

            <View style={styles.pointsColumn}>
              <Text style={styles.pointsText}>
                {match.homePoints}-{match.awayPoints}
              </Text>
            </View>

            <View style={styles.statusColumn}>
              {match.isCompleted ? (
                <Text style={styles.checkmark}>&#10003;</Text>
              ) : (
                <View style={styles.pendingDot} />
              )}
            </View>
          </View>
        );
      })}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Total Points */}
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>TOTAL POINTS</Text>
        <View style={styles.totalsScoreContainer}>
          <Text
            style={[
              styles.totalsScore,
              homeLeading && styles.leadingTotal,
            ]}
          >
            {totalHomePoints}
          </Text>
          <Text style={styles.totalsDash}> - </Text>
          <Text
            style={[
              styles.totalsScore,
              awayLeading && styles.leadingTotal,
            ]}
          >
            {totalAwayPoints}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  teamName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerVs: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    fontWeight: '500',
  },
  columnLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.xs,
  },
  columnLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background,
  },
  completedRow: {
    opacity: 1,
  },
  matchColumn: {
    width: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchOrderText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  formatMini: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  formatMiniText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  playerColumn: {
    flex: 1,
    paddingHorizontal: theme.spacing.xs,
  },
  playerNameText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  scoreColumn: {
    width: 60,
    alignItems: 'center',
  },
  scoreText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  scoreDash: {
    color: theme.colors.textMuted,
  },
  winningScore: {
    color: theme.colors.success,
    fontWeight: '700',
  },
  pointsColumn: {
    width: 44,
    alignItems: 'center',
  },
  pointsText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  statusColumn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: theme.colors.success,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.textMuted,
  },
  divider: {
    height: 2,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalsLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    letterSpacing: 1,
  },
  totalsScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalsScore: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
  },
  leadingTotal: {
    color: theme.colors.success,
  },
  totalsDash: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xl,
  },
});

export default TeamMatchSummary;
