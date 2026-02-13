import { useState, useCallback } from 'react';
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
import { theme } from '../../../../src/constants/theme';
import { supabase } from '../../../../src/lib/supabase';

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

const STATUS_COLORS: Record<ImportStatus, string> = {
  processing: '#FF9800',
  completed: '#4CAF50',
  failed: '#F44336',
  partial: '#2196F3',
};

const STATUS_LABELS: Record<ImportStatus, string> = {
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  partial: 'Partial',
};

function ImportItem({ item }: { item: ImportRecord }) {
  const uploadDate = new Date(item.uploaded_at);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.importItem,
        pressed && styles.itemPressed,
      ]}
      onPress={() => router.push(`/(admin)/(tabs)/import/${item.id}`)}
    >
      <View style={styles.importHeader}>
        <View style={styles.fileInfo}>
          <Ionicons name="document-outline" size={20} color={theme.colors.textSecondary} />
          <Text style={styles.filename} numberOfLines={1}>
            {item.filename}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: STATUS_COLORS[item.status] + '20' },
          ]}
        >
          <Text
            style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}
          >
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
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>
            {item.success_count}
          </Text>
          <Text style={styles.statLabel}>Success</Text>
        </View>
        <View style={styles.stat}>
          <Text
            style={[
              styles.statValue,
              { color: item.error_count > 0 ? '#F44336' : theme.colors.textSecondary },
            ]}
          >
            {item.error_count}
          </Text>
          <Text style={styles.statLabel}>Errors</Text>
        </View>
      </View>

      <Text style={styles.uploadDate}>
        Uploaded {uploadDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </Text>
    </Pressable>
  );
}

export default function AdminImportIndex() {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
      status: i.status === 'completed' && i.error_rows > 0 ? 'partial' : i.status,
      total_rows: i.total_rows ?? 0,
      success_count: i.processed_rows ?? 0,
      error_count: i.error_rows ?? 0,
    }));
    setImports(mapped);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchImports();
    }, [fetchImports])
  );

  const handleSelectDocument = async () => {
    try {
      // TODO: Use expo-document-picker to select a PDF file
      // import * as DocumentPicker from 'expo-document-picker';
      // const result = await DocumentPicker.getDocumentAsync({
      //   type: 'application/pdf',
      //   copyToCacheDirectory: true,
      // });
      // if (result.canceled) return;
      // handleUpload(result.assets[0]);

      // Placeholder: simulate upload
      setIsUploading(true);
      setUploadProgress(0);

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 20;
        });
      }, 500);

      await new Promise((resolve) => setTimeout(resolve, 3000));
      clearInterval(progressInterval);
      setUploadProgress(100);

      // TODO: Process upload response
      Alert.alert('Upload Complete', 'Your file has been uploaded and is being processed.');
    } catch (error) {
      Alert.alert('Upload Error', 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Import</Text>
      </View>

      {/* Upload Section */}
      <View style={styles.uploadSection}>
        <Pressable
          style={({ pressed }) => [
            styles.uploadButton,
            pressed && !isUploading && styles.buttonPressed,
            isUploading && styles.uploadButtonDisabled,
          ]}
          onPress={handleSelectDocument}
          disabled={isUploading}
        >
          {isUploading ? (
            <View style={styles.uploadingContent}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.uploadingText}>
                Uploading... {uploadProgress}%
              </Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[styles.progressBar, { width: `${uploadProgress}%` }]}
                />
              </View>
            </View>
          ) : (
            <>
              <Ionicons
                name="cloud-upload-outline"
                size={48}
                color={theme.colors.primary}
              />
              <Text style={styles.uploadTitle}>Upload PDF</Text>
              <Text style={styles.uploadSubtitle}>
                Select a PDF file to import roster data
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Recent Imports */}
      <Text style={styles.sectionTitle}>Recent Imports</Text>

      <FlatList
        data={imports}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ImportItem item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="cloud-upload-outline"
              size={48}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.emptyText}>No imports yet</Text>
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
  headerBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  uploadSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  uploadButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
    minHeight: 160,
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
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  uploadingContent: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  uploadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  sectionTitle: {
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
