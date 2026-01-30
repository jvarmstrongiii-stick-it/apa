import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../src/constants/theme';

type GameFormat = '8-ball' | '9-ball';

const GAME_FORMATS: { label: string; value: GameFormat }[] = [
  { label: '8-Ball', value: '8-ball' },
  { label: '9-Ball', value: '9-ball' },
];

const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];

export default function CreateLeagueScreen() {
  const [name, setName] = useState('');
  const [gameFormat, setGameFormat] = useState<GameFormat>('8-ball');
  const [season, setSeason] = useState('Spring');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a league name.');
      return;
    }

    if (!year.trim() || isNaN(parseInt(year))) {
      Alert.alert('Validation Error', 'Please enter a valid year.');
      return;
    }

    setIsSaving(true);
    try {
      // TODO: Create league via API
      await new Promise((resolve) => setTimeout(resolve, 500));

      Alert.alert('Success', 'League created successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to create league. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

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
        <Text style={styles.headerTitle}>Create League</Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* League Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>League Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Monday 8-Ball"
              placeholderTextColor={theme.colors.textSecondary}
              autoFocus
              editable={!isSaving}
            />
          </View>

          {/* Game Format Picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Game Format</Text>
            <View style={styles.segmentedControl}>
              {GAME_FORMATS.map((format) => (
                <Pressable
                  key={format.value}
                  style={[
                    styles.segmentOption,
                    gameFormat === format.value && styles.segmentOptionActive,
                  ]}
                  onPress={() => setGameFormat(format.value)}
                  disabled={isSaving}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      gameFormat === format.value && styles.segmentTextActive,
                    ]}
                  >
                    {format.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Season Picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Season</Text>
            <View style={styles.seasonGrid}>
              {SEASONS.map((s) => (
                <Pressable
                  key={s}
                  style={[
                    styles.seasonOption,
                    season === s && styles.seasonOptionActive,
                  ]}
                  onPress={() => setSeason(s)}
                  disabled={isSaving}
                >
                  <Text
                    style={[
                      styles.seasonText,
                      season === s && styles.seasonTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Year */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Year</Text>
            <TextInput
              style={styles.input}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              placeholder="2026"
              placeholderTextColor={theme.colors.textSecondary}
              maxLength={4}
              editable={!isSaving}
            />
          </View>

          {/* Save Button */}
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.buttonPressed,
              isSaving && styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Create League</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
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
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 48,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  segmentOptionActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  seasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  seasonOption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  seasonOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  seasonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  seasonTextActive: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 56,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
