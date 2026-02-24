import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
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
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../../../../src/constants/theme';
import { supabase } from '../../../../src/lib/supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../../src/constants/config';
import { useAuthContext } from '../../../../src/providers/AuthProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportStatus = 'processing' | 'completed' | 'failed' | 'partial';

interface ImportRecord {
  id: string;
  filename: string;
  uploaded_at: string;
  status: ImportStatus;
  total_rows: number;
  success_count: number;
  error_count: number;
}

interface LeagueOption {
  id: string;
  name: string;
  season: string;
  year: number;
  game_format: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<ImportStatus, string> = {
  processing: '#FF9800',
  completed:  '#4CAF50',
  failed:     '#F44336',
  partial:    '#2196F3',
};

const STATUS_LABELS: Record<ImportStatus, string> = {
  processing: 'Processing',
  completed:  'Completed',
  failed:     'Failed',
  partial:    'Partial',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ImportItem({ item }: { item: ImportRecord }) {
  const uploadDate = new Date(item.uploaded_at);
  return (
    <Pressable
      style={({ pressed }) => [styles.importItem, pressed && styles.itemPressed]}
      onPress={() => router.push(`/(admin)/(tabs)/import/${item.id}`)}
    >
      <View style={styles.importHeader}>
        <View style={styles.fileInfo}>
          <Ionicons name="document-outline" size={20} color={theme.colors.textSecondary} />
          <Text style={styles.filename} numberOfLines={1}>{item.filename}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
            {STATUS_LABELS[item.status]}
          </Text>
        </View>
      </View>

      <View style={styles.importStats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.total_rows}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>{item.success_count}</Text>
          <Text style={styles.statLabel}>Success</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: item.error_count > 0 ? '#F44336' : theme.colors.textSecondary }]}>
            {item.error_count}
          </Text>
          <Text style={styles.statLabel}>Errors</Text>
        </View>
      </View>

      <Text style={styles.uploadDate}>
        Uploaded{' '}
        {uploadDate.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })}
      </Text>
    </Pressable>
  );
}

interface LeaguePickerProps {
  leagues: LeagueOption[];
  selected: LeagueOption | null;
  onSelect: (league: LeagueOption) => void;
}

function LeaguePicker({ leagues, selected, onSelect }: LeaguePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.leaguePicker, pressed && styles.itemPressed]}
        onPress={() => setOpen(true)}
      >
        <Ionicons name="trophy-outline" size={20} color={theme.colors.primary} />
        <Text style={[styles.leaguePickerText, !selected && styles.leaguePickerPlaceholder]} numberOfLines={1}>
          {selected ? `${selected.name} — ${selected.season} ${selected.year}` : 'Select a league…'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select League</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {leagues.map((league) => (
                <Pressable
                  key={league.id}
                  style={({ pressed }) => [
                    styles.leagueOption,
                    pressed && styles.itemPressed,
                    selected?.id === league.id && styles.leagueOptionSelected,
                  ]}
                  onPress={() => { onSelect(league); setOpen(false); }}
                >
                  <Text style={styles.leagueOptionName}>{league.name}</Text>
                  <Text style={styles.leagueOptionMeta}>
                    {league.game_format === 'eight_ball' ? '8-Ball' : '9-Ball'} · {league.season} {league.year}
                  </Text>
                  {selected?.id === league.id && (
                    <Ionicons name="checkmark" size={20} color={theme.colors.primary} style={styles.checkmark} />
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

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AdminImportIndex() {
  const { user } = useAuthContext();
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<LeagueOption | null>(null);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchLeagues = useCallback(async () => {
    const { data, error } = await supabase
      .from('leagues')
      .select('id, name, season, year, game_format')
      .eq('is_active', true)
      .order('year', { ascending: false })
      .order('name');

    if (error) {
      console.error('Failed to fetch leagues:', error.message);
      return;
    }

    const mapped: LeagueOption[] = (data ?? []).map((l: any) => ({
      id: l.id,
      name: l.name,
      season: l.season,
      year: l.year,
      game_format: l.game_format,
    }));

    setLeagues(mapped);
    if (mapped.length === 1 && !selectedLeague) {
      setSelectedLeague(mapped[0]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchImports = useCallback(async () => {
    const { data, error } = await supabase
      .from('imports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to fetch imports:', error.message);
      return;
    }

    const mapped: ImportRecord[] = (data ?? []).map((i: any) => ({
      id: i.id,
      filename: i.file_name,
      uploaded_at: i.created_at,
      status:
        i.status === 'completed' && (i.error_rows ?? 0) > 0 ? 'partial' : i.status,
      total_rows:    i.total_rows     ?? 0,
      success_count: i.processed_rows ?? 0,
      error_count:   i.error_rows     ?? 0,
    }));
    setImports(mapped);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeagues();
      fetchImports();
    }, [fetchLeagues, fetchImports]),
  );

  // ------------------------------------------------------------------
  // Upload flow
  // ------------------------------------------------------------------

  const handleSelectDocument = async () => {
    if (!selectedLeague) {
      Alert.alert('Select a League', 'Please select a league before uploading.');
      return;
    }

    let result;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
    } catch {
      Alert.alert('Error', 'Failed to open file picker.');
      return;
    }

    if (result.canceled || !result.assets?.length) return;

    const file = result.assets[0];

    setIsUploading(true);
    try {
      // Step 1: Create the import record
      setUploadStep('Creating import record…');
      const { data: importRecord, error: importError } = await supabase
        .from('imports')
        .insert({
          uploaded_by: user!.id,
          file_name:   file.name,
          file_type:   'pdf',
          status:      'pending',
        })
        .select('id')
        .single();

      if (importError || !importRecord) {
        throw new Error(importError?.message ?? 'Failed to create import record');
      }

      const importId = importRecord.id;

      // Step 2: Upload PDF to Supabase Storage
      setUploadStep('Uploading file…');
      const storagePath = `${importId}/${file.name}`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('', { uri: file.uri, name: file.name, type: 'application/pdf' } as any);

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/imports/${storagePath}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: formData,
        },
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Storage upload failed: ${errText}`);
      }

      // Step 3: Call the parse-pdf Edge Function
      setUploadStep('Parsing PDF…');
      const { data: fnResult, error: fnError } = await supabase.functions.invoke('parse-pdf', {
        body: { importId, storagePath, leagueId: selectedLeague.id },
      });

      if (fnError) {
        throw new Error(`Parse failed: ${fnError.message}`);
      }

      if (!fnResult?.success) {
        throw new Error(fnResult?.error ?? 'Parse returned no results');
      }

      const { totalRows, processedRows, errorRows } = fnResult;
      const msg =
        errorRows > 0
          ? `Imported ${processedRows} of ${totalRows} rows. ${errorRows} row(s) had errors.`
          : `Successfully imported ${processedRows} player row(s).`;

      Alert.alert('Import Complete', msg);
      fetchImports();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Import Failed', message);
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Import</Text>
      </View>

      {/* League selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>League</Text>
        {leagues.length === 0 ? (
          <Pressable
            style={styles.noLeagueRow}
            onPress={() => router.push('/(admin)/(tabs)/leagues/create')}
          >
            <Ionicons name="alert-circle-outline" size={18} color="#FF9800" />
            <Text style={styles.noLeagueText}>No active leagues — tap to create one first</Text>
          </Pressable>
        ) : (
          <LeaguePicker
            leagues={leagues}
            selected={selectedLeague}
            onSelect={setSelectedLeague}
          />
        )}
      </View>

      {/* Upload button */}
      <View style={styles.section}>
        <Pressable
          style={({ pressed }) => [
            styles.uploadButton,
            pressed && !isUploading && styles.buttonPressed,
            isUploading && styles.uploadButtonDisabled,
            !selectedLeague && styles.uploadButtonDimmed,
          ]}
          onPress={handleSelectDocument}
          disabled={isUploading}
        >
          {isUploading ? (
            <View style={styles.uploadingContent}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.uploadingText}>{uploadStep}</Text>
            </View>
          ) : (
            <>
              <Ionicons
                name="cloud-upload-outline"
                size={40}
                color={selectedLeague ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={[styles.uploadTitle, !selectedLeague && styles.dimmedText]}>
                Upload PDF
              </Text>
              <Text style={styles.uploadSubtitle}>
                {selectedLeague
                  ? 'Tap to select an "Apa match data" PDF'
                  : 'Select a league above first'}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Recent imports */}
      <Text style={styles.listHeader}>Recent Imports</Text>

      <FlatList
        data={imports}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ImportItem item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-upload-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No imports yet</Text>
          </View>
        }
      />
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // League picker
  leaguePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    minHeight: 52,
  },
  leaguePickerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  leaguePickerPlaceholder: {
    color: theme.colors.textSecondary,
    fontWeight: '400',
  },
  noLeagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF980015',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FF980040',
  },
  noLeagueText: {
    flex: 1,
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
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
  leagueOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  leagueOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '15',
  },
  leagueOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  leagueOptionMeta: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  checkmark: {
    position: 'absolute',
    right: 14,
    top: '50%',
  },

  // Upload button
  uploadButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
    minHeight: 140,
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
    borderColor: theme.colors.primary,
  },
  uploadButtonDisabled: {
    borderStyle: 'solid',
  },
  uploadButtonDimmed: {
    opacity: 0.6,
  },
  uploadTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  dimmedText: {
    color: theme.colors.textSecondary,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  uploadingContent: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  uploadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },

  // Recent imports list
  listHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  importItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemPressed: {
    opacity: 0.8,
  },
  importHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  filename: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
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
  importStats: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  uploadDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
