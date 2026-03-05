import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../../../src/constants/theme';
import { supabase } from '../../../../../../src/lib/supabase/client';

interface Player {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  skill_level: number | null;
  is_active: boolean;
}

interface TeamDetail {
  id: string;
  name: string;
  team_number: string | null;
  is_active: boolean;
}

export default function TeamRoster() {
  const { divisionId, teamId } = useLocalSearchParams<{ divisionId: string; teamId: string }>();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function fetchData() {
        setLoading(true);
        try {
          const [teamResult, rosterResult] = await Promise.all([
            supabase
              .from('teams')
              .select('id, name, team_number, is_active')
              .eq('id', teamId!)
              .single(),
            supabase
              .from('team_players')
              .select('is_active, player:players(id, member_number, first_name, last_name, skill_level, is_active)')
              .eq('team_id', teamId!)
              .order('players(last_name)'),
          ]);

          if (teamResult.error) throw teamResult.error;
          if (rosterResult.error) throw rosterResult.error;

          if (!cancelled) {
            setTeam({
              id: teamResult.data.id,
              name: teamResult.data.name,
              team_number: teamResult.data.team_number,
              is_active: teamResult.data.is_active ?? true,
            });

            const active: Player[] = [];
            const inactive: Player[] = [];
            for (const row of rosterResult.data ?? []) {
              const p = (row as any).player;
              if (!p) continue;
              const entry: Player = {
                id: p.id,
                member_number: p.member_number,
                first_name: p.first_name ?? '',
                last_name: p.last_name ?? '',
                skill_level: p.skill_level,
                is_active: (row as any).is_active ?? true,
              };
              (entry.is_active ? active : inactive).push(entry);
            }
            // Sort each group by last name
            const byName = (a: Player, b: Player) =>
              a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
            setPlayers([...active.sort(byName), ...inactive.sort(byName)]);
          }
        } catch (err) {
          console.error('[TeamRoster] Failed to fetch:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      fetchData();
      return () => { cancelled = true; };
    }, [teamId])
  );

  const handleToggleActive = () => {
    if (!team) return;
    Alert.alert(
      `${team.is_active ? 'Deactivate' : 'Reactivate'} Team`,
      team.is_active
        ? 'This will hide the team from active views. Data is preserved.'
        : 'This will mark the team as active again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: team.is_active ? 'Deactivate' : 'Reactivate',
          style: team.is_active ? 'destructive' : 'default',
          onPress: async () => {
            setToggling(true);
            const { error } = await supabase
              .from('teams')
              .update({ is_active: !team.is_active })
              .eq('id', team.id);
            setToggling(false);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              setTeam((prev) => prev ? { ...prev, is_active: !prev.is_active } : prev);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {team?.name ?? 'Team'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={players}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Team info card */}
              <View style={styles.infoCard}>
                {team?.team_number ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Team #</Text>
                    <Text style={styles.infoValue}>{team.team_number}</Text>
                  </View>
                ) : null}
                <View style={[styles.infoRow, styles.infoRowLast]}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <Pressable
                    style={({ pressed }) => [styles.toggleButton, pressed && styles.buttonPressed]}
                    onPress={handleToggleActive}
                    disabled={toggling}
                  >
                    {toggling ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <Text style={[
                        styles.toggleText,
                        { color: team?.is_active ? '#4CAF50' : '#9E9E9E' },
                      ]}>
                        {team?.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    )}
                    <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.sectionTitle}>
                Players ({players.length})
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No players on this roster</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.playerRow, !item.is_active && styles.rowInactive]}>
              <View style={styles.slBadge}>
                <Text style={styles.slText}>{item.skill_level ?? '?'}</Text>
              </View>
              <View style={styles.playerInfo}>
                <Text style={[styles.playerName, !item.is_active && styles.textInactive]}>
                  {item.last_name}, {item.first_name}
                </Text>
                <Text style={styles.memberNumber}>#{item.member_number}</Text>
              </View>
              {!item.is_active && (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.inactiveBadgeText}>Inactive</Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    minWidth: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 52,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 4,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 64,
    gap: 14,
  },
  rowInactive: {
    opacity: 0.5,
  },
  slBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  textInactive: {
    color: theme.colors.textSecondary,
  },
  memberNumber: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  inactiveBadge: {
    backgroundColor: '#9E9E9E20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inactiveBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9E9E9E',
  },
});
