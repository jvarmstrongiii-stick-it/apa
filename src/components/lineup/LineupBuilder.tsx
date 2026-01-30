/**
 * LineupBuilder - 5-player lineup selection with 23-rule enforcement
 *
 * Provides 5 numbered player slots that can be filled from an available
 * players list. Tracks running skill level total and enforces the APA
 * 23-rule (combined team skill level must not exceed 23). Features large
 * touch targets and dark theme for pool hall environments.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';

interface Player {
  id: string;
  name: string;
  skillLevel: number;
}

interface SelectedPlayer extends Player {
  position: number;
}

interface LineupBuilderProps {
  availablePlayers: Player[];
  selectedPlayers: SelectedPlayer[];
  maxSkillLevel: number; // 23
  onSelectPlayer: (playerId: string, position: number) => void;
  onRemovePlayer: (position: number) => void;
  onConfirm: () => void;
  disabled?: boolean;
}

export const LineupBuilder: React.FC<LineupBuilderProps> = ({
  availablePlayers,
  selectedPlayers,
  maxSkillLevel,
  onSelectPlayer,
  onRemovePlayer,
  onConfirm,
  disabled = false,
}) => {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activePosition, setActivePosition] = useState<number | null>(null);

  const totalSkillLevel = selectedPlayers.reduce(
    (sum, p) => sum + p.skillLevel,
    0
  );
  const isOverLimit = totalSkillLevel > maxSkillLevel;
  const allSlotsFilled = selectedPlayers.length === 5;
  const isValid = allSlotsFilled && !isOverLimit;

  const selectedIds = new Set(selectedPlayers.map((p) => p.id));
  const filteredPlayers = availablePlayers.filter(
    (p) => !selectedIds.has(p.id)
  );

  const getPlayerAtPosition = (position: number): SelectedPlayer | undefined => {
    return selectedPlayers.find((p) => p.position === position);
  };

  const handleSlotPress = (position: number) => {
    if (disabled) return;
    Haptics.selectionAsync();
    const existing = getPlayerAtPosition(position);
    if (existing) {
      // Remove player from slot
      onRemovePlayer(position);
    } else {
      // Open picker for this slot
      setActivePosition(position);
      setPickerVisible(true);
    }
  };

  const handlePlayerSelect = (playerId: string) => {
    if (activePosition === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectPlayer(playerId, activePosition);
    setPickerVisible(false);
    setActivePosition(null);
  };

  const handleConfirm = () => {
    if (!isValid || disabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  };

  const renderSlot = (position: number) => {
    const player = getPlayerAtPosition(position);
    const isEmpty = !player;

    return (
      <TouchableOpacity
        key={position}
        style={[
          styles.slot,
          isEmpty && styles.emptySlot,
          !isEmpty && styles.filledSlot,
        ]}
        onPress={() => handleSlotPress(position)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <View style={styles.slotNumber}>
          <Text style={styles.slotNumberText}>{position}</Text>
        </View>
        {player ? (
          <View style={styles.slotContent}>
            <Text style={styles.slotPlayerName}>{player.name}</Text>
            <View style={styles.slotSkillBadge}>
              <Text style={styles.slotSkillText}>SL {player.skillLevel}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.emptySlotText}>Tap to select player</Text>
        )}
        {player && (
          <Text style={styles.removeHint}>Tap to remove</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Skill Level Total */}
      <View style={styles.skillTotalContainer}>
        <Text style={styles.skillTotalLabel}>TEAM SKILL LEVEL</Text>
        <Text
          style={[
            styles.skillTotalValue,
            isOverLimit ? styles.overLimit : styles.underLimit,
          ]}
        >
          {totalSkillLevel} / {maxSkillLevel}
        </Text>
        {isOverLimit && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>
              Exceeds the 23-rule! Remove or swap a player to reduce skill level.
            </Text>
          </View>
        )}
      </View>

      {/* Player Slots */}
      <View style={styles.slotsContainer}>
        {[1, 2, 3, 4, 5].map((position) => renderSlot(position))}
      </View>

      {/* Confirm Button */}
      <TouchableOpacity
        style={[
          styles.confirmButton,
          !isValid && styles.confirmButtonDisabled,
        ]}
        onPress={handleConfirm}
        disabled={!isValid || disabled}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.confirmButtonText,
            !isValid && styles.confirmButtonTextDisabled,
          ]}
        >
          Confirm Lineup
        </Text>
      </TouchableOpacity>

      {/* Player Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select Player for Position {activePosition}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPickerVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            {filteredPlayers.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>
                  No available players remaining
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredPlayers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => handlePlayerSelect(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pickerName}>{item.name}</Text>
                    <View style={styles.pickerSkillBadge}>
                      <Text style={styles.pickerSkillText}>
                        SL {item.skillLevel}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => (
                  <View style={styles.pickerSeparator} />
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  skillTotalContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  skillTotalLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: theme.spacing.xs,
  },
  skillTotalValue: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
  },
  underLimit: {
    color: theme.colors.success,
  },
  overLimit: {
    color: theme.colors.error,
  },
  warningContainer: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  warningText: {
    color: theme.colors.warning,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  slotsContainer: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  slot: {
    minHeight: theme.touchTarget.minimum + 16,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  emptySlot: {
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  filledSlot: {
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  slotNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  slotNumberText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  slotContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  slotPlayerName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    flex: 1,
  },
  slotSkillBadge: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  slotSkillText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  emptySlotText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    flex: 1,
  },
  removeHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
  confirmButton: {
    minHeight: theme.touchTarget.minimum,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  confirmButtonDisabled: {
    backgroundColor: theme.colors.surfaceLight,
  },
  confirmButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  confirmButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '70%',
    paddingBottom: theme.spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  modalCloseButton: {
    minHeight: theme.touchTarget.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  modalCloseText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  emptyList: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyListText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: theme.touchTarget.minimum + 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  pickerName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    flex: 1,
  },
  pickerSkillBadge: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  pickerSkillText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  pickerSeparator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
  },
});

export default LineupBuilder;
