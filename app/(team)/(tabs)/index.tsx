import { useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../src/constants/theme';
import { useAuthContext } from '../../../src/providers/AuthProvider';
import { supabase } from '../../../src/lib/supabase';
import { BroadcastCard, BroadcastThreadMessage } from '../../../src/components/BroadcastCard';

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

interface Broadcast {
  id: string;
  created_at: string;
  body: string;
  type: 'message' | 'poll';
  reply_type: 'none' | 'text' | 'options';
  reply_options: string[] | null;
  audience_type: string | string[];
  audience_ids: string[] | null;
  closed_at: string | null;
  is_archived?: boolean;
  expires_at?: string | null;
}

export default function TeamDashboard() {
  const { profile, isCaptain } = useAuthContext();
  const teamId = profile?.team_id;
  const userId = profile?.id;

  const [teamData, setTeamData] = useState<TeamData>({
    teamName: '',
    wins: 0,
    losses: 0,
    nextMatch: null,
    seasonRecord: { totalPoints: 0, pointsAgainst: 0, matchesPlayed: 0, matchesRemaining: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [broadcastReplies, setBroadcastReplies] = useState<Record<string, string>>({});
  const [broadcastThreads, setBroadcastThreads] = useState<Record<string, BroadcastThreadMessage[]>>({});

  const fetchBroadcasts = useCallback(async () => {
    if (!teamId || !userId) return;
    const [broadcastsRes, repliesRes, dismissalsRes, threadsRes, gameFormatRes] = await Promise.all([
      supabase
        .from('broadcasts')
        .select('id, created_at, body, type, reply_type, reply_options, audience_type, audience_ids, closed_at')
        .order('created_at', { ascending: false }),
      supabase.from('broadcast_replies').select('broadcast_id, body'),
      supabase.from('broadcast_dismissals').select('broadcast_id').eq('user_id', userId),
      supabase
        .from('broadcast_thread_messages')
        .select('id, created_at, broadcast_id, body, is_from_lo, is_read')
        .eq('thread_user_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('team_matches')
        .select('game_format')
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .not('game_format', 'is', null)
        .limit(1)
        .maybeSingle(),
    ]);

    if (broadcastsRes.error) console.error('[Dashboard] broadcasts fetch error:', broadcastsRes.error);

    const teamGameFormat: string | null = (gameFormatRes.data as any)?.game_format ?? null;
    const playerId: string | null = (profile as any)?.player_id ?? null;

    const dismissedIds = new Set((dismissalsRes.data ?? []).map((d: any) => d.broadcast_id));
    const repliedIds = new Set((repliesRes.data ?? []).map((r: any) => r.broadcast_id));
    const replyMap: Record<string, string> = {};
    for (const r of repliesRes.data ?? []) replyMap[(r as any).broadcast_id] = (r as any).body;

    const threadMap: Record<string, BroadcastThreadMessage[]> = {};
    for (const m of (threadsRes.data ?? []) as BroadcastThreadMessage[]) {
      if (!threadMap[m.broadcast_id]) threadMap[m.broadcast_id] = [];
      threadMap[m.broadcast_id].push(m);
    }

    const hasUnreadLoReply = (broadcastId: string) =>
      (threadMap[broadcastId] ?? []).some(m => m.is_from_lo && !m.is_read);

    const matchesAudience = (b: Broadcast): boolean => {
      const audienceTypes = Array.isArray(b.audience_type) ? b.audience_type : [b.audience_type];
      return audienceTypes.every(t => {
        switch (t) {
          case 'all': return true;
          case 'captains_only': return isCaptain;
          case 'eight_ball': return teamGameFormat === 'eight_ball';
          case 'nine_ball': return teamGameFormat === 'nine_ball';
          case 'teams': return (b.audience_ids ?? []).includes(teamId!);
          case 'players': return !!playerId && (b.audience_ids ?? []).includes(playerId);
          case 'masters':
          default: return true;
        }
      });
    };

    const visible = ((broadcastsRes.data ?? []) as Broadcast[]).filter(b => {
      if (dismissedIds.has(b.id)) return false;
      if (repliedIds.has(b.id) && !hasUnreadLoReply(b.id)) return false;
      return matchesAudience(b);
    });

    setBroadcasts(visible);
    setBroadcastReplies(replyMap);
    setBroadcastThreads(threadMap);
  }, [teamId, userId, isCaptain, profile]);

  const fetchDashboard = useCallback(async () => {
    if (!teamId || !userId) { setIsLoading(false); return; }

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

      // Fetch broadcasts separately (extracted for reuse by Realtime handler)
      await fetchBroadcasts();

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
  }, [teamId, userId, isCaptain]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  // Realtime: new broadcasts pushed to this team
  useEffect(() => {
    if (!teamId || !userId) return;
    const channel = supabase
      .channel('team_new_broadcasts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'broadcasts' },
        (payload) => {
          const b = payload.new as Broadcast;
          if (b.is_archived) return;
          if (b.expires_at && new Date(b.expires_at) <= new Date()) return;
          // Apply same intersection audience filter
          const audienceTypes = Array.isArray(b.audience_type) ? b.audience_type : [b.audience_type];
          const playerId: string | null = (profile as any)?.player_id ?? null;
          const passes = audienceTypes.every(t => {
            switch (t) {
              case 'all': return true;
              case 'captains_only': return isCaptain;
              case 'teams': return (b.audience_ids ?? []).includes(teamId);
              case 'players': return !!playerId && (b.audience_ids ?? []).includes(playerId);
              default: return true;
            }
          });
          if (passes) setBroadcasts(prev => [b, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'broadcasts' },
        (payload) => {
          const b = payload.new as Broadcast;
          const isExpired = b.expires_at && new Date(b.expires_at) <= new Date();
          if (b.is_archived || isExpired) {
            setBroadcasts(prev => prev.filter(x => x.id !== b.id));
          }
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [teamId, userId, isCaptain, profile]);

  // Realtime: direct LO thread messages addressed to this user
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`lo_thread_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'broadcast_thread_messages',
          filter: `thread_user_id=eq.${userId}`,
        },
        (payload) => {
          const m = payload.new as BroadcastThreadMessage;
          if (m.is_from_lo) {
            // LO replied — refetch broadcasts so the card reappears if it was hidden
            fetchBroadcasts();
          } else {
            setBroadcastThreads(prev => ({
              ...prev,
              [m.broadcast_id]: [...(prev[m.broadcast_id] ?? []), m],
            }));
          }
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId, fetchBroadcasts]);

  // Broadcast handlers
  const handleBroadcastReply = useCallback(async (broadcastId: string, text: string) => {
    if (!userId || !teamId) return;
    const playerId = (profile as any)?.player_id ?? undefined;
    const { error } = await supabase.from('broadcast_replies').insert({
      broadcast_id: broadcastId,
      user_id: userId,
      team_id: teamId,
      body: text,
      ...(playerId ? { player_id: playerId } : {}),
    });
    if (error) throw error;
    setBroadcasts(prev => prev.filter(b => b.id !== broadcastId));
  }, [userId, teamId, profile]);

  const handleBroadcastDismiss = useCallback((broadcastId: string) => {
    setBroadcasts(prev => prev.filter(b => b.id !== broadcastId));
    supabase.from('broadcast_dismissals')
      .insert({ broadcast_id: broadcastId, user_id: userId })
      .then();
  }, [userId]);

  const handleThreadReply = useCallback(async (broadcastId: string, text: string) => {
    if (!userId || !teamId) return;
    const { error } = await supabase.from('broadcast_thread_messages').insert({
      broadcast_id: broadcastId,
      thread_user_id: userId,
      thread_team_id: teamId,
      sender_id: userId,
      is_from_lo: false,
      body: text,
    });
    if (error) throw error;
    // Realtime subscription delivers the message
  }, [userId, teamId]);

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

            {/* Score Match Button — navigates both teams to coin flip screen */}
            <Pressable
              style={({ pressed }) => [
                styles.scoreMatchButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                const match = teamData.nextMatch;
                if (!match) return;
                if (match.status === 'in_progress') {
                  router.push(`/(team)/(tabs)/scoring/${match.id}/progress`);
                } else {
                  router.push(`/(team)/(tabs)/scoring/${match.id}/first-match-check`);
                }
              }}
            >
              <Ionicons name="create" size={22} color="#FFFFFF" />
              <Text style={styles.scoreMatchButtonText}>
                {teamData.nextMatch?.status === 'in_progress' ? 'Continue Scoring' : 'Score Match'}
              </Text>
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

        {/* League Broadcasts & Polls */}
        {broadcasts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>League Updates</Text>
            {broadcasts.map(b => (
              <BroadcastCard
                key={b.id}
                broadcast={b}
                existingReply={broadcastReplies[b.id] ?? null}
                threadMessages={broadcastThreads[b.id] ?? []}
                userId={userId!}
                teamId={teamId!}
                onReply={handleBroadcastReply}
                onDismiss={handleBroadcastDismiss}
                onThreadReply={handleThreadReply}
              />
            ))}
          </>
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
