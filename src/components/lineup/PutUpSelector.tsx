/**
 * PutUpSelector - Reorderable list for player put-up order
 *
 * Shows the order players will be "put up" for matchups during a team
 * match. Uses simple up/down arrow buttons for reordering instead of
 * drag gestures for reliable pool hall operation.
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

interface Player {
  id: string;
  name: string;
  skillLevel: number;
  position: number;
}

interface PutUpSelectorProps {
  players: Player[];
  putUpOrder: number[];
  onReorder: (newOrder: number[]) => void;
  disabled?: boolean;
}

export const PutUpSelector: React.FC<PutUpSelectorProps> = ({
  players,
  putUpOrder,
  onReorder,
  disabled = false,
}) => {
  const getPlayerByPosition = (position: number): Player | undefined => {
    return players.find((p) => p.position === position);
  };

  const handleMoveUp = (index: number) => {
    if (disabled || index <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newOrder = [...putUpOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index - 1];
    newOrder[index - 1] = temp;
    onReorder(newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (disabled || index >= putUpOrder.length - 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newOrder = [...putUpOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;
    onReorder(newOrder);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Put-Up Order</Text>
      <Text style={styles.subtitle}>
        Order players will be put up for matchups
      </Text>

      <View style={styles.listContainer}>
        {putUpOrder.map((position, index) => {
          const player = getPlayerByPosition(position);
          if (!player) return null;

          const isFirst = index === 0;
          const isLast = index === putUpOrder.length - 1;

          return (
            <View key={position} style={styles.row}>
              {/* Order Number */}
              <View style={styles.orderBadge}>
                <Text style={styles.orderText}>{index + 1}</Text>
              </View>

              {/* Player Info */}
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <View style={styles.playerMeta}>
                  <Text style={styles.positionLabel}>
                    Pos {player.position}
                  </Text>
                  <View style={styles.skillBadge}>
                    <Text style={styles.skillText}>
                      SL {player.skillLevel}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Reorder Buttons */}
              <View style={styles.arrowContainer}>
                <TouchableOpacity
                  style={[
                    styles.arrowButton,
                    (isFirst || disabled) && styles.arrowButtonDisabled,
                  ]}
                  onPress={() => handleMoveUp(index)}
                  disabled={isFirst || disabled}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.arrowText,
                      (isFirst || disabled) && styles.arrowTextDisabled,
                    ]}
                  >
                    &#9650;
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.arrowButton,
                    (isLast || disabled) && styles.arrowButtonDisabled,
                  ]}
                  onPress={() => handleMoveDown(index)}
                  disabled={isLast || disabled}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.arrowText,
                      (isLast || disabled) && styles.arrowTextDisabled,
                    ]}
                  >
                    &#9660;
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
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
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.md,
  },
  listContainer: {
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    minHeight: theme.touchTarget.minimum + 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  orderBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  orderText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  positionLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '500',
  },
  skillBadge: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  skillText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  arrowContainer: {
    gap: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  arrowButton: {
    width: theme.touchTarget.minimum,
    height: theme.touchTarget.minimum / 2 + 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowButtonDisabled: {
    borderColor: theme.colors.surfaceLight,
    backgroundColor: theme.colors.surfaceLight,
  },
  arrowText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  arrowTextDisabled: {
    color: theme.colors.textMuted,
  },
});

export default PutUpSelector;
