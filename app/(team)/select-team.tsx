import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase/client';
import { useAuthContext } from '../../src/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamOption {
  id: string;
  name: string;
  teamNumber: string;
  divisionName: string;
  leagueName: string;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SelectTeamScreen() {
  const { user, refreshProfile } = useAuthContext();

  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [filtered, setFiltered] = useState<TeamOption[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ------------------------------------------------------------------
  // Fetch all available teams
  // ------------------------------------------------------------------

  const fetchTeams = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        team_number,
        divisions (
          name,
          leagues ( name )
        )
      `)
      .order('name');

    if (error) {
      Alert.alert('Error', 'Could not load teams. Please check your connection.');
      setIsLoading(false);
      return;
    }

    const mapped: TeamOption[] = (data ?? []).map((t: any) => ({
      id:           t.id,
      name:         t.name ?? '(No Name)',
      teamNumber:   t.team_number ?? '',
      divisionName: t.divisions?.name ?? '',
      leagueName:   t.divisions?.leagues?.name ?? '',
    }));

    setTeams(mapped);
    setFiltered(mapped);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  // ------------------------------------------------------------------
  // Search filter
  // ------------------------------------------------------------------

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setFiltered(teams);
      return;
    }
    setFiltered(
      teams.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.teamNumber.includes(q) ||
          t.divisionName.toLowerCase().includes(q),
      ),
    );
  }, [search, teams]);

  // ------------------------------------------------------------------
  // Confirm selection
  // ------------------------------------------------------------------

  const handleSelect = (team: TeamOption) => {
    Alert.alert(
      'Join Team',
      `Set your team to:\n\n${team.name} (#${team.teamNumber})\n${team.divisionName}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => confirmSelect(team),
        },
      ],
    );
  };

  const confirmSelect = async (team: TeamOption) => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ team_id: team.id })
      .eq('id', user.id);

    if (error) {
      Alert.alert('Error', 'Could not save your team selection. Please try again.');
      setIsSaving(false);
      return;
    }

    await refreshProfile();
    router.replace('/(team)/(tabs)');
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const renderItem = ({ item }: { item: TeamOption }) => (
    <Pressable
      style={({ pressed }) => [styles.teamCard, pressed && styles.teamCardPressed]}
      onPress={() => handleSelect(item)}
      disabled={isSaving}
    >
      <View style={styles.teamInfo}>
        <Text style={styles.teamName}>{item.name}</Text>
        <Text style={styles.teamMeta}>
          #{item.teamNumber}
          {item.divisionName ? `  ·  ${item.divisionName}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Select Your Team</Text>
        <Text style={styles.subtitle}>
          Choose the team you play for. You can contact your League Operator if your
          team isn't listed yet.
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or team number…"
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {search ? 'No teams match your search.' : 'No teams available yet.'}
              </Text>
            </View>
          }
        />
      )}

      {isSaving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.savingText}>Saving…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  teamCardPressed: {
    opacity: 0.75,
    borderColor: theme.colors.primary,
  },
  teamInfo: {
    flex: 1,
    gap: 4,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  teamMeta: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  savingText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
