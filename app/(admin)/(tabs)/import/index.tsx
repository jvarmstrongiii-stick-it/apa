import { useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Swipeable } from 'react-native-gesture-handler';
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function formatFilename(raw: string): string {
  return raw
    .replace(/^Scoresheet\s*/i, '')
    .replace(/\.pdf$/i, '')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z\d])\s*vs\s*/gi, '$1 vs ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function ImportItem({ item, onDelete }: { item: ImportRecord; onDelete: () => void }) {
  const uploadDate = new Date(item.uploaded_at);

  const renderRightActions = () => (
    <Pressable style={styles.deleteAction} onPress={onDelete}>
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.deleteActionText}>Delete</Text>
    </Pressable>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <Pressable
        style={({ pressed }) => [styles.importItem, pressed && styles.itemPressed]}
        onPress={() => router.push(`/(admin)/(tabs)/import/${item.id}`)}
      >
        <View style={styles.importHeader}>
          <View style={styles.fileInfo}>
            <Ionicons name="document-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.filename} numberOfLines={2}>
              {formatFilename(item.filename)}
            </Text>
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
    </Swipeable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AdminImportIndex() {
  const { user } = useAuthContext();
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [stagedCount, setStagedCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchImports = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('imports')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

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

  const fetchStagedCount = useCallback(async () => {
    const { count } = await supabase
      .from('team_matches')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'imported');
    setStagedCount(count ?? 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchImports();
      fetchStagedCount();
    }, [fetchImports, fetchStagedCount]),
  );

  const handleDeleteImport = (item: ImportRecord) => {
    Alert.alert(
      'Delete Import',
      `Delete "${formatFilename(item.filename)}"?\n\nThe import record will be removed. Any matches already promoted to Scheduled will not be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Remove any unscheduled matches created by this import
            await supabase
              .from('team_matches')
              .delete()
              .eq('import_id', item.id)
              .eq('status', 'imported');

            const { error } = await supabase
              .from('imports')
              .delete()
              .eq('id', item.id);

            if (error) {
              Alert.alert('Error', 'Failed to delete import record.');
              return;
            }

            // Best-effort storage cleanup
            await supabase.storage
              .from('imports')
              .remove([`${item.id}/${item.filename}`]);

            fetchImports();
            fetchStagedCount();
          },
        },
      ],
    );
  };

  // ------------------------------------------------------------------
  // Upload flow
  // ------------------------------------------------------------------

  const handleCancel = () => {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
    setIsUploading(false);
    setUploadStep('');
    setUploadProgress(null);
    fetchImports(); // refresh so any partial record shows its real status
  };

  const uploadSingleFile = async (
    file: DocumentPicker.DocumentPickerAsset,
    session: { access_token: string },
  ): Promise<{ processedRows: number; errorRows: number }> => {
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

    if (cancelledRef.current) return { processedRows: 0, errorRows: 0 };
    if (importError || !importRecord) {
      throw new Error(importError?.message ?? 'Failed to create import record');
    }

    const importId = importRecord.id;

    // Step 2: Upload PDF to Supabase Storage
    setUploadStep('Uploading file…');
    const storagePath = `${importId}/${file.name}`;

    abortControllerRef.current = new AbortController();
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
        signal: abortControllerRef.current.signal,
      },
    );

    if (cancelledRef.current) return { processedRows: 0, errorRows: 0 };
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Storage upload failed: ${errText}`);
    }

    // Step 3: Call the parse-pdf Edge Function
    setUploadStep('Parsing PDF…');
    const { data: fnResult, error: fnError } = await supabase.functions.invoke('parse-pdf', {
      body: { importId, storagePath },
    });

    if (cancelledRef.current) return { processedRows: 0, errorRows: 0 };
    if (fnError) throw new Error(`Parse failed: ${fnError.message}`);
    if (!fnResult?.success) throw new Error(fnResult?.error ?? 'Parse returned no results');

    return { processedRows: fnResult.processedRows, errorRows: fnResult.errorRows };
  };

  const handleSelectDocument = async () => {
    let result;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: true,
      });
    } catch {
      Alert.alert('Error', 'Failed to open file picker.');
      return;
    }

    if (result.canceled || !result.assets?.length) return;

    const files = result.assets;
    cancelledRef.current = false;
    setIsUploading(true);

    let totalPlayers = 0;
    let totalErrors = 0;
    let matchesImported = 0;
    let previouslyImported = 0;
    const failedFiles: string[] = [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Check which filenames have already been imported
      const { data: existingImports } = await supabase
        .from('imports')
        .select('file_name')
        .in('file_name', files.map(f => f.name));
      const alreadyImported = new Set((existingImports ?? []).map((i: any) => i.file_name));

      for (let i = 0; i < files.length; i++) {
        if (cancelledRef.current) break;

        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });

        if (alreadyImported.has(file.name)) {
          previouslyImported++;
          continue;
        }

        try {
          const { processedRows, errorRows } = await uploadSingleFile(file, session);
          if (!cancelledRef.current) {
            totalPlayers += processedRows;
            totalErrors += errorRows;
            matchesImported++;
          }
        } catch (err: unknown) {
          if (cancelledRef.current) break;
          failedFiles.push(file.name);
          console.error(`Failed to import ${file.name}:`, err);
        }
      }

      if (cancelledRef.current) return;

      fetchImports();
      fetchStagedCount();

      const lines: string[] = [];
      if (matchesImported > 0) {
        lines.push(`${matchesImported} match${matchesImported !== 1 ? 'es' : ''} imported (${totalPlayers} player${totalPlayers !== 1 ? 's' : ''} total).`);
      }
      if (previouslyImported > 0) {
        lines.push(`${previouslyImported} match${previouslyImported !== 1 ? 'es' : ''} previously imported — skipped.`);
      }
      if (totalErrors > 0) {
        lines.push(`${totalErrors} row(s) had errors.`);
      }
      if (failedFiles.length > 0) {
        lines.push(`${failedFiles.length} file(s) failed:\n${failedFiles.map(f => `• ${formatFilename(f)}`).join('\n')}`);
      }
      if (matchesImported > 0) lines.push('Matches are awaiting scheduling.');

      Alert.alert(
        matchesImported > 0 ? 'Import Complete' : 'Import Failed',
        lines.join('\n'),
        matchesImported > 0
          ? [{ text: 'Go to Staging', onPress: () => router.push('/(admin)/(tabs)/import/staging') }]
          : [{ text: 'Return to Import', style: 'cancel' }]
      );
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Import Failed', message);
    } finally {
      if (!cancelledRef.current) {
        setIsUploading(false);
        setUploadStep('');
        setUploadProgress(null);
      }
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

      {/* Upload button */}
      <View style={styles.section}>
        {isUploading ? (
          <View style={[styles.uploadButton, styles.uploadButtonDisabled]}>
            <ActivityIndicator color={theme.colors.primary} />
            {uploadProgress && uploadProgress.total > 1 && (
              <Text style={styles.uploadProgressText}>
                File {uploadProgress.current} of {uploadProgress.total}
              </Text>
            )}
            <Text style={styles.uploadingText}>{uploadStep}</Text>
            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.uploadButton, pressed && styles.buttonPressed]}
            onPress={handleSelectDocument}
          >
            <Ionicons name="cloud-upload-outline" size={40} color={theme.colors.primary} />
            <Text style={styles.uploadTitle}>Upload PDFs</Text>
            <Text style={styles.uploadSubtitle}>Tap to select one or more APA scoresheet PDFs</Text>
          </Pressable>
        )}
      </View>

      {/* Staged matches banner */}
      {stagedCount > 0 && (
        <Pressable
          style={({ pressed }) => [styles.stagedBanner, pressed && styles.itemPressed]}
          onPress={() => router.push('/(admin)/(tabs)/import/staging')}
        >
          <Ionicons name="time-outline" size={20} color="#FF9800" />
          <Text style={styles.stagedBannerText}>
            {stagedCount} match{stagedCount !== 1 ? 'es' : ''} awaiting scheduling
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#FF9800" />
        </Pressable>
      )}

      {/* Recent imports */}
      <Text style={styles.listHeader}>Imports in Last 24 Hours</Text>

      <FlatList
        data={imports}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ImportItem item={item} onDelete={() => handleDeleteImport(item)} />}
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
  uploadTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
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
  uploadProgressText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  uploadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cancelButton: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  cancelButtonPressed: {
    opacity: 0.7,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },

  // Staged matches banner
  stagedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FF980015',
    borderWidth: 1,
    borderColor: '#FF980040',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stagedBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
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
  deleteAction: {
    backgroundColor: '#F44336',
    borderRadius: 14,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 4,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
