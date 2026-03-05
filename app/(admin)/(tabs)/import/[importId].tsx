import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/constants/theme';
import { supabase } from '../../../../src/lib/supabase';

type RowStatus = 'success' | 'error' | 'skipped';

interface ImportRow {
  row_number: number;
  status: RowStatus;
  team: 'home' | 'away' | null;
  data_summary: string;
  error_message: string | null;
}

interface ImportDetail {
  id: string;
  filename: string;
  uploaded_at: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  skipped_count: number;
  rows: ImportRow[];
}

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

const ROW_STATUS_COLORS: Record<RowStatus, string> = {
  success: '#4CAF50',
  error: '#F44336',
  skipped: '#FF9800',
};

const ROW_STATUS_ICONS: Record<RowStatus, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  skipped: 'remove-circle',
};

export default function ImportResultsScreen() {
  const { importId } = useLocalSearchParams<{ importId: string }>();
  const [importData, setImportData] = useState<ImportDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<RowStatus | 'all'>('all');

  useEffect(() => {
    fetchImportDetail();
  }, [importId]);

  const fetchImportDetail = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('imports')
        .select('*, import_rows(*)')
        .eq('id', importId!)
        .single();

      if (error) throw error;

      const rows: ImportRow[] = (data.import_rows ?? [])
        .sort((a: any, b: any) => a.row_number - b.row_number)
        .map((r: any) => {
          const d = r.raw_data ?? {};
          const parts = [
            d.fullName,
            d.skillLevel != null ? `SL ${d.skillLevel}` : null,
            d.matchesPlayed != null ? `MP ${d.matchesPlayed}` : null,
            d.memberNumber ? `#${d.memberNumber}` : null,
          ].filter(Boolean);
          return {
            row_number: r.row_number,
            status: r.status === 'pending' ? 'skipped' : r.status,
            team: (d.team as 'home' | 'away') ?? null,
            data_summary: parts.length ? parts.join(' · ') : `Row ${r.row_number}`,
            error_message: r.error_message,
          };
        });

      const skippedCount = rows.filter((r) => r.status === 'skipped').length;

      const importDetail: ImportDetail = {
        id: data.id,
        filename: data.file_name,
        uploaded_at: data.created_at,
        total_rows: data.total_rows ?? 0,
        success_count: data.processed_rows ?? 0,
        error_count: data.error_rows ?? 0,
        skipped_count: skippedCount,
        rows,
      };

      setImportData(importDetail);
    } catch (error) {
      console.error('Failed to fetch import detail:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!importData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centeredContainer}>
          <Text style={styles.errorText}>Import record not found</Text>
          <Pressable style={styles.goBackButton} onPress={() => router.back()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const filteredRows =
    filterStatus === 'all'
      ? importData.rows
      : importData.rows.filter((r) => r.status === filterStatus);

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
        <Text style={styles.headerTitle}>Import Results</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryCard}>
        <View style={styles.fileRow}>
          <Ionicons name="document-outline" size={18} color={theme.colors.textSecondary} />
          <Text style={styles.filenameText}>
            {formatFilename(importData.filename)}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{importData.total_rows}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
              {importData.success_count}
            </Text>
            <Text style={styles.statLabel}>Success</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#F44336' }]}>
              {importData.error_count}
            </Text>
            <Text style={styles.statLabel}>Errors</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#FF9800' }]}>
              {importData.skipped_count}
            </Text>
            <Text style={styles.statLabel}>Skipped</Text>
          </View>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(
          [
            { label: 'All', value: 'all' as const, always: true },
            { label: 'Success', value: 'success' as const, always: true },
            { label: 'Errors', value: 'error' as const, always: false },
            { label: 'Skipped', value: 'skipped' as const, always: false },
          ] as const
        )
          .filter((f) => f.always || (f.value === 'error' ? importData.error_count > 0 : importData.skipped_count > 0))
          .map((filter) => (
          <Pressable
            key={filter.value}
            style={[
              styles.filterChip,
              filterStatus === filter.value && styles.filterChipActive,
            ]}
            onPress={() => setFilterStatus(filter.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                filterStatus === filter.value && styles.filterChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Row Results */}
      <FlatList
        data={filteredRows}
        keyExtractor={(item) => String(item.row_number)}
        renderItem={({ item }) => (
          <View style={styles.rowItem}>
            <Ionicons
              name={ROW_STATUS_ICONS[item.status]}
              size={22}
              color={ROW_STATUS_COLORS[item.status]}
            />
            <View style={styles.rowContent}>
              <View style={styles.rowHeader}>
                <View style={styles.rowTitleRow}>
                  <Text style={styles.rowNumber}>Row {item.row_number}</Text>
                  {item.team != null && (
                    <View style={[
                      styles.teamBadge,
                      { backgroundColor: item.team === 'home' ? '#2196F320' : '#FF980020' },
                    ]}>
                      <Text style={[
                        styles.teamBadgeText,
                        { color: item.team === 'home' ? '#2196F3' : '#FF9800' },
                      ]}>
                        {item.team === 'home' ? 'H' : 'A'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.rowStatus,
                    { color: ROW_STATUS_COLORS[item.status] },
                  ]}
                >
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
              <Text style={styles.rowSummary}>{item.data_summary}</Text>
              {item.error_message && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorMessage}>{item.error_message}</Text>
                </View>
              )}
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No rows match the current filter</Text>
          </View>
        }
      />
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
  summaryCard: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  filenameText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 36,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 8,
  },
  rowItem: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
    alignItems: 'flex-start',
  },
  rowContent: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  teamBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  teamBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowSummary: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  errorBox: {
    backgroundColor: theme.colors.error + '15',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: theme.colors.error,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 32,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
});
