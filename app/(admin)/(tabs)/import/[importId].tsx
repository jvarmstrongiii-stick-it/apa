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

type RowStatus = 'success' | 'error' | 'skipped';

interface ImportRow {
  row_number: number;
  status: RowStatus;
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
      // TODO: Fetch import detail from API using importId
      await new Promise((resolve) => setTimeout(resolve, 300));

      const mockData: ImportDetail = {
        id: importId ?? '1',
        filename: 'spring_2026_rosters.pdf',
        uploaded_at: '2026-01-28T14:30:00Z',
        total_rows: 24,
        success_count: 20,
        error_count: 3,
        skipped_count: 1,
        rows: Array.from({ length: 24 }, (_, i) => {
          const status: RowStatus =
            i < 20 ? 'success' : i < 23 ? 'error' : 'skipped';
          return {
            row_number: i + 1,
            status,
            data_summary:
              status === 'success'
                ? `Player ${i + 1}: John Doe (SL ${Math.floor(Math.random() * 5) + 2})`
                : `Row ${i + 1} data`,
            error_message:
              status === 'error'
                ? 'Duplicate player ID detected. Player already exists in roster.'
                : status === 'skipped'
                  ? 'Row contained no valid data fields.'
                  : null,
          };
        }),
      };

      setImportData(mockData);
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
          <Text style={styles.filenameText} numberOfLines={1}>
            {importData.filename}
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
            { label: 'All', value: 'all' as const },
            { label: 'Success', value: 'success' as const },
            { label: 'Errors', value: 'error' as const },
            { label: 'Skipped', value: 'skipped' as const },
          ] as const
        ).map((filter) => (
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
                <Text style={styles.rowNumber}>Row {item.row_number}</Text>
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
  rowNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
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
