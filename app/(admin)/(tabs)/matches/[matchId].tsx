import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { supabase } from '../../../../src/lib/supabase';

type MatchStatus = 'scheduled' | 'lineup_set' | 'in_progress' | 'completed' | 'disputed' | 'finalized';

interface IndividualMatch {
  match_number: number;
  home_player: string;
  away_player: string;
  home_skill: number;
  away_skill: number;
  home_score: number;
  away_score: number;
  winner: 'home' | 'away' | null;
}

interface AuditEntry {
  id: string;
  action: string;
  user_name: string;
  timestamp: string;
  details: string;
}

interface MatchDetail {
  id: string;
  home_team_name: string;
  away_team_name: string;
  scheduled_date: string;
  status: MatchStatus;
  home_total_points: number;
  away_total_points: number;
  league_name: string;
  division_name: string;
  individual_matches: IndividualMatch[];
  audit_log: AuditEntry[];
  dispute_reason: string | null;
}

const STATUS_COLORS: Record<MatchStatus, string> = {
  scheduled: '#2196F3',
  lineup_set: '#9C27B0',
  in_progress: '#FF9800',
  completed: '#4CAF50',
  disputed: '#F44336',
  finalized: '#607D8B',
};

const STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Scheduled',
  lineup_set: 'Lineup Set',
  in_progress: 'In Progress',
  completed: 'Completed',
  disputed: 'Disputed',
  finalized: 'Finalized',
};

export default function AdminMatchDetail() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [matchNotStarted, setMatchNotStarted] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [isReopening, setIsReopening] = useState(false);

  useEffect(() => {
    fetchMatchDetail();
  }, [matchId]);

  const fetchMatchDetail = async () => {
    setIsLoading(true);
    try {
      const [matchResult, auditResult] = await Promise.all([
        supabase
          .from('team_matches')
          .select(`
            *,
            home_team:teams!home_team_id(name),
            away_team:teams!away_team_id(name),
            division:divisions!division_id(name, league:leagues!league_id(name)),
            individual_matches(*, home_player:players!home_player_id(first_name, last_name, skill_level), away_player:players!away_player_id(first_name, last_name, skill_level)),
            disputes(reason, status)
          `)
          .eq('id', matchId!)
          .single(),
        supabase
          .from('audit_log')
          .select('*, profile:profiles!user_id(display_name)')
          .eq('table_name', 'team_matches')
          .eq('record_id', matchId!)
          .order('created_at', { ascending: true }),
      ]);

      if (matchResult.error) throw matchResult.error;
      const data = matchResult.data;

      const individualMatches: IndividualMatch[] = (data.individual_matches ?? [])
        .sort((a: any, b: any) => a.match_order - b.match_order)
        .map((im: any) => ({
          match_number: im.match_order,
          home_player: `${im.home_player?.first_name ?? ''} ${(im.home_player?.last_name ?? '').charAt(0)}.`.trim(),
          away_player: `${im.away_player?.first_name ?? ''} ${(im.away_player?.last_name ?? '').charAt(0)}.`.trim(),
          home_skill: im.home_skill_level,
          away_skill: im.away_skill_level,
          home_score: im.home_points_earned ?? 0,
          away_score: im.away_points_earned ?? 0,
          winner: im.winner_player_id === im.home_player_id ? 'home' as const : im.winner_player_id === im.away_player_id ? 'away' as const : null,
        }));

      const auditLog: AuditEntry[] = (auditResult.data ?? [])
        .map((entry: any) => ({
          id: entry.id,
          action: entry.action,
          user_name: entry.profile?.display_name ?? 'System',
          timestamp: entry.created_at,
          details: entry.new_data ? JSON.stringify(entry.new_data) : entry.action,
        }));

      const openDispute = (data.disputes ?? []).find((d: any) => d.status !== 'resolved' && d.status !== 'dismissed');

      const matchDetail: MatchDetail = {
        id: data.id,
        home_team_name: data.home_team?.name ?? 'Unknown',
        away_team_name: data.away_team?.name ?? 'Unknown',
        scheduled_date: data.match_date,
        status: data.status as MatchStatus,
        home_total_points: data.home_score ?? 0,
        away_total_points: data.away_score ?? 0,
        league_name: data.division?.league?.name ?? '',
        division_name: data.division?.name ?? '',
        individual_matches: individualMatches,
        audit_log: auditLog,
        dispute_reason: openDispute?.reason ?? null,
      };

      setMatch(matchDetail);
    } catch {
      // Main fetch failed — check status without the heavy joins
      const { data: statusRow } = await supabase
        .from('team_matches')
        .select('status')
        .eq('id', matchId!)
        .maybeSingle();

      if (statusRow?.status === 'scheduled') {
        setMatchNotStarted(true);
      }
      // If statusRow is null the match truly doesn't exist — show "Match not found"
    } finally {
      setIsLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      Alert.alert('Required', 'Please enter a reason for reopening this match.');
      return;
    }

    setIsReopening(true);
    try {
      const { error } = await supabase
        .from('team_matches')
        .update({ status: 'in_progress', finalized_by: null, finalized_at: null })
        .eq('id', match!.id);

      if (error) throw error;

      setMatch((prev) => (prev ? { ...prev, status: 'in_progress' } : prev));
      setShowReopenModal(false);
      setReopenReason('');
      Alert.alert('Success', 'Match has been reopened.');
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to reopen match.');
    } finally {
      setIsReopening(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centeredContainer}>
          <Text style={styles.errorText}>
            {matchNotStarted ? 'Match not yet started' : 'Match not found'}
          </Text>
          <Pressable style={styles.goBackButton} onPress={() => router.back()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const matchDate = new Date(match.scheduled_date);

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
        <Text style={styles.headerTitle}>Match Detail</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Match Overview */}
        <View style={styles.overviewCard}>
          <Text style={styles.leagueLabel}>{match.league_name} - {match.division_name}</Text>

          <View style={styles.teamsScoreRow}>
            <View style={styles.teamColumn}>
              <Text style={styles.teamName}>{match.home_team_name}</Text>
              <Text style={styles.teamSubLabel}>Home</Text>
            </View>
            <View style={styles.scoreColumn}>
              <Text style={styles.bigScore}>
                {match.home_total_points} - {match.away_total_points}
              </Text>
            </View>
            <View style={[styles.teamColumn, styles.teamColumnRight]}>
              <Text style={[styles.teamName, styles.textRight]}>{match.away_team_name}</Text>
              <Text style={[styles.teamSubLabel, styles.textRight]}>Away</Text>
            </View>
          </View>

          <View style={styles.overviewFooter}>
            <Text style={styles.dateLabel}>
              {matchDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: STATUS_COLORS[match.status] + '20' },
              ]}
            >
              <Text style={[styles.statusText, { color: STATUS_COLORS[match.status] }]}>
                {STATUS_LABELS[match.status]}
              </Text>
            </View>
          </View>
        </View>

        {/* Dispute Info */}
        {match.dispute_reason && (
          <View style={styles.disputeCard}>
            <View style={styles.disputeHeader}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
              <Text style={styles.disputeTitle}>Dispute</Text>
            </View>
            <Text style={styles.disputeReason}>{match.dispute_reason}</Text>
          </View>
        )}

        {/* Reopen Button */}
        {(match.status === 'finalized' || match.status === 'completed') && (
          <Pressable
            style={({ pressed }) => [
              styles.reopenButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setShowReopenModal(true)}
          >
            <Ionicons name="refresh" size={20} color="#FF9800" />
            <Text style={styles.reopenButtonText}>Reopen Match</Text>
          </Pressable>
        )}

        {/* Individual Matches */}
        <Text style={styles.sectionTitle}>Individual Matches</Text>
        <View style={styles.section}>
          {match.individual_matches.map((im, index) => (
            <View
              key={im.match_number}
              style={[
                styles.individualMatch,
                index === match.individual_matches.length - 1 && styles.lastRow,
              ]}
            >
              <View style={styles.matchNumberBadge}>
                <Text style={styles.matchNumber}>{im.match_number}</Text>
              </View>
              <View style={styles.individualMatchContent}>
                <View style={styles.playerRow}>
                  <View style={styles.playerInfo}>
                    <Text
                      style={[
                        styles.playerName,
                        im.winner === 'home' && styles.winnerText,
                      ]}
                    >
                      {im.home_player}
                    </Text>
                    <Text style={styles.skillLabel}>SL {im.home_skill}</Text>
                  </View>
                  <Text style={styles.individualScore}>
                    {im.home_score} - {im.away_score}
                  </Text>
                  <View style={[styles.playerInfo, styles.playerInfoRight]}>
                    <Text
                      style={[
                        styles.playerName,
                        styles.textRight,
                        im.winner === 'away' && styles.winnerText,
                      ]}
                    >
                      {im.away_player}
                    </Text>
                    <Text style={[styles.skillLabel, styles.textRight]}>
                      SL {im.away_skill}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Audit Log */}
        <Text style={styles.sectionTitle}>Audit Log</Text>
        <View style={styles.section}>
          {match.audit_log.map((entry, index) => {
            const entryDate = new Date(entry.timestamp);
            return (
              <View
                key={entry.id}
                style={[
                  styles.auditRow,
                  index === match.audit_log.length - 1 && styles.lastRow,
                ]}
              >
                <View style={styles.auditDot} />
                <View style={styles.auditContent}>
                  <Text style={styles.auditAction}>{entry.action}</Text>
                  <Text style={styles.auditDetails}>{entry.details}</Text>
                  <Text style={styles.auditMeta}>
                    {entry.user_name} - {entryDate.toLocaleString()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Reopen Modal */}
      <Modal
        visible={showReopenModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowReopenModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reopen Match</Text>
            <Text style={styles.modalDescription}>
              Enter a reason for reopening this finalized match. This will be logged in the audit trail.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={reopenReason}
              onChangeText={setReopenReason}
              placeholder="Reason for reopening..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isReopening}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowReopenModal(false);
                  setReopenReason('');
                }}
                disabled={isReopening}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalConfirmButton,
                  isReopening && styles.buttonDisabled,
                ]}
                onPress={handleReopen}
                disabled={isReopening}
              >
                {isReopening ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Reopen</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    color: theme.colors.textSecondary,
  },
  goBackButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  goBackText: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  overviewCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  leagueLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  teamsScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamColumn: {
    flex: 1,
  },
  teamColumnRight: {
    alignItems: 'flex-end',
  },
  teamName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  teamSubLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  textRight: {
    textAlign: 'right',
  },
  scoreColumn: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bigScore: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  overviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  dateLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  disputeCard: {
    backgroundColor: theme.colors.error + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.error + '40',
  },
  disputeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  disputeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.error,
  },
  disputeReason: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  reopenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF980015',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FF980040',
    minHeight: 52,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  reopenButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
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
  individualMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  matchNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  individualMatchContent: {
    flex: 1,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerInfo: {
    flex: 1,
  },
  playerInfoRight: {
    alignItems: 'flex-end',
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  winnerText: {
    color: '#4CAF50',
  },
  skillLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  individualScore: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    paddingHorizontal: 12,
  },
  auditRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  auditDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginTop: 6,
  },
  auditContent: {
    flex: 1,
  },
  auditAction: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  auditDetails: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  auditMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 80,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalCancelButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  modalConfirmButton: {
    backgroundColor: '#FF9800',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
