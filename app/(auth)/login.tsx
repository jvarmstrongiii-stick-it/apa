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

interface StoredPrefs {
  leagueIds: string[];  // active league IDs at time of save — used to detect new season
  teams: TeamOption[];  // teams confirmed on this device during the current season
}

interface PlayerIdentity {
  playerId: string;
  playerName: string;
  isCaptain: boolean;
}

interface RosterPlayer {
  id: string;
  name: string;
  isCaptain: boolean;
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

function identityKey(teamId: string): string {
  return `player-identity-${teamId}`;
}

async function loadIdentity(teamId: string): Promise<PlayerIdentity | null> {
  try {
    const raw = await SecureStore.getItemAsync(identityKey(teamId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveIdentity(teamId: string, identity: PlayerIdentity): Promise<void> {
  await SecureStore.setItemAsync(identityKey(teamId), JSON.stringify(identity));
}

async function clearIdentity(teamId: string): Promise<void> {
  await SecureStore.deleteItemAsync(identityKey(teamId));
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function LoginScreen() {
  const { signInTeam, refreshProfile } = useAuthContext();

  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [myTeams, setMyTeams] = useState<TeamOption[]>([]);
  const [activeLeagueIds, setActiveLeagueIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamOption | null>(null);
  const [step, setStep] = useState<'pick' | 'confirm' | 'who_are_you'>('pick');
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([]);
  const [storedIdentity, setStoredIdentity] = useState<PlayerIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSettingIdentity, setIsSettingIdentity] = useState(false);
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
        .in('status', ['scheduled', 'lineup_set', 'in_progress']),
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
  // Sign in + persist team + fetch roster → who_are_you step
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

      // Fetch roster and stored identity in parallel
      const [rosterResult, identity] = await Promise.all([
        supabase
          .from('team_players')
          .select('is_captain, player:players!player_id(id, first_name, last_name)')
          .eq('team_id', selectedTeam.id)
          .is('left_at', null),
        loadIdentity(selectedTeam.id),
      ]);

      const roster: RosterPlayer[] = (rosterResult.data ?? [])
        .map((tp: any) => ({
          id: tp.player?.id ?? '',
          name: `${tp.player?.first_name ?? ''} ${tp.player?.last_name ?? ''}`.trim(),
          isCaptain: tp.is_captain,
        }))
        .filter((p: RosterPlayer) => p.id)
        .sort((a: RosterPlayer, b: RosterPlayer) => {
          if (a.isCaptain !== b.isCaptain) return a.isCaptain ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      setRosterPlayers(roster);
      setStoredIdentity(identity);
      setStep('who_are_you');
    } catch (err: any) {
      setError(err?.message ?? 'Sign in failed. Please contact your League Operator.');
    } finally {
      setIsSigningIn(false);
    }
  };

  // ------------------------------------------------------------------
  // Identity confirmed — set on profile, save locally, go to dashboard
  // ------------------------------------------------------------------

  const handleIdentityConfirmed = async (identity: PlayerIdentity) => {
    if (!selectedTeam) return;

    setIsSettingIdentity(true);
    setError(null);

    try {
      await supabase.rpc('set_player_identity', { p_player_id: identity.playerId });
      await saveIdentity(selectedTeam.id, identity);
      await refreshProfile();  // update isCaptain in auth context before navigating
      router.replace('/');
    } catch (err: any) {
      setError('Could not save identity. Please try again.');
      setIsSettingIdentity(false);
    }
  };

  // ------------------------------------------------------------------
  // Render picker list item
  // ------------------------------------------------------------------

  const clearMyTeams = async () => {
    await SecureStore.deleteItemAsync(PREFS_KEY);
    setMyTeams([]);
  };

  const renderPickerItem = ({ item }: { item: ListItem }) => {
    if (item.kind === 'header') {
      return (
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>{item.label}</Text>
          {item.label === 'My Teams' && (
            <Pressable onPress={clearMyTeams} hitSlop={8}>
              <Text style={styles.sectionHeaderClear}>Clear</Text>
            </Pressable>
          )}
        </View>
      );
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

            {step === 'who_are_you' && selectedTeam ? (
              /* ----------------------------------------------------------------
               * Who are you? step
               * If identity is stored: show "Continue as X?" verification.
               * Otherwise: show full roster picker.
               * --------------------------------------------------------------- */
              <>
                {storedIdentity ? (
                  /* Returning user — verify identity */
                  <>
                    <Text style={styles.whoTitle}>Welcome back!</Text>
                    <Text style={styles.whoSubtitle}>Continuing as</Text>

                    <View style={styles.identityBox}>
                      <View style={styles.identityAvatar}>
                        <Text style={styles.identityAvatarText}>
                          {storedIdentity.playerName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.identityName}>{storedIdentity.playerName}</Text>
                        {storedIdentity.isCaptain && (
                          <Text style={styles.identityCaptainLabel}>Captain</Text>
                        )}
                      </View>
                    </View>

                    <Pressable
                      style={({ pressed }) => [
                        styles.signInButton,
                        pressed && !isSettingIdentity && styles.signInButtonPressed,
                        isSettingIdentity && styles.signInButtonDisabled,
                      ]}
                      onPress={() => handleIdentityConfirmed(storedIdentity)}
                      disabled={isSettingIdentity}
                    >
                      {isSettingIdentity ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.signInButtonText}>
                          Yes, that's me
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      style={styles.changeTeamButton}
                      onPress={() => {
                        clearIdentity(selectedTeam.id);
                        setStoredIdentity(null);
                      }}
                      disabled={isSettingIdentity}
                    >
                      <Text style={styles.changeTeamText}>Not me</Text>
                    </Pressable>
                  </>
                ) : (
                  /* First time — full roster picker */
                  <>
                    <Text style={styles.whoTitle}>Which player are you?</Text>
                    <Text style={styles.whoSubtitle}>
                      Select your name from {selectedTeam.name}'s roster
                    </Text>

                    {rosterPlayers.length === 0 ? (
                      <Text style={styles.emptyText}>
                        No roster found. Ask your League Operator to import the scoresheet.
                      </Text>
                    ) : (
                      rosterPlayers.map((player) => (
                        <Pressable
                          key={player.id}
                          style={({ pressed }) => [
                            styles.rosterRow,
                            pressed && styles.rosterRowPressed,
                          ]}
                          onPress={() =>
                            handleIdentityConfirmed({
                              playerId: player.id,
                              playerName: player.name,
                              isCaptain: player.isCaptain,
                            })
                          }
                          disabled={isSettingIdentity}
                        >
                          <View style={styles.rosterAvatar}>
                            <Text style={styles.rosterAvatarText}>
                              {player.name.split(' ').map((n) => n[0]).join('')}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'column' }}>
                            <Text style={styles.rosterPlayerName}>{player.name}</Text>
                            {player.isCaptain && (
                              <View style={[styles.captainBadge, { marginTop: 4, alignSelf: 'flex-start' }]}>
                                <Text style={styles.captainBadgeText}>Captain</Text>
                              </View>
                            )}
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={theme.colors.textSecondary}
                          />
                        </Pressable>
                      ))
                    )}

                    <Pressable
                      style={[styles.changeTeamButton, { marginTop: 20 }]}
                      onPress={() => {
                        setStep('pick');
                        setSelectedTeam(null);
                      }}
                    >
                      <Text style={styles.changeTeamText}>Change Team</Text>
                    </Pressable>
                  </>
                )}
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

  // Who are you step
  whoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  whoSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  identityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 20,
  },
  identityAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  identityName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  identityCaptainLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
    marginTop: 2,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    marginBottom: 8,
  },
  rosterRowPressed: {
    opacity: 0.75,
    borderColor: theme.colors.primary,
  },
  rosterAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  rosterPlayerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  captainBadge: {
    backgroundColor: '#FF980020',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  captainBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF9800',
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  sectionHeaderClear: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
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
