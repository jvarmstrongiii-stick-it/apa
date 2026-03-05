import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../../src/constants/theme';
import { supabase } from '../../../../../src/lib/supabase/client';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Team {
  id: string;
  name: string;
  team_number: string | null;
  is_active: boolean;
  player_count: number;
}

interface DivisionDetail {
  id: string;
  name: string;
  day_of_week: number | null;
  is_active: boolean;
}

export default function DivisionDetail() {
  const { divisionId } = useLocalSearchParams<{ divisionId: string }>();
  const [division, setDivision] = useState<DivisionDetail | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function fetchData() {
        setLoading(true);
        try {
          const [divResult, teamsResult] = await Promise.all([
            supabase
              .from('divisions')
              .select('id, name, day_of_week, is_active')
              .eq('id', divisionId!)
              .single(),
            supabase
              .from('teams')
              .select('id, name, team_number, is_active, team_players(id)')
              .eq('division_id', divisionId!)
              .order('name'),
          ]);

          if (divResult.error) throw divResult.error;
          if (teamsResult.error) throw teamsResult.error;

          if (!cancelled) {
            setDivision({
              id: divResult.data.id,
              name: divResult.data.name,
              day_of_week: divResult.data.day_of_week,
              is_active: divResult.data.is_active ?? true,
            });
            const active: Team[] = [];
            const inactive: Team[] = [];
            for (const t of teamsResult.data ?? []) {
              const entry: Team = {
                id: t.id,
                name: t.name,
                team_number: t.team_number,
                is_active: t.is_active ?? true,
                player_count: Array.isArray(t.team_players) ? t.team_players.length : 0,
              };
              (entry.is_active ? active : inactive).push(entry);
            }
            setTeams([...active, ...inactive]);
          }
        } catch (err) {
          console.error('[DivisionDetail] Failed to fetch:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      fetchData();
      return () => { cancelled = true; };
    }, [divisionId])
  );

  const handleToggleActive = () => {
    if (!division) return;
    const action = division.is_active ? 'deactivate' : 'reactivate';
    Alert.alert(
      `${division.is_active ? 'Deactivate' : 'Reactivate'} Division`,
      `${division.is_active
        ? 'This will hide the division from active views. Data is preserved.'
        : 'This will mark the division as active again.'
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: division.is_active ? 'Deactivate' : 'Reactivate',
          style: division.is_active ? 'destructive' : 'default',
          onPress: async () => {
            setToggling(true);
            const { error } = await supabase
              .from('divisions')
              .update({ is_active: !division.is_active })
              .eq('id', division.id);
            setToggling(false);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              setDivision((prev) => prev ? { ...prev, is_active: !prev.is_active } : prev);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {division?.name ?? 'Division'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Division info card */}
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Day</Text>
                  <Text style={styles.infoValue}>
                    {division?.day_of_week != null ? DAYS[division.day_of_week] : 'Not set'}
                  </Text>
                </View>
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
                        { color: division?.is_active ? '#4CAF50' : '#9E9E9E' },
                      ]}>
                        {division?.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    )}
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Teams</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No teams in this division</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                !item.is_active && styles.rowInactive,
                pressed && styles.rowPressed,
              ]}
              onPress={() =>
                router.push(`/(admin)/(tabs)/divisions/${divisionId}/team/${item.id}`)
              }
            >
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, !item.is_active && styles.textInactive]}>
                  {item.name}
                </Text>
                <Text style={styles.rowSub}>
                  {item.team_number ? `#${item.team_number}  ·  ` : ''}
                  {item.player_count} {item.player_count === 1 ? 'player' : 'players'}
                </Text>
              </View>
              <View style={styles.rowRight}>
                {!item.is_active && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>Inactive</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </View>
            </Pressable>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 72,
  },
  rowInactive: {
    opacity: 0.5,
  },
  rowPressed: {
    opacity: 0.8,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  textInactive: {
    color: theme.colors.textSecondary,
  },
  rowSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 32,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
});
