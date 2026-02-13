import { useState, useCallback } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/constants/theme';
import { supabase } from '../../../../src/lib/supabase';

interface League {
  id: string;
  name: string;
  game_format: string;
  season: string;
  year: number;
  is_active: boolean;
  team_count: number;
}

function LeagueItem({ league }: { league: League }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.leagueItem,
        pressed && styles.itemPressed,
      ]}
      onPress={() => router.push(`/(admin)/(tabs)/leagues/${league.id}`)}
    >
      <View style={styles.leagueHeader}>
        <Text style={styles.leagueName}>{league.name}</Text>
        <View
          style={[
            styles.statusBadge,
            league.is_active ? styles.activeBadge : styles.inactiveBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              league.is_active ? styles.activeText : styles.inactiveText,
            ]}
          >
            {league.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <View style={styles.leagueDetails}>
        <View style={styles.detailRow}>
          <Ionicons
            name="game-controller-outline"
            size={16}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.detailText}>{league.game_format}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.detailText}>
            {league.season} {league.year}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons
            name="people-outline"
            size={16}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.detailText}>{league.team_count} teams</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function AdminLeaguesIndex() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeagues = useCallback(async () => {
    const { data, error } = await supabase
      .from('leagues')
      .select('*, divisions(id)')
      .order('is_active', { ascending: false })
      .order('year', { ascending: false })
      .order('name');

    if (error) {
      console.error('Failed to fetch leagues:', error.message);
      return;
    }

    const mapped: League[] = (data ?? []).map((l: any) => ({
      id: l.id,
      name: l.name,
      game_format: l.game_format,
      season: l.season,
      year: l.year,
      is_active: l.is_active,
      team_count: Array.isArray(l.divisions) ? l.divisions.length : 0,
    }));
    setLeagues(mapped);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeagues();
    }, [fetchLeagues])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchLeagues();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Leagues</Text>
        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push('/(admin)/(tabs)/leagues/create')}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.createButtonText}>New</Text>
        </Pressable>
      </View>

      <FlatList
        data={leagues}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LeagueItem league={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="trophy-outline"
              size={48}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.emptyText}>No leagues found</Text>
            <Text style={styles.emptySubtext}>
              Create your first league to get started.
            </Text>
          </View>
        }
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    minHeight: 48,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  leagueItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemPressed: {
    opacity: 0.8,
  },
  leagueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leagueName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadge: {
    backgroundColor: '#4CAF5020',
  },
  inactiveBadge: {
    backgroundColor: '#9E9E9E20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    color: '#4CAF50',
  },
  inactiveText: {
    color: '#9E9E9E',
  },
  leagueDetails: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 64,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});
