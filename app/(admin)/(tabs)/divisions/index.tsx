import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/constants/theme';
import { supabase } from '../../../../src/lib/supabase/client';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Division {
  id: string;
  name: string;
  division_number: string | null;
  day_of_week: number | null;
  is_active: boolean;
  team_count: number;
}

export default function DivisionsIndex() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function fetchDivisions() {
        setLoading(true);
        try {
          const { data: league } = await supabase
            .from('leagues')
            .select('id')
            .eq('is_active', true)
            .limit(1)
            .single();

          if (!league) return;

          const { data, error } = await supabase
            .from('divisions')
            .select('id, name, division_number, day_of_week, is_active, teams(id)')
            .eq('league_id', league.id)
            .order('name');

          if (error) throw error;

          if (!cancelled) {
            setDivisions(
              (data ?? []).map((d: any) => ({
                id: d.id,
                name: d.name,
                division_number: d.division_number ?? null,
                day_of_week: d.day_of_week,
                is_active: d.is_active ?? true,
                team_count: Array.isArray(d.teams) ? d.teams.length : 0,
              }))
            );
          }
        } catch (err) {
          console.error('[Divisions] Failed to fetch:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      fetchDivisions();
      return () => { cancelled = true; };
    }, [])
  );

  const active = divisions.filter((d) => d.is_active);
  const inactive = divisions.filter((d) => !d.is_active);
  const sorted = [...active, ...inactive];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Divisions</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No divisions found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                !item.is_active && styles.rowInactive,
                pressed && styles.rowPressed,
              ]}
              onPress={() => router.push(`/(admin)/(tabs)/divisions/${item.id}`)}
            >
              <View style={styles.rowInfo}>
                <View style={styles.nameRow}>
                  {item.division_number ? (
                    <Text style={[styles.divNumber, !item.is_active && styles.textInactive]}>
                      {item.division_number}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.rowName, !item.is_active && styles.textInactive]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </View>
                <Text style={styles.rowSub}>
                  {item.day_of_week != null ? DAYS[item.day_of_week] : 'No day set'}
                  {'  ·  '}
                  {item.team_count} {item.team_count === 1 ? 'team' : 'teams'}
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
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  divNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
    flexShrink: 0,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flexShrink: 1,
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
    paddingTop: 64,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
});
