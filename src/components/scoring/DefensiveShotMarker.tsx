/**
 * DefensiveShotMarker - Tracks defensive shot count
 *
 * Simple counter component for recording defensive shots taken
 * during a match. Features large touch targets and haptic feedback
 * for reliable pool hall operation.
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

interface DefensiveShotMarkerProps {
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export const DefensiveShotMarker: React.FC<DefensiveShotMarkerProps> = ({
  count,
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
    if (disabled || count <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDecrement();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Defensive Shots</Text>

      <View style={styles.counterRow}>
        <TouchableOpacity
          style={[
            styles.counterButton,
            (disabled || count <= 0) && styles.counterButtonDisabled,
          ]}
          onPress={handleDecrement}
          disabled={disabled || count <= 0}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.counterButtonText,
              (disabled || count <= 0) && styles.counterButtonTextDisabled,
            ]}
          >
            -
          </Text>
        </TouchableOpacity>

        <Text style={styles.countText}>{count}</Text>

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

      {/* Visual marker dots */}
      {count > 0 && (
        <View style={styles.dotsContainer}>
          {Array.from({ length: Math.min(count, 20) }).map((_, i) => (
            <View key={i} style={styles.dot} />
          ))}
          {count > 20 && (
            <Text style={styles.overflowText}>+{count - 20}</Text>
          )}
        </View>
      )}
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
  dotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.warning,
  },
  overflowText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
});

export default DefensiveShotMarker;
