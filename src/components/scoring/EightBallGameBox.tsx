/**
 * EightBallGameBox - Grid component showing 8-ball rack results (game boxes)
 *
 * Displays home/away rack wins in a visual grid with controls for
 * recording rack outcomes. Optimized for pool hall environments with
 * large touch targets and haptic feedback.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';

interface Rack {
  rackNumber: number;
  wonBy: 'home' | 'away' | null;
  isBreakAndRun: boolean;
  isEightOnBreak: boolean;
  deadRack: boolean;
}

interface EightBallGameBoxProps {
  racks: Rack[];
  homeRaceTo: number;
  awayRaceTo: number;
  homeGamesWon: number;
  awayGamesWon: number;
  onAddRack: (
    wonBy: 'home' | 'away',
    options?: {
      isBreakAndRun?: boolean;
      isEightOnBreak?: boolean;
      deadRack?: boolean;
    }
  ) => void;
  onUndoLastRack: () => void;
  disabled?: boolean;
}

export const EightBallGameBox: React.FC<EightBallGameBoxProps> = ({
  racks,
  homeRaceTo,
  awayRaceTo,
  homeGamesWon,
  awayGamesWon,
  onAddRack,
  onUndoLastRack,
  disabled = false,
}) => {
  const [isBreakAndRun, setIsBreakAndRun] = useState(false);
  const [isEightOnBreak, setIsEightOnBreak] = useState(false);

  const homeRacks = racks.filter((r) => r.wonBy === 'home');
  const awayRacks = racks.filter((r) => r.wonBy === 'away');

  const handleAddRack = (wonBy: 'home' | 'away') => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddRack(wonBy, {
      isBreakAndRun,
      isEightOnBreak,
    });
    setIsBreakAndRun(false);
    setIsEightOnBreak(false);
  };

  const handleDeadRack = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddRack('home', { deadRack: true });
  };

  const handleUndo = () => {
    if (disabled || racks.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUndoLastRack();
  };

  const toggleBreakAndRun = () => {
    Haptics.selectionAsync();
    setIsBreakAndRun((prev) => !prev);
    if (isEightOnBreak) setIsEightOnBreak(false);
  };

  const toggleEightOnBreak = () => {
    Haptics.selectionAsync();
    setIsEightOnBreak((prev) => !prev);
    if (isBreakAndRun) setIsBreakAndRun(false);
  };

  const renderRackBoxes = (
    side: 'home' | 'away',
    raceTo: number,
    wonRacks: Rack[]
  ) => {
    const boxes = [];
    for (let i = 0; i < raceTo; i++) {
      const rack = wonRacks[i];
      const isFilled = !!rack;
      const bgColor =
        side === 'home' ? theme.colors.success : theme.colors.error;

      boxes.push(
        <View
          key={`${side}-${i}`}
          style={[
            styles.rackBox,
            isFilled && { backgroundColor: bgColor },
          ]}
        >
          {isFilled && (
            <Text style={styles.rackBoxText}>{rack.rackNumber}</Text>
          )}
          {isFilled && rack.isBreakAndRun && (
            <Text style={styles.rackBadge}>BR</Text>
          )}
          {isFilled && rack.isEightOnBreak && (
            <Text style={styles.rackBadge}>8B</Text>
          )}
        </View>
      );
    }
    return boxes;
  };

  return (
    <View style={styles.container}>
      {/* Score Display */}
      <View style={styles.scoreContainer}>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>HOME</Text>
          <Text style={styles.scoreValue}>
            {homeGamesWon}{' '}
            <Text style={styles.scoreDivider}>/</Text>{' '}
            {homeRaceTo}
          </Text>
        </View>
        <View style={styles.scoreSeparator}>
          <Text style={styles.vsText}>vs</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>AWAY</Text>
          <Text style={styles.scoreValue}>
            {awayGamesWon}{' '}
            <Text style={styles.scoreDivider}>/</Text>{' '}
            {awayRaceTo}
          </Text>
        </View>
      </View>

      {/* Rack Boxes */}
      <View style={styles.rackSection}>
        <Text style={styles.sideLabel}>Home</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.rackRow}>
            {renderRackBoxes('home', homeRaceTo, homeRacks)}
          </View>
        </ScrollView>
      </View>

      <View style={styles.rackSection}>
        <Text style={styles.sideLabel}>Away</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.rackRow}>
            {renderRackBoxes('away', awayRaceTo, awayRacks)}
          </View>
        </ScrollView>
      </View>

      {/* Toggle Options */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            isBreakAndRun && styles.toggleButtonActive,
          ]}
          onPress={toggleBreakAndRun}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.toggleText,
              isBreakAndRun && styles.toggleTextActive,
            ]}
          >
            Break & Run
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            isEightOnBreak && styles.toggleButtonActive,
          ]}
          onPress={toggleEightOnBreak}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.toggleText,
              isEightOnBreak && styles.toggleTextActive,
            ]}
          >
            8 on Break
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.homeButton]}
          onPress={() => handleAddRack('home')}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>Home Won</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.awayButton]}
          onPress={() => handleAddRack('away')}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>Away Won</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.secondaryRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.deadRackButton]}
          onPress={handleDeadRack}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>Dead Rack</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.undoButton]}
          onPress={handleUndo}
          disabled={disabled || racks.length === 0}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.secondaryButtonText,
              (disabled || racks.length === 0) && styles.disabledText,
            ]}
          >
            Undo
          </Text>
        </TouchableOpacity>
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
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  scoreBlock: {
    flex: 1,
    alignItems: 'center',
  },
  scoreLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: theme.spacing.xs,
  },
  scoreValue: {
    color: theme.colors.text,
    fontSize: theme.fontSize.score,
    fontWeight: '700',
  },
  scoreDivider: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xl,
  },
  scoreSeparator: {
    paddingHorizontal: theme.spacing.md,
  },
  vsText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    fontWeight: '500',
  },
  rackSection: {
    marginBottom: theme.spacing.md,
  },
  sideLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  rackRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  rackBox: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rackBoxText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  rackBadge: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    position: 'absolute',
    bottom: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  toggleButton: {
    flex: 1,
    minHeight: theme.touchTarget.minimum,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  toggleButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryDark,
  },
  toggleText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: theme.colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: theme.touchTarget.minimum,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  homeButton: {
    backgroundColor: theme.colors.success,
  },
  awayButton: {
    backgroundColor: theme.colors.error,
  },
  actionButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    minHeight: theme.touchTarget.minimum,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  deadRackButton: {
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 2,
    borderColor: theme.colors.warning,
  },
  undoButton: {
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  disabledText: {
    color: theme.colors.textMuted,
  },
});

export default EightBallGameBox;
