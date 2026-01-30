/**
 * InningsCounter - Tracks innings with tally mark visualization
 *
 * Displays the current innings count in large text along with a
 * traditional tally mark visualization (groups of 5). Includes
 * plus/minus buttons with haptic feedback for pool hall use.
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

interface InningsCounterProps {
  innings: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

/**
 * Renders tally marks: groups of 5 with a diagonal slash,
 * remaining as vertical lines.
 */
const TallyMarks: React.FC<{ count: number }> = ({ count }) => {
  const fullGroups = Math.floor(count / 5);
  const remainder = count % 5;

  return (
    <View style={tallyStyles.container}>
      {Array.from({ length: fullGroups }).map((_, groupIndex) => (
        <View key={`group-${groupIndex}`} style={tallyStyles.group}>
          {/* Four vertical lines */}
          <View style={tallyStyles.verticalLine} />
          <View style={tallyStyles.verticalLine} />
          <View style={tallyStyles.verticalLine} />
          <View style={tallyStyles.verticalLine} />
          {/* Diagonal slash across the group */}
          <View style={tallyStyles.diagonalLine} />
        </View>
      ))}
      {remainder > 0 && (
        <View style={tallyStyles.group}>
          {Array.from({ length: remainder }).map((_, i) => (
            <View key={`rem-${i}`} style={tallyStyles.verticalLine} />
          ))}
        </View>
      )}
    </View>
  );
};

const tallyStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    minHeight: 40,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    paddingHorizontal: 2,
  },
  verticalLine: {
    width: 3,
    height: 28,
    backgroundColor: theme.colors.text,
    borderRadius: 1,
  },
  diagonalLine: {
    position: 'absolute',
    width: 36,
    height: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: 1,
    transform: [{ rotate: '-30deg' }],
    left: -2,
    top: 12,
  },
});

export const InningsCounter: React.FC<InningsCounterProps> = ({
  innings,
  onIncrement,
  onDecrement,
  disabled = false,
}) => {
  const handleIncrement = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onIncrement();
  };

  const handleDecrement = () => {
    if (disabled || innings <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDecrement();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Innings</Text>

      <View style={styles.counterRow}>
        <TouchableOpacity
          style={[
            styles.counterButton,
            (disabled || innings <= 0) && styles.counterButtonDisabled,
          ]}
          onPress={handleDecrement}
          disabled={disabled || innings <= 0}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.counterButtonText,
              (disabled || innings <= 0) && styles.counterButtonTextDisabled,
            ]}
          >
            -
          </Text>
        </TouchableOpacity>

        <Text style={styles.countText}>{innings}</Text>

        <TouchableOpacity
          style={[
            styles.counterButton,
            disabled && styles.counterButtonDisabled,
          ]}
          onPress={handleIncrement}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.counterButtonText,
              disabled && styles.counterButtonTextDisabled,
            ]}
          >
            +
          </Text>
        </TouchableOpacity>
      </View>

      <TallyMarks count={innings} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  counterButton: {
    width: theme.touchTarget.minimum,
    height: theme.touchTarget.minimum,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonDisabled: {
    borderColor: theme.colors.surfaceLight,
  },
  counterButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  counterButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
  countText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'center',
  },
});

export default InningsCounter;
