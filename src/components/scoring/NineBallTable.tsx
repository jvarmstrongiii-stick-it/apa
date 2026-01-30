/**
 * NineBallTable - Ball selector grid for 9-ball scoring
 *
 * Displays 9 pool balls in a diamond/grid pattern. Each ball can be
 * tapped to cycle through states: unpocketed -> home pocketed ->
 * away pocketed -> dead -> unpocketed. Includes running point totals
 * and progress bars toward point targets.
 *
 * Ball 9 is worth 2 points; balls 1-8 are worth 1 point each.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';

interface NineBallTableProps {
  currentRack: {
    ballsPocketedHome: number[];
    ballsPocketedAway: number[];
    deadBalls: number[];
  };
  homePointsTotal: number;
  awayPointsTotal: number;
  homePointTarget: number;
  awayPointTarget: number;
  onPocketBall: (ballNumber: number, pocketedBy: 'home' | 'away') => void;
  onMarkDeadBall: (ballNumber: number) => void;
  onUndoBall: (ballNumber: number) => void;
  onCompleteRack: () => void;
  disabled?: boolean;
}

/** Standard pool ball colors */
const BALL_COLORS: Record<number, { bg: string; stripe: boolean }> = {
  1: { bg: '#FFD700', stripe: false },    // Yellow
  2: { bg: '#1E90FF', stripe: false },    // Blue
  3: { bg: '#DC143C', stripe: false },    // Red
  4: { bg: '#8B008B', stripe: false },    // Purple
  5: { bg: '#FF8C00', stripe: false },    // Orange
  6: { bg: '#228B22', stripe: false },    // Green
  7: { bg: '#8B4513', stripe: false },    // Brown
  8: { bg: '#1A1A1A', stripe: false },    // Black
  9: { bg: '#FFD700', stripe: true },     // Yellow stripe
};

/** Diamond arrangement: rows of 1, 2, 3, 2, 1 */
const BALL_LAYOUT: number[][] = [
  [1],
  [2, 3],
  [4, 9, 5],
  [6, 7],
  [8],
];

/** Points value for each ball */
const getPointValue = (ballNumber: number): number => {
  return ballNumber === 9 ? 2 : 1;
};

type BallState = 'unpocketed' | 'home' | 'away' | 'dead';

export const NineBallTable: React.FC<NineBallTableProps> = ({
  currentRack,
  homePointsTotal,
  awayPointsTotal,
  homePointTarget,
  awayPointTarget,
  onPocketBall,
  onMarkDeadBall,
  onUndoBall,
  onCompleteRack,
  disabled = false,
}) => {
  const getBallState = (ballNumber: number): BallState => {
    if (currentRack.ballsPocketedHome.includes(ballNumber)) return 'home';
    if (currentRack.ballsPocketedAway.includes(ballNumber)) return 'away';
    if (currentRack.deadBalls.includes(ballNumber)) return 'dead';
    return 'unpocketed';
  };

  const handleBallTap = (ballNumber: number) => {
    if (disabled) return;
    const state = getBallState(ballNumber);

    switch (state) {
      case 'unpocketed':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPocketBall(ballNumber, 'home');
        break;
      case 'home':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onUndoBall(ballNumber);
        onPocketBall(ballNumber, 'away');
        break;
      case 'away':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onUndoBall(ballNumber);
        onMarkDeadBall(ballNumber);
        break;
      case 'dead':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onUndoBall(ballNumber);
        break;
    }
  };

  const calculateRackPoints = (side: 'home' | 'away'): number => {
    const balls =
      side === 'home'
        ? currentRack.ballsPocketedHome
        : currentRack.ballsPocketedAway;
    return balls.reduce((sum, ball) => sum + getPointValue(ball), 0);
  };

  const homeRackPoints = calculateRackPoints('home');
  const awayRackPoints = calculateRackPoints('away');

  const renderBall = (ballNumber: number) => {
    const ballColor = BALL_COLORS[ballNumber];
    const state = getBallState(ballNumber);

    const borderColor =
      state === 'home'
        ? theme.colors.success
        : state === 'away'
        ? theme.colors.error
        : state === 'dead'
        ? theme.colors.textMuted
        : 'transparent';

    const ballBg = state === 'dead' ? theme.colors.textMuted : ballColor.bg;
    const opacity = state === 'dead' ? 0.5 : 1;

    return (
      <TouchableOpacity
        key={ballNumber}
        style={[
          styles.ball,
          { backgroundColor: ballBg, opacity },
          state !== 'unpocketed' && {
            borderColor,
            borderWidth: 4,
          },
        ]}
        onPress={() => handleBallTap(ballNumber)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {ballColor.stripe && (
          <View style={styles.stripe} />
        )}
        <View style={styles.ballNumberCircle}>
          <Text
            style={[
              styles.ballNumber,
              ballNumber === 8 && { color: theme.colors.text },
            ]}
          >
            {ballNumber}
          </Text>
        </View>
        {state === 'dead' && (
          <Text style={styles.deadX}>X</Text>
        )}
        {state === 'home' && (
          <View style={styles.stateIndicator}>
            <Text style={styles.stateText}>H</Text>
          </View>
        )}
        {state === 'away' && (
          <View style={[styles.stateIndicator, styles.awayIndicator]}>
            <Text style={styles.stateText}>A</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const homeProgress = Math.min(homePointsTotal / homePointTarget, 1);
  const awayProgress = Math.min(awayPointsTotal / awayPointTarget, 1);

  return (
    <View style={styles.container}>
      {/* Points Display */}
      <View style={styles.pointsContainer}>
        <View style={styles.pointsBlock}>
          <Text style={styles.pointsLabel}>HOME</Text>
          <Text style={styles.pointsValue}>
            {homePointsTotal}
            <Text style={styles.pointsTarget}> / {homePointTarget} pts</Text>
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                styles.homeProgressFill,
                { width: `${homeProgress * 100}%` },
              ]}
            />
          </View>
          {homeRackPoints > 0 && (
            <Text style={styles.rackPoints}>+{homeRackPoints} this rack</Text>
          )}
        </View>
        <View style={styles.pointsBlock}>
          <Text style={styles.pointsLabel}>AWAY</Text>
          <Text style={styles.pointsValue}>
            {awayPointsTotal}
            <Text style={styles.pointsTarget}> / {awayPointTarget} pts</Text>
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                styles.awayProgressFill,
                { width: `${awayProgress * 100}%` },
              ]}
            />
          </View>
          {awayRackPoints > 0 && (
            <Text style={styles.rackPoints}>+{awayRackPoints} this rack</Text>
          )}
        </View>
      </View>

      {/* Ball Diamond Layout */}
      <View style={styles.diamondContainer}>
        {BALL_LAYOUT.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.ballRow}>
            {row.map((ballNumber) => renderBall(ballNumber))}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
          <Text style={styles.legendText}>Home</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.error }]} />
          <Text style={styles.legendText}>Away</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.textMuted }]} />
          <Text style={styles.legendText}>Dead</Text>
        </View>
      </View>

      {/* Complete Rack Button */}
      <TouchableOpacity
        style={[
          styles.completeButton,
          disabled && styles.completeButtonDisabled,
        ]}
        onPress={() => {
          if (!disabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onCompleteRack();
          }
        }}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={styles.completeButtonText}>Complete Rack</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  pointsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  pointsBlock: {
    flex: 1,
    alignItems: 'center',
  },
  pointsLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: theme.spacing.xs,
  },
  pointsValue: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  pointsTarget: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: '400',
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.full,
    marginTop: theme.spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  homeProgressFill: {
    backgroundColor: theme.colors.success,
  },
  awayProgressFill: {
    backgroundColor: theme.colors.error,
  },
  rackPoints: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing.xs,
  },
  diamondContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  ballRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.xs,
  },
  ball: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  stripe: {
    position: 'absolute',
    top: '30%',
    bottom: '30%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
  },
  ballNumberCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  ballNumber: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  deadX: {
    position: 'absolute',
    color: theme.colors.error,
    fontSize: 32,
    fontWeight: '900',
    zIndex: 2,
  },
  stateIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  awayIndicator: {
    backgroundColor: theme.colors.error,
  },
  stateText: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  completeButton: {
    minHeight: theme.touchTarget.minimum,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  completeButtonDisabled: {
    backgroundColor: theme.colors.surfaceLight,
  },
  completeButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
});

export default NineBallTable;
