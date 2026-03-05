import { useState, useCallback, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/constants/theme';
import { supabase } from '../../../../src/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StagedMatch {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  matchDate: string;       // YYYY-MM-DD
  weekNumber: number;
  divisionId: string;
  divisionName: string;    // "8-BALL Warminster Tuesday Spring 2026 Session"
  divisionNumber: string;  // "435"  (first 3 digits of team number)
  gameFormat: 'eight_ball' | 'nine_ball';
}

interface DivisionOption {
  id: string;
  name: string;
  number: string;
  label: string; // "Division: 8-BALL Warminster Tuesday 435"
}

// Three-tier filter: all → format → specific division
type DivFilter =
  | { kind: 'all' }
  | { kind: 'format'; format: 'eight_ball' | 'nine_ball' }
  | { kind: 'division'; divisionId: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMatchDate(yyyy_mm_dd: string): string {
  const [y, m, d] = yyyy_mm_dd.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function detectGameFormat(divisionName: string): 'eight_ball' | 'nine_ball' {
  return /9.?ball/i.test(divisionName) ? 'nine_ball' : 'eight_ball';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DivisionPickerProps {
  options: DivisionOption[];
  hasEightBall: boolean;
  hasNineBall: boolean;
  filter: DivFilter;
  onSelect: (f: DivFilter) => void;
}

function filterLabel(filter: DivFilter, options: DivisionOption[]): string {
  if (filter.kind === 'all') return 'All Divisions';
  if (filter.kind === 'format') return filter.format === 'eight_ball' ? '8 Ball Only' : '9 Ball Only';
  const div = options.find((o) => o.id === filter.divisionId);
  return div ? div.label : 'All Divisions';
}

function DivisionPicker({ options, hasEightBall, hasNineBall, filter, onSelect }: DivisionPickerProps) {
  const [open, setOpen] = useState(false);

  const isActive = (f: DivFilter): boolean => {
    if (f.kind !== filter.kind) return false;
    if (f.kind === 'format' && filter.kind === 'format') return f.format === filter.format;
    if (f.kind === 'division' && filter.kind === 'division') return f.divisionId === filter.divisionId;
    return true; // both 'all'
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.divPicker, pressed && styles.itemPressed]}
        onPress={() => setOpen(true)}
      >
        <Ionicons name="layers-outline" size={20} color={theme.colors.primary} />
        <Text style={styles.divPickerText} numberOfLines={1}>{filterLabel(filter, options)}</Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filter by Division</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* All Divisions */}
              <Pressable
                style={({ pressed }) => [
                  styles.divOption,
                  pressed && styles.itemPressed,
                  isActive({ kind: 'all' }) && styles.divOptionSelected,
                ]}
                onPress={() => { onSelect({ kind: 'all' }); setOpen(false); }}
              >
                <Text style={styles.divOptionLabel}>All Divisions</Text>
                {isActive({ kind: 'all' }) && <Ionicons name="checkmark" size={20} color={theme.colors.primary} />}
              </Pressable>

              {/* Format filters */}
              {hasEightBall && (
                <Pressable
                  style={({ pressed }) => [
                    styles.divOption,
                    pressed && styles.itemPressed,
                    isActive({ kind: 'format', format: 'eight_ball' }) && styles.divOptionSelected,
                  ]}
                  onPress={() => { onSelect({ kind: 'format', format: 'eight_ball' }); setOpen(false); }}
                >
                  <Text style={styles.divOptionLabel}>8 Ball Only</Text>
                  {isActive({ kind: 'format', format: 'eight_ball' }) && <Ionicons name="checkmark" size={20} color={theme.colors.primary} />}
                </Pressable>
              )}
              {hasNineBall && (
                <Pressable
                  style={({ pressed }) => [
                    styles.divOption,
                    pressed && styles.itemPressed,
                    isActive({ kind: 'format', format: 'nine_ball' }) && styles.divOptionSelected,
                  ]}
                  onPress={() => { onSelect({ kind: 'format', format: 'nine_ball' }); setOpen(false); }}
                >
                  <Text style={styles.divOptionLabel}>9 Ball Only</Text>
                  {isActive({ kind: 'format', format: 'nine_ball' }) && <Ionicons name="checkmark" size={20} color={theme.colors.primary} />}
                </Pressable>
              )}

              {/* Individual divisions */}
              {options.length > 0 && (
                <Text style={styles.sectionHeader}>By Division</Text>
              )}
              {options.map((div) => (
                <Pressable
                  key={div.id}
                  style={({ pressed }) => [
                    styles.divOption,
                    pressed && styles.itemPressed,
                    isActive({ kind: 'division', divisionId: div.id }) && styles.divOptionSelected,
                  ]}
                  onPress={() => { onSelect({ kind: 'division', divisionId: div.id }); setOpen(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.divOptionLabel}>{div.label}</Text>
                  </View>
                  {isActive({ kind: 'division', divisionId: div.id }) && (
                    <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

interface MatchRowProps {
  match: StagedMatch;
  checked: boolean;
  onToggle: () => void;
}

function MatchRow({ match, checked, onToggle }: MatchRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.matchRow, pressed && styles.itemPressed]}
      onPress={onToggle}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
      <View style={styles.matchInfo}>
        <Text style={styles.matchTeams} numberOfLines={1}>
          {match.homeTeamName}  vs  {match.awayTeamName}
        </Text>
        <Text style={styles.matchMeta}>
          {formatMatchDate(match.matchDate)} · Wk {match.weekNumber} · Div {match.divisionNumber}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function StagingScreen() {
  const [matches, setMatches] = useState<StagedMatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [divFilter, setDivFilter] = useState<DivFilter>({ kind: 'all' });
  const [isPublishing, setIsPublishing] = useState(false);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchStagedMatches = useCallback(async () => {
    const { data, error } = await supabase
      .from('team_matches')
      .select(`
        id, match_date, week_number,
        home_team:teams!home_team_id(name, team_number),
        away_team:teams!away_team_id(name, team_number),
        division:divisions!division_id(id, name)
      `)
      .eq('status', 'imported')
      .order('match_date');

    if (error) {
      console.error('Failed to fetch staged matches:', error.message);
      return;
    }

    const mapped: StagedMatch[] = (data ?? []).map((row: any) => {
      const teamNumber: string = row.home_team?.team_number ?? '';
      const divNumber = teamNumber.length >= 3 ? teamNumber.slice(0, teamNumber.length - 2) : '???';
      const divName: string = row.division?.name ?? '';
      return {
        id:             row.id,
        homeTeamName:   row.home_team?.name ?? 'Home Team',
        awayTeamName:   row.away_team?.name ?? 'Away Team',
        matchDate:      row.match_date,
        weekNumber:     row.week_number,
        divisionId:     row.division?.id ?? '',
        divisionName:   divName,
        divisionNumber: divNumber,
        gameFormat:     detectGameFormat(divName),
      };
    });

    setMatches(mapped);
    // Auto-select all newly loaded matches
    setSelectedIds(new Set(mapped.map((m) => m.id)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStagedMatches();
    }, [fetchStagedMatches]),
  );

  // ------------------------------------------------------------------
  // Derived data
  // ------------------------------------------------------------------

  // Build unique sorted division options from current matches
  const divisionOptions = useMemo((): DivisionOption[] => {
    const seen = new Map<string, DivisionOption>();
    for (const m of matches) {
      if (!seen.has(m.divisionId)) {
        seen.set(m.divisionId, {
          id:     m.divisionId,
          name:   m.divisionName,
          number: m.divisionNumber,
          label:  `Division: ${m.divisionName} ${m.divisionNumber}`,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      Number(a.number) - Number(b.number),
    );
  }, [matches]);

  const hasEightBall = useMemo(() => matches.some((m) => m.gameFormat === 'eight_ball'), [matches]);
  const hasNineBall  = useMemo(() => matches.some((m) => m.gameFormat === 'nine_ball'),  [matches]);

  // Show picker only when there's something meaningful to filter by
  const showPicker = divisionOptions.length > 1 || (hasEightBall && hasNineBall);

  // Apply filter
  const visibleMatches = useMemo(() => {
    if (divFilter.kind === 'all') return matches;
    if (divFilter.kind === 'format') return matches.filter((m) => m.gameFormat === divFilter.format);
    return matches.filter((m) => m.divisionId === divFilter.divisionId);
  }, [matches, divFilter]);

  const allVisible = visibleMatches.length > 0 &&
    visibleMatches.every((m) => selectedIds.has(m.id));

  const anyChecked = visibleMatches.some((m) => selectedIds.has(m.id));

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const toggleAll = () => {
    if (allVisible) {
      // Deselect all visible
      const next = new Set(selectedIds);
      visibleMatches.forEach((m) => next.delete(m.id));
      setSelectedIds(next);
    } else {
      // Select all visible
      const next = new Set(selectedIds);
      visibleMatches.forEach((m) => next.add(m.id));
      setSelectedIds(next);
    }
  };

  const toggleMatch = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleMoveToScheduled = async () => {
    const toSchedule = visibleMatches.filter((m) => selectedIds.has(m.id));
    const toLeave    = visibleMatches.filter((m) => !selectedIds.has(m.id));

    if (toSchedule.length === 0) {
      Alert.alert('Nothing Selected', 'Check at least one match to schedule.');
      return;
    }

    setIsPublishing(true);
    try {
      // Promote selected matches to 'scheduled'
      const { error } = await supabase
        .from('team_matches')
        .update({ status: 'scheduled' })
        .in('id', toSchedule.map((m) => m.id));

      if (error) throw new Error(error.message);

      if (toLeave.length === 0) {
        // All matches scheduled — done
        router.back();
        return;
      }

      // Some matches were not scheduled — ask what to do
      Alert.alert(
        `${toLeave.length} Match${toLeave.length !== 1 ? 'es' : ''} Not Scheduled`,
        'What would you like to do with the remaining match(es)?',
        [
          {
            text: 'Leave as Imported',
            onPress: () => router.back(),
          },
          {
            text: 'Remove Matches',
            style: 'destructive',
            onPress: async () => {
              const { error: delErr } = await supabase
                .from('team_matches')
                .delete()
                .in('id', toLeave.map((m) => m.id));

              if (delErr) {
                Alert.alert('Error', `Failed to remove matches: ${delErr.message}`);
              } else {
                router.back();
              }
            },
          },
        ],
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Error', message);
    } finally {
      setIsPublishing(false);
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Staged Matches</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Division filter */}
      {showPicker && (
        <View style={styles.filterRow}>
          <DivisionPicker
            options={divisionOptions}
            hasEightBall={hasEightBall}
            hasNineBall={hasNineBall}
            filter={divFilter}
            onSelect={setDivFilter}
          />
        </View>
      )}

      {/* Select All row */}
      {visibleMatches.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.selectAllRow, pressed && styles.itemPressed]}
          onPress={toggleAll}
        >
          <View style={[styles.checkbox, allVisible && styles.checkboxChecked]}>
            {allVisible && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={styles.selectAllText}>
            {allVisible ? 'Deselect All' : 'Select All'}
          </Text>
          <Text style={styles.countText}>
            {visibleMatches.filter((m) => selectedIds.has(m.id)).length} / {visibleMatches.length}
          </Text>
        </Pressable>
      )}

      {/* Match list */}
      <FlatList
        data={visibleMatches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MatchRow
            match={item}
            checked={selectedIds.has(item.id)}
            onToggle={() => toggleMatch(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No matches awaiting scheduling</Text>
          </View>
        }
      />

      {/* Move to Scheduled button */}
      {visibleMatches.length > 0 && (
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.scheduleButton,
              (!anyChecked || isPublishing) && styles.scheduleButtonDisabled,
              pressed && anyChecked && !isPublishing && styles.buttonPressed,
            ]}
            onPress={handleMoveToScheduled}
            disabled={!anyChecked || isPublishing}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={anyChecked && !isPublishing ? '#fff' : theme.colors.textSecondary}
            />
            <Text style={[
              styles.scheduleButtonText,
              (!anyChecked || isPublishing) && styles.scheduleButtonTextDisabled,
            ]}>
              {isPublishing ? 'Scheduling…' : 'Move to Scheduled'}
            </Text>
          </Pressable>
        </View>
      )}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  // Division picker
  divPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  divPickerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
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
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 16,
  },
  divOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  divOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '15',
  },
  divOptionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text,
    flex: 1,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 6,
  },

  // Select All row
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  selectAllText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  countText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  // Match rows
  listContent: {
    paddingBottom: 16,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  matchInfo: {
    flex: 1,
  },
  matchTeams: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 3,
  },
  matchMeta: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },

  // Footer button
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
  },
  scheduleButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  scheduleButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  scheduleButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  itemPressed: {
    opacity: 0.7,
  },
});
