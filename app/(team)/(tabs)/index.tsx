import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../src/constants/theme';
import { useAuthContext } from '../../../src/providers/AuthProvider';

export default function TeamDashboard() {
  const { user } = useAuthContext();

  // TODO: Fetch real team data from API
  const teamData = {
    teamName: 'Rack Attack',
    wins: 8,
    losses: 4,
    nextMatch: {
      id: 'match-1',
      opponent: 'Cue Ballers',
      date: '2026-02-03T19:00:00Z',
      location: "Sharkey's Billiards",
      isHome: true,
    },
    seasonRecord: {
      totalPoints: 142,
      pointsAgainst: 98,
      matchesPlayed: 12,
      matchesRemaining: 6,
    },
  };

  const nextMatchDate = teamData.nextMatch
    ? new Date(teamData.nextMatch.date)
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.teamName}>{teamData.teamName}</Text>
          <View style={styles.recordBadge}>
            <Text style={styles.recordText}>
              {teamData.wins}W - {teamData.losses}L
            </Text>
          </View>
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
              onPress={() =>
                router.push(
                  `/(team)/(tabs)/scoring/${teamData.nextMatch.id}/lineup`
                )
              }
            >
              <Ionicons name="create" size={22} color="#FFFFFF" />
              <Text style={styles.scoreMatchButtonText}>Score Match</Text>
            </Pressable>
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
