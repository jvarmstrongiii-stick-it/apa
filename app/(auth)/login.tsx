import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
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
}

interface MatchOption {
  id: string;
  opponentName: string;
  matchDate: string;
  status: 'scheduled' | 'lineup_set' | 'in_progress';
  isHome: boolean;
  location: string;
  gameFormat: string;
  currentIndividualMatch: number | null;
}

interface StoredPrefs {
  leagueIds: string[];  // active league IDs at time of save — used to detect new season
  teams: TeamOption[];  // teams confirmed on this device during the current season
}

type ListItem =
  | { kind: 'team'; data: TeamOption }
  | { kind: 'header'; label: string };

// ---------------------------------------------------------------------------
// Local storage (per-device, no sensitive data)
// ---------------------------------------------------------------------------

const PREFS_KEY = 'team-prefs';

async function loadPrefs(): Promise<StoredPrefs | null> {
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function savePrefs(prefs: StoredPrefs): Promise<void> {
  await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapMatches(data: any[], teamId: string): MatchOption[] {
  return data.map((m: any) => {
    const isHome = m.home_team_id === teamId;
    const gameFormat = m.division?.league?.game_format === 'nine_ball' ? '9-ball' : '8-ball';
    const indMatches = m.individual_matches ?? [];
    const currentMatch = indMatches.length > 0
      ? Math.max(...indMatches.map((im: any) => im.match_order))
      : null;
    return {
      id: m.id,
      opponentName: isHome ? (m.away_team?.name ?? 'Unknown') : (m.home_team?.name ?? 'Unknown'),
      matchDate: m.match_date,
      status: m.status as MatchOption['status'],
      isHome,
      location: m.division?.location ?? '',
      gameFormat,
      currentIndividualMatch: currentMatch,
    };
  });
}

const MATCH_STATUS_LABELS: Record<MatchOption['status'], string> = {
  scheduled: 'Scheduled',
  lineup_set: 'Lineup Set',
  in_progress: 'In Progress',
};

const MATCH_STATUS_COLORS: Record<MatchOption['status'], string> = {
  scheduled: '#2196F3',
  lineup_set: '#9C27B0',
  in_progress: '#FF9800',
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function LoginScreen() {
  const { signInTeam } = useAuthContext();

  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [myTeams, setMyTeams] = useState<TeamOption[]>([]);
  const [activeLeagueIds, setActiveLeagueIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamOption | null>(null);
  const [step, setStep] = useState<'pick' | 'confirm' | 'match'>('pick');
  const [availableMatches, setAvailableMatches] = useState<MatchOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Fetch teams with scheduled matches + active league IDs (season marker)
  // ------------------------------------------------------------------

  const fetchTeams = useCallback(async () => {
    setIsLoading(true);

    const [matchesResult, leaguesResult] = await Promise.all([
      supabase
        .from('team_matches')
        .select(`
          home_team:teams!home_team_id(id, name, team_number, divisions(name)),
          away_team:teams!away_team_id(id, name, team_number, divisions(name))
        `)
        .eq('status', 'scheduled'),
      supabase
        .from('leagues')
        .select('id')
        .eq('is_active', true),
    ]);

    if (matchesResult.error) {
      setError('Could not load teams. Check your connection.');
      setIsLoading(false);
      return;
    }

    // Current active league IDs — used as the season fingerprint
    const currentLeagueIds = (leaguesResult.data ?? [])
      .map((l: any) => l.id as string)
      .sort();
    setActiveLeagueIds(currentLeagueIds);

    // Validate stored prefs against the current season
    const stored = await loadPrefs();
    if (stored) {
      const storedIds = [...stored.leagueIds].sort();
      const sameSeason =
        storedIds.length === currentLeagueIds.length &&
        storedIds.every((id, i) => id === currentLeagueIds[i]);
      setMyTeams(sameSeason ? stored.teams : []);
    }

    // Deduplicate teams across home/away
    const seen = new Set<string>();
    const all: TeamOption[] = [];

    (matchesResult.data ?? []).forEach((match: any) => {
      for (const side of [match.home_team, match.away_team]) {
        if (side && !seen.has(side.id)) {
          seen.add(side.id);
          all.push({
            id:           side.id,
            name:         side.name ?? '(No Name)',
            teamNumber:   side.team_number ?? '',
            divisionName: side.divisions?.name ?? '',
          });
        }
      }
    });

    all.sort((a, b) => a.name.localeCompare(b.name));
    setTeams(all);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  // ------------------------------------------------------------------
  // Build flat list: "My Teams" section at top, then remaining teams
  // ------------------------------------------------------------------

  const buildPickerItems = useCallback((): ListItem[] => {
    const items: ListItem[] = [];
    const myTeamIds = new Set(myTeams.map((t) => t.id));

    if (myTeams.length > 0) {
      items.push({ kind: 'header', label: 'My Teams' });
      myTeams.forEach((t) => items.push({ kind: 'team', data: t }));
      const rest = teams.filter((t) => !myTeamIds.has(t.id));
      if (rest.length > 0) {
        items.push({ kind: 'header', label: 'All Teams' });
        rest.forEach((t) => items.push({ kind: 'team', data: t }));
      }
    } else {
      teams.forEach((t) => items.push({ kind: 'team', data: t }));
    }

    return items;
  }, [myTeams, teams]);

  // ------------------------------------------------------------------
  // Navigate to a specific match based on its status
  // ------------------------------------------------------------------

  const navigateToMatch = useCallback((match: MatchOption) => {
    switch (match.status) {
      case 'scheduled':
        router.replace(`/(team)/(tabs)/scoring`);
        break;
      case 'lineup_set':
        router.replace(`/(team)/(tabs)/scoring/${match.id}/0`);
        break;
      case 'in_progress':
        router.replace(
          `/(team)/(tabs)/scoring/${match.id}/${match.currentIndividualMatch ?? 0}`
        );
        break;
    }
  }, []);

  // ------------------------------------------------------------------
  // Sign in + persist team + fetch matches
  // ------------------------------------------------------------------

  const handleSignIn = async () => {
    if (!selectedTeam) return;

    setError(null);
    setIsSigningIn(true);

    try {
      await signInTeam(selectedTeam.id);

      // Add to "My Teams" (most-recent first, deduplicated)
      const existing = (await loadPrefs())?.teams ?? [];
      await savePrefs({
        leagueIds: activeLeagueIds,
        teams: [selectedTeam, ...existing.filter((t) => t.id !== selectedTeam.id)],
      });

      // Fetch available matches for this team
      const { data } = await supabase
        .from('team_matches')
        .select(`
          id, match_date, status, home_team_id, away_team_id,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name),
          division:divisions!division_id(location, league:leagues!league_id(game_format)),
          individual_matches(id, match_order)
        `)
        .or(`home_team_id.eq.${selectedTeam.id},away_team_id.eq.${selectedTeam.id}`)
        .in('status', ['scheduled', 'lineup_set', 'in_progress'])
        .order('match_date', { ascending: true });

      const matches = mapMatches(data ?? [], selectedTeam.id);

      if (matches.length === 0) {
        // No active matches — go to dashboard
        router.replace('/');
      } else if (matches.length === 1) {
        // Only one match — go straight to it
        navigateToMatch(matches[0]);
      } else {
        // Multiple matches — let player choose
        setAvailableMatches(matches);
        setStep('match');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Sign in failed. Please contact your League Operator.');
    } finally {
      setIsSigningIn(false);
    }
  };

  // ------------------------------------------------------------------
  // Render picker list item
  // ------------------------------------------------------------------

  const renderPickerItem = ({ item }: { item: ListItem }) => {
    if (item.kind === 'header') {
      return <Text style={styles.sectionHeader}>{item.label}</Text>;
    }

    const { data } = item;
    return (
      <Pressable
        style={({ pressed }) => [
          styles.teamOption,
          pressed && styles.teamOptionPressed,
          selectedTeam?.id === data.id && styles.teamOptionSelected,
        ]}
        onPress={() => {
          setSelectedTeam(data);
          setPickerOpen(false);
          setStep('confirm');
          setError(null);
        }}
      >
        <Text style={styles.teamOptionName}>{data.name}</Text>
        {selectedTeam?.id === data.id && (
          <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
        )}
      </Pressable>
    );
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>APA League</Text>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {step === 'match' && selectedTeam ? (
              /* ----------------------------------------------------------------
               * Match selection step
               * --------------------------------------------------------------- */
              <>
                <Text style={styles.confirmLabel}>You selected</Text>
                <View style={styles.confirmTeamBox}>
                  <Text style={styles.confirmTeamName}>{selectedTeam.name}</Text>
                </View>
                <Text style={styles.matchPickerSubtitle}>
                  Which match would you like to score?
                </Text>

                {availableMatches.map((match) => (
                  <Pressable
                    key={match.id}
                    style={({ pressed }) => [
                      styles.matchCard,
                      pressed && styles.matchCardPressed,
                    ]}
                    onPress={() => navigateToMatch(match)}
                  >
                    <View style={styles.matchCardTop}>
                      <View style={styles.matchFormatBadge}>
                        <Text style={styles.matchFormatText}>{match.gameFormat}</Text>
                      </View>
                      <View
                        style={[
                          styles.matchStatusBadge,
                          { backgroundColor: MATCH_STATUS_COLORS[match.status] + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.matchStatusText,
                            { color: MATCH_STATUS_COLORS[match.status] },
                          ]}
                        >
                          {MATCH_STATUS_LABELS[match.status]}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.matchOpponent}>
                      {match.isHome ? 'vs' : '@'} {match.opponentName}
                    </Text>

                    <View style={styles.matchMetaRow}>
                      <Ionicons name="calendar-outline" size={13} color={theme.colors.textSecondary} />
                      <Text style={styles.matchMetaText}>
                        {new Date(match.matchDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      {match.location ? (
                        <>
                          <Ionicons name="location-outline" size={13} color={theme.colors.textSecondary} />
                          <Text style={styles.matchMetaText}>{match.location}</Text>
                        </>
                      ) : null}
                    </View>

                    <View style={styles.matchGoRow}>
                      <Text style={styles.matchGoText}>Select this match</Text>
                      <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
                    </View>
                  </Pressable>
                ))}

                <Pressable
                  style={styles.changeTeamButton}
                  onPress={() => {
                    setStep('pick');
                    setSelectedTeam(null);
                    setAvailableMatches([]);
                  }}
                >
                  <Text style={styles.changeTeamText}>Change Team</Text>
                </Pressable>
              </>
            ) : step === 'confirm' && selectedTeam ? (
              /* ----------------------------------------------------------------
               * Confirmation step
               * --------------------------------------------------------------- */
              <>
                <Text style={styles.confirmLabel}>You selected</Text>

                <View style={styles.confirmTeamBox}>
                  <Text style={styles.confirmTeamName}>{selectedTeam.name}</Text>
                  <Text style={styles.confirmTeamMeta}>
                    #{selectedTeam.teamNumber}
                    {selectedTeam.divisionName ? `  ·  ${selectedTeam.divisionName}` : ''}
                  </Text>
                </View>

                <Text style={styles.confirmQuestion}>
                  as your current team. Is that correct?
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.signInButton,
                    pressed && !isSigningIn && styles.signInButtonPressed,
                    isSigningIn && styles.signInButtonDisabled,
                  ]}
                  onPress={handleSignIn}
                  disabled={isSigningIn}
                >
                  {isSigningIn ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.signInButtonText}>Yes, Confirm</Text>
                  )}
                </Pressable>

                <Pressable
                  style={styles.changeTeamButton}
                  onPress={() => {
                    setStep('pick');
                    setSelectedTeam(null);
                    setPickerOpen(true);
                  }}
                  disabled={isSigningIn}
                >
                  <Text style={styles.changeTeamText}>Change Team</Text>
                </Pressable>
              </>
            ) : (
              /* ----------------------------------------------------------------
               * Pick step — two clear paths on launch
               * --------------------------------------------------------------- */
              <>
                <Text style={styles.subtitle}>How would you like to continue?</Text>

                {isLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Loading teams…</Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.playerButton,
                      pressed && styles.playerButtonPressed,
                    ]}
                    onPress={() => setPickerOpen(true)}
                  >
                    <Ionicons name="people-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text style={styles.playerButtonText}>Continue as Player</Text>
                  </Pressable>
                )}

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Link href="/(auth)/admin-login" asChild>
                  <Pressable style={({ pressed }) => [
                    styles.adminButton,
                    pressed && styles.adminButtonPressed,
                  ]}>
                    <Ionicons name="shield-outline" size={18} color={theme.colors.textSecondary} style={styles.buttonIcon} />
                    <Text style={styles.adminButtonText}>League Operator Login</Text>
                  </Pressable>
                </Link>
              </>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Team picker modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Your Team</Text>

            <FlatList
              data={buildPickerItems()}
              keyExtractor={(item, index) =>
                item.kind === 'team' ? item.data.id : `header-${index}`
              }
              showsVerticalScrollIndicator={false}
              renderItem={renderPickerItem}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No scheduled matches found.</Text>
              }
            />
          </View>
        </Pressable>
      </Modal>
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
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: theme.colors.error + '15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },

  // Confirmation
  confirmLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmTeamBox: {
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  confirmTeamName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  confirmTeamMeta: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  confirmQuestion: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  signInButtonPressed: {
    opacity: 0.85,
  },
  signInButtonDisabled: {
    opacity: 0.4,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  changeTeamButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  changeTeamText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },

  // Match selection step
  matchPickerSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  matchCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 10,
  },
  matchCardPressed: {
    opacity: 0.8,
    borderColor: theme.colors.primary,
  },
  matchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchFormatBadge: {
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  matchFormatText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  matchStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  matchStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  matchOpponent: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  matchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  matchMetaText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  matchGoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchGoText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },

  // Landing buttons
  playerButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    gap: 8,
  },
  playerButtonPressed: {
    opacity: 0.85,
  },
  playerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonIcon: {
    // nudge icon to sit flush with text baseline
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  adminButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    gap: 8,
    backgroundColor: theme.colors.background,
  },
  adminButtonPressed: {
    opacity: 0.75,
  },
  adminButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '75%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 6,
  },
  teamOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  teamOptionPressed: {
    opacity: 0.75,
  },
  teamOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '15',
  },
  teamOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 14,
    paddingVertical: 24,
  },
});
