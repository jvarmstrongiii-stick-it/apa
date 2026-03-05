import { useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../src/constants/theme';
import { useAuthContext } from '../../../src/providers/AuthProvider';
import { supabase } from '../../../src/lib/supabase';
import { CoinFlipModal, CoinFlipResult } from '../../../src/components/CoinFlipModal';

interface TeamData {
  teamName: string;
  wins: number;
  losses: number;
  nextMatch: {
    id: string;
    status: string;
    opponent: string;
    date: string;
    location: string;
    isHome: boolean;
  } | null;
  seasonRecord: {
    totalPoints: number;
    pointsAgainst: number;
    matchesPlayed: number;
    matchesRemaining: number;
  };
}

export default function TeamDashboard() {
  const { profile } = useAuthContext();
  const teamId = profile?.team_id;

  const [teamData, setTeamData] = useState<TeamData>({
    teamName: '',
    wins: 0,
    losses: 0,
    nextMatch: null,
    seasonRecord: { totalPoints: 0, pointsAgainst: 0, matchesPlayed: 0, matchesRemaining: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [coinFlipVisible, setCoinFlipVisible] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!teamId) { setIsLoading(false); return; }

    try {
      // Fetch team name
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single();

      // Fetch all matches for this team
      const { data: matches } = await supabase
        .from('team_matches')
        .select('id, match_date, status, home_score, away_score, home_team_id, away_team_id, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name), division:divisions!division_id(location)')
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order('match_date', { ascending: true });

      const allMatches = matches ?? [];
      const completedMatches = allMatches.filter((m: any) =>
        m.status === 'completed' || m.status === 'finalized'
      );
      const upcomingMatches = allMatches.filter((m: any) =>
        m.status === 'scheduled' || m.status === 'lineup_set' || m.status === 'in_progress'
      );

      let wins = 0, losses = 0, totalPoints = 0, pointsAgainst = 0;
      for (const m of completedMatches) {
        const isHome = m.home_team_id === teamId;
        const ourScore = isHome ? (m.home_score ?? 0) : (m.away_score ?? 0);
        const theirScore = isHome ? (m.away_score ?? 0) : (m.home_score ?? 0);
        totalPoints += ourScore;
        pointsAgainst += theirScore;
        if (ourScore > theirScore) wins++;
        else if (ourScore < theirScore) losses++;
      }

      let nextMatch: TeamData['nextMatch'] = null;
      if (upcomingMatches.length > 0) {
        const nm: any = upcomingMatches[0];
        const isHome = nm.home_team_id === teamId;
        nextMatch = {
          id: nm.id,
          status: nm.status,
          opponent: isHome ? (nm.away_team?.name ?? 'Unknown') : (nm.home_team?.name ?? 'Unknown'),
          date: nm.match_date,
          location: nm.division?.location ?? '',
          isHome,
        };
      }

      setTeamData({
        teamName: team?.name ?? 'My Team',
        wins,
        losses,
        nextMatch,
        seasonRecord: {
          totalPoints,
          pointsAgainst,
          matchesPlayed: completedMatches.length,
          matchesRemaining: upcomingMatches.length,
        },
      });
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  const nextMatchDate = teamData.nextMatch
    ? new Date(teamData.nextMatch.date)
    : null;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const handleCoinFlipReady = (result: CoinFlipResult) => {
    setCoinFlipVisible(false);
    const match = teamData.nextMatch;
    if (!match) return;

    if (result.firstMatch) {
      const putUpTeam =
        result.ourTeamPutsUpFirst === match.isHome ? 'home' : 'away';
      router.push(
        `/(team)/(tabs)/scoring/${match.id}/putup?matchOrder=1&putUpTeam=${putUpTeam}`
      );
    } else {
      router.push(`/(team)/(tabs)/scoring/${match.id}/resume`);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Log out and return to the login screen?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <CoinFlipModal visible={coinFlipVisible} onReady={handleCoinFlipReady} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.teamName}>{teamData.teamName}</Text>
          {/* W/L hidden until scoresheets include match results — uncomment to restore:
          <View style={styles.recordBadge}>
            <Text style={styles.recordText}>
              {teamData.wins}W - {teamData.losses}L
            </Text>
          </View>
          */}
          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.buttonPressed]}
            onPress={handleLogout}
            hitSlop={12}
          >
            <Ionicons name="log-out-outline" size={26} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        {/* Next Match Card */}
        {teamData.nextMatch && (
          <View style={styles.nextMatchCard}>
            <Text style={styles.cardLabel}>NEXT MATCH</Text>
            <View style={styles.nextMatchContent}>
              <View style={styles.nextMatchInfo}>
                <Text style={styles.opponentName}>
                  vs {teamData.nextMatch.opponent}
                </Text>
                <View style={styles.matchDetailRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.matchDetailText}>
                    {nextMatchDate?.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.matchDetailRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.matchDetailText}>
                    {nextMatchDate?.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.matchDetailRow}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.matchDetailText}>
                    {teamData.nextMatch.location}
                  </Text>
                </View>
                <View style={styles.matchDetailRow}>
                  <Ionicons
                    name="flag-outline"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.matchDetailText}>
                    {teamData.nextMatch.isHome ? 'Home' : 'Away'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Score Match Button */}
            <Pressable
              style={({ pressed }) => [
                styles.scoreMatchButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setCoinFlipVisible(true)}
            >
              <Ionicons name="create" size={22} color="#FFFFFF" />
              <Text style={styles.scoreMatchButtonText}>Score Match</Text>
            </Pressable>

            {/* Show when multiple upcoming matches exist */}
            {teamData.seasonRecord.matchesRemaining > 1 && (
              <Pressable
                style={({ pressed }) => [
                  styles.pickAnotherButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => router.push('/(team)/(tabs)/scoring')}
              >
                <Ionicons name="swap-horizontal-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.pickAnotherText}>Pick Another Match</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Season Summary */}
        <Text style={styles.sectionTitle}>Season Summary</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {teamData.seasonRecord.matchesPlayed}
            </Text>
            <Text style={styles.statLabel}>Played</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {teamData.seasonRecord.matchesRemaining}
            </Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
              {teamData.seasonRecord.totalPoints}
            </Text>
            <Text style={styles.statLabel}>Points For</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#F44336' }]}>
              {teamData.seasonRecord.pointsAgainst}
            </Text>
            <Text style={styles.statLabel}>Points Against</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/(team)/(tabs)/schedule')}
          >
            <Ionicons name="calendar" size={24} color={theme.colors.primary} />
            <Text style={styles.actionText}>View Schedule</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.textSecondary}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/(team)/(tabs)/roster')}
          >
            <Ionicons name="people" size={24} color={theme.colors.primary} />
            <Text style={styles.actionText}>View Roster</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.textSecondary}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/(team)/(tabs)/history')}
          >
            <Ionicons name="time" size={24} color={theme.colors.primary} />
            <Text style={styles.actionText}>Match History</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.textSecondary}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color={theme.colors.error} />
            <Text style={[styles.actionText, { color: theme.colors.error }]}>Log Out</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.textSecondary}
            />
          </Pressable>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  logoutBtn: {
    padding: 4,
  },
  teamName: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  recordBadge: {
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  recordText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  nextMatchCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 28,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  nextMatchContent: {
    marginBottom: 16,
  },
  nextMatchInfo: {
    gap: 8,
  },
  opponentName: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  matchDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchDetailText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  scoreMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    minHeight: 56,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  scoreMatchButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  pickAnotherText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  actionsContainer: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 14,
    minHeight: 56,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
