import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/constants/theme';

interface Division {
  id: string;
  name: string;
  team_count: number;
}

interface LeagueDetail {
  id: string;
  name: string;
  game_format: '8-ball' | '9-ball';
  season: string;
  year: number;
  is_active: boolean;
  divisions: Division[];
}

export default function AdminLeagueDetail() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    fetchLeague();
  }, [leagueId]);

  const fetchLeague = async () => {
    setIsLoading(true);
    try {
      // TODO: Fetch league detail from API using leagueId
      await new Promise((resolve) => setTimeout(resolve, 300));

      const mockLeague: LeagueDetail = {
        id: leagueId ?? '1',
        name: 'Monday 8-Ball',
        game_format: '8-ball',
        season: 'Spring',
        year: 2026,
        is_active: true,
        divisions: [
          { id: 'd1', name: 'Division A', team_count: 6 },
          { id: 'd2', name: 'Division B', team_count: 6 },
        ],
      };

      setLeague(mockLeague);
      setName(mockLeague.name);
      setSeason(mockLeague.season);
      setYear(String(mockLeague.year));
    } catch (error) {
      console.error('Failed to fetch league:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !season.trim() || !year.trim()) {
      Alert.alert('Validation Error', 'Please fill in all fields.');
      return;
    }

    setIsSaving(true);
    try {
      // TODO: Save league changes via API
      await new Promise((resolve) => setTimeout(resolve, 500));

      setLeague((prev) =>
        prev ? { ...prev, name: name.trim(), season: season.trim(), year: parseInt(year) } : prev
      );
      setIsEditing(false);
      Alert.alert('Success', 'League updated successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDivision = () => {
    Alert.prompt(
      'New Division',
      'Enter division name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (divisionName) => {
            if (divisionName?.trim()) {
              // TODO: Add division via API
              const newDivision: Division = {
                id: `d${Date.now()}`,
                name: divisionName.trim(),
                team_count: 0,
              };
              setLeague((prev) =>
                prev ? { ...prev, divisions: [...prev.divisions, newDivision] } : prev
              );
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleRemoveDivision = (divisionId: string) => {
    Alert.alert('Remove Division', 'Are you sure you want to remove this division?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          // TODO: Remove division via API
          setLeague((prev) =>
            prev
              ? {
                  ...prev,
                  divisions: prev.divisions.filter((d) => d.id !== divisionId),
                }
              : prev
          );
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!league) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>League not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>League Detail</Text>
        <Pressable
          style={styles.headerButton}
          onPress={() => {
            if (isEditing) {
              handleSave();
            } else {
              setIsEditing(true);
            }
          }}
          hitSlop={12}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={styles.editButtonText}>
              {isEditing ? 'Save' : 'Edit'}
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* League Info Section */}
        <Text style={styles.sectionTitle}>League Information</Text>
        <View style={styles.section}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder="League name"
                placeholderTextColor={theme.colors.textSecondary}
              />
            ) : (
              <Text style={styles.fieldValue}>{league.name}</Text>
            )}
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Format</Text>
            <Text style={styles.fieldValue}>{league.game_format}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Season</Text>
            {isEditing ? (
              <TextInput
                style={styles.fieldInput}
                value={season}
                onChangeText={setSeason}
                placeholder="Season"
                placeholderTextColor={theme.colors.textSecondary}
              />
            ) : (
              <Text style={styles.fieldValue}>{league.season}</Text>
            )}
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Year</Text>
            {isEditing ? (
              <TextInput
                style={styles.fieldInput}
                value={year}
                onChangeText={setYear}
                keyboardType="number-pad"
                placeholder="Year"
                placeholderTextColor={theme.colors.textSecondary}
              />
            ) : (
              <Text style={styles.fieldValue}>{league.year}</Text>
            )}
          </View>

          <View style={[styles.fieldRow, styles.fieldRowLast]}>
            <Text style={styles.fieldLabel}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                league.is_active ? styles.activeBadge : styles.inactiveBadge,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  league.is_active ? styles.activeStatusText : styles.inactiveStatusText,
                ]}
              >
                {league.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>

        {/* Divisions Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Divisions</Text>
          <Pressable
            style={({ pressed }) => [
              styles.addDivisionButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleAddDivision}
          >
            <Ionicons name="add" size={20} color={theme.colors.primary} />
            <Text style={styles.addDivisionText}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          {league.divisions.length === 0 ? (
            <View style={styles.emptyDivisions}>
              <Text style={styles.emptyText}>No divisions yet</Text>
            </View>
          ) : (
            league.divisions.map((division, index) => (
              <View
                key={division.id}
                style={[
                  styles.divisionRow,
                  index === league.divisions.length - 1 && styles.fieldRowLast,
                ]}
              >
                <View style={styles.divisionInfo}>
                  <Text style={styles.divisionName}>{division.name}</Text>
                  <Text style={styles.divisionTeams}>
                    {division.team_count} teams
                  </Text>
                </View>
                {isEditing && (
                  <Pressable
                    style={styles.removeDivisionButton}
                    onPress={() => handleRemoveDivision(division.id)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    color: theme.colors.textSecondary,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '600',
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
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 52,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '600',
  },
  fieldInput: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    minHeight: 36,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  activeBadge: {
    backgroundColor: '#4CAF5020',
  },
  inactiveBadge: {
    backgroundColor: '#9E9E9E20',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  activeStatusText: {
    color: '#4CAF50',
  },
  inactiveStatusText: {
    color: '#9E9E9E',
  },
  addDivisionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    minHeight: 48,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  addDivisionText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  divisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 56,
  },
  divisionInfo: {
    flex: 1,
  },
  divisionName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  divisionTeams: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  removeDivisionButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDivisions: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
});
