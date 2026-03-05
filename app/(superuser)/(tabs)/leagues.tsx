import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../src/constants/theme';
import { supabase } from '../../../src/lib/supabase/client';
import type { GameFormat } from '../../../src/lib/supabase/types';

interface League {
  id: string;
  name: string;
  game_format: GameFormat;
  season: string;
  year: number;
  is_active: boolean;
}

const FORMAT_OPTIONS: { label: string; value: GameFormat }[] = [
  { label: '8-Ball', value: 'eight_ball' },
  { label: '9-Ball', value: 'nine_ball' },
  { label: 'Both', value: 'both' },
];

const SEASON_OPTIONS = ['Spring', 'Summer', 'Fall', 'Winter'];

const FORMAT_LABELS: Record<GameFormat, string> = {
  eight_ball: '8-Ball',
  nine_ball: '9-Ball',
  both: 'Both',
};

const FORMAT_COLORS: Record<GameFormat, string> = {
  eight_ball: '#2196F3',
  nine_ball: '#FF9800',
  both: '#9C27B0',
};

export default function SuperuserLeaguesScreen() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [leagueName, setLeagueName] = useState('');
  const [gameFormat, setGameFormat] = useState<GameFormat>('eight_ball');
  const [season, setSeason] = useState('Spring');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [setAsActive, setSetAsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchLeagues();
    }, [])
  );

  const fetchLeagues = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('id, name, game_format, season, year, is_active')
        .order('year', { ascending: false })
        .order('season');

      if (error) throw error;
      setLeagues((data ?? []) as League[]);
    } catch (err) {
      console.error('[Leagues] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setLeagueName('');
    setGameFormat('eight_ball');
    setSeason('Spring');
    setYear(String(new Date().getFullYear()));
    setSetAsActive(true);
    setSaving(false);
  };

  const handleSave = async () => {
    if (!leagueName.trim()) {
      Alert.alert('Validation', 'League name is required.');
      return;
    }

    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      Alert.alert('Validation', 'Please enter a valid year.');
      return;
    }

    setSaving(true);
    try {
      if (setAsActive) {
        // Deactivate all existing active leagues first
        await supabase.from('leagues').update({ is_active: false }).eq('is_active', true);
      }

      const { error } = await supabase.from('leagues').insert({
        name: leagueName.trim(),
        game_format: gameFormat,
        season,
        year: yearNum,
        is_active: setAsActive,
      });

      if (error) throw error;

      setShowForm(false);
      resetForm();
      fetchLeagues();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to create league.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (league: League) => {
    if (league.is_active) {
      Alert.alert('Deactivate League', `Deactivate "${league.name}"? Teams will no longer see their matches.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('leagues').update({ is_active: false }).eq('id', league.id);
            fetchLeagues();
          },
        },
      ]);
    } else {
      Alert.alert('Set Active', `Set "${league.name}" as the active league? All other leagues will be deactivated.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Active',
          onPress: async () => {
            await supabase.from('leagues').update({ is_active: false }).eq('is_active', true);
            await supabase.from('leagues').update({ is_active: true }).eq('id', league.id);
            fetchLeagues();
          },
        },
      ]);
    }
  };

  const renderLeague = ({ item }: { item: League }) => (
    <View style={styles.leagueCard}>
      <View style={styles.leagueMain}>
        <View style={styles.leagueHeader}>
          <Text style={styles.leagueName}>{item.name}</Text>
          {item.is_active && (
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>Active</Text>
            </View>
          )}
        </View>
        <View style={styles.leagueMeta}>
          <View style={[styles.formatBadge, { backgroundColor: FORMAT_COLORS[item.game_format] + '20' }]}>
            <Text style={[styles.formatBadgeText, { color: FORMAT_COLORS[item.game_format] }]}>
              {FORMAT_LABELS[item.game_format]}
            </Text>
          </View>
          <Text style={styles.leagueSubtitle}>{item.season} {item.year}</Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [styles.activeToggle, pressed && { opacity: 0.7 }]}
        onPress={() => handleToggleActive(item)}
        hitSlop={8}
      >
        <Ionicons
          name={item.is_active ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={item.is_active ? '#4CAF50' : theme.colors.textSecondary}
        />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.screenTitle}>Leagues</Text>
        <Pressable
          style={({ pressed }) => [styles.newButton, pressed && { opacity: 0.8 }]}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.newButtonText}>New</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={(item) => item.id}
          renderItem={renderLeague}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>No leagues yet</Text>
              <Text style={styles.emptySubtext}>Tap "New" to create the first league</Text>
            </View>
          }
        />
      )}

      {/* New League Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => { if (!saving) { setShowForm(false); resetForm(); } }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New League</Text>
              <Pressable
                onPress={() => { setShowForm(false); resetForm(); }}
                hitSlop={12}
                disabled={saving}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>League Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={leagueName}
                  onChangeText={setLeagueName}
                  placeholder="e.g. 8-Ball Warminster Tuesday"
                  placeholderTextColor={theme.colors.textSecondary}
                  editable={!saving}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Game Format</Text>
                <View style={styles.segmentRow}>
                  {FORMAT_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[
                        styles.segment,
                        gameFormat === opt.value && styles.segmentActive,
                      ]}
                      onPress={() => setGameFormat(opt.value)}
                      disabled={saving}
                    >
                      <Text style={[
                        styles.segmentText,
                        gameFormat === opt.value && styles.segmentTextActive,
                      ]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Season</Text>
                <View style={styles.segmentRow}>
                  {SEASON_OPTIONS.map((s) => (
                    <Pressable
                      key={s}
                      style={[
                        styles.segment,
                        season === s && styles.segmentActive,
                      ]}
                      onPress={() => setSeason(s)}
                      disabled={saving}
                    >
                      <Text style={[
                        styles.segmentText,
                        season === s && styles.segmentTextActive,
                      ]}>
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Year</Text>
                <TextInput
                  style={[styles.textInput, styles.yearInput]}
                  value={year}
                  onChangeText={setYear}
                  keyboardType="number-pad"
                  maxLength={4}
                  editable={!saving}
                  returnKeyType="done"
                />
              </View>

              <Pressable
                style={styles.toggleRow}
                onPress={() => setSetAsActive(!setAsActive)}
                disabled={saving}
              >
                <View>
                  <Text style={styles.toggleLabel}>Set as Active League</Text>
                  <Text style={styles.toggleSub}>Deactivates all other leagues</Text>
                </View>
                <Ionicons
                  name={setAsActive ? 'checkmark-circle' : 'ellipse-outline'}
                  size={28}
                  color={setAsActive ? '#4CAF50' : theme.colors.textSecondary}
                />
              </Pressable>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && { opacity: 0.85 },
                saving && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Create League</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 40,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  loader: {
    marginTop: 48,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
  },
  leagueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  leagueMain: {
    flex: 1,
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  leagueName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  activePill: {
    backgroundColor: '#4CAF5020',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4CAF50',
  },
  leagueMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formatBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  formatBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  leagueSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  activeToggle: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 64,
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 48,
  },
  yearInput: {
    width: 100,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    minHeight: 40,
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
