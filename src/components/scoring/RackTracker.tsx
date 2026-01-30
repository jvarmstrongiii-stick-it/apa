/**
 * RackTracker - Horizontal scrollable list of rack indicators
 *
 * Shows a visual timeline of racks played in a match. Each rack is
 * represented as a small colored circle: green for home wins, red
 * for away wins, and highlighted gray for the current/future racks.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { theme } from '../../constants/theme';

interface RackTrackerProps {
  totalRacks: number;
  currentRackNumber: number;
  racks: Array<{ wonBy: 'home' | 'away' | null }>;
}

export const RackTracker: React.FC<RackTrackerProps> = ({
  totalRacks,
  currentRackNumber,
  racks,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Auto-scroll to keep the current rack visible
    if (scrollViewRef.current && currentRackNumber > 0) {
      const scrollPosition = Math.max(0, (currentRackNumber - 3) * 36);
      scrollViewRef.current.scrollTo({ x: scrollPosition, animated: true });
    }
  }, [currentRackNumber]);

  const getRackColor = (index: number) => {
    const rack = racks[index];
    if (rack && rack.wonBy === 'home') return theme.colors.success;
    if (rack && rack.wonBy === 'away') return theme.colors.error;
    if (index + 1 === currentRackNumber) return theme.colors.primary;
    return theme.colors.surfaceLight;
  };

  const isCurrent = (index: number) => index + 1 === currentRackNumber;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Racks</Text>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {Array.from({ length: Math.max(totalRacks, currentRackNumber) }).map(
          (_, index) => (
            <View
              key={index}
              style={[
                styles.rackIndicator,
                { backgroundColor: getRackColor(index) },
                isCurrent(index) && styles.currentRack,
              ]}
            >
              <Text
                style={[
                  styles.rackNumber,
                  isCurrent(index) && styles.currentRackNumber,
                ]}
              >
                {index + 1}
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  rackIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  currentRack: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  rackNumber: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  currentRackNumber: {
    color: theme.colors.text,
    fontWeight: '700',
  },
});

export default RackTracker;
