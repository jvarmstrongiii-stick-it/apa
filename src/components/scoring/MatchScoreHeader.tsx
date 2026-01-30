/**
 * MatchScoreHeader - Top bar showing match status and scores
 *
 * Displays both players' names, skill levels, current scores,
 * race/point targets, and match order. The leading player's score
 * is highlighted in green for quick visual identification.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { theme } from '../../constants/theme';

interface MatchScoreHeaderProps {
  homePlayerName: string;
  awayPlayerName: string;
  homeSkillLevel: number;
  awaySkillLevel: number;
  homeScore: number;
  awayScore: number;
  homeTarget: number;
  awayTarget: number;
  gameFormat: 'eight_ball' | 'nine_ball';
  matchOrder: number;
}

export const MatchScoreHeader: React.FC<MatchScoreHeaderProps> = ({
  homePlayerName,
  awayPlayerName,
  homeSkillLevel,
  awaySkillLevel,
  homeScore,
  awayScore,
  homeTarget,
  awayTarget,
  gameFormat,
  matchOrder,
}) => {
  const homeLeading = homeScore > awayScore;
  const awayLeading = awayScore > homeScore;
  const formatLabel = gameFormat === 'eight_ball' ? '8-Ball' : '9-Ball';
  const unitLabel = gameFormat === 'eight_ball' ? 'games' : 'pts';

  return (
    <View style={styles.container}>
      {/* Match Info */}
      <View style={styles.matchInfoRow}>
        <Text style={styles.matchInfoText}>
          Match {matchOrder} of 5
        </Text>
        <Text style={styles.formatBadge}>{formatLabel}</Text>
      </View>

      {/* Score Display */}
      <View style={styles.scoreRow}>
        {/* Home Player */}
        <View style={styles.playerBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.playerName} numberOfLines={1}>
              {homePlayerName}
            </Text>
            <View style={styles.skillBadge}>
              <Text style={styles.skillBadgeText}>SL {homeSkillLevel}</Text>
            </View>
          </View>
          <Text
            style={[
              styles.scoreText,
              homeLeading && styles.leadingScore,
            ]}
          >
            {homeScore}
          </Text>
          <Text style={styles.targetText}>
            / {homeTarget} {unitLabel}
          </Text>
        </View>

        {/* VS Separator */}
        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>vs</Text>
        </View>

        {/* Away Player */}
        <View style={styles.playerBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.playerName} numberOfLines={1}>
              {awayPlayerName}
            </Text>
            <View style={[styles.skillBadge, styles.awaySkillBadge]}>
              <Text style={styles.skillBadgeText}>SL {awaySkillLevel}</Text>
            </View>
          </View>
          <Text
            style={[
              styles.scoreText,
              awayLeading && styles.leadingScore,
            ]}
          >
            {awayScore}
          </Text>
          <Text style={styles.targetText}>
            / {awayTarget} {unitLabel}
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  matchInfoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  matchInfoText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  formatBadge: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerBlock: {
    flex: 1,
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  playerName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    flexShrink: 1,
  },
  skillBadge: {
    backgroundColor: theme.colors.success,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  awaySkillBadge: {
    backgroundColor: theme.colors.error,
  },
  skillBadgeText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  scoreText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.score,
    fontWeight: '700',
  },
  leadingScore: {
    color: theme.colors.success,
  },
  targetText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  vsContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  vsText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    fontWeight: '500',
  },
});

export default MatchScoreHeader;
