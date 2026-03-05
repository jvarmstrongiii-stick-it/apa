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
import { SUPABASE_URL } from '../../../src/constants/config';

interface League {
  id: string;
  name: string;
}

interface LOAccount {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  league_id: string | null;
  league_name: string | null;
  created_at: string;
}

export default function SuperuserAccountsScreen() {
  const [accounts, setAccounts] = useState<LOAccount[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal state
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit modal state
  const [selectedAccount, setSelectedAccount] = useState<LOAccount | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editLeagueId, setEditLeagueId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accountsResult, leaguesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, first_name, last_name, email, league_id, leagues!profiles_league_id_fkey(name), created_at')
          .eq('role', 'lo')
          .order('created_at', { ascending: false }),
        supabase
          .from('leagues')
          .select('id, name')
          .order('name'),
      ]);

      if (accountsResult.error) throw accountsResult.error;
      if (leaguesResult.error) throw leaguesResult.error;

      setLeagues((leaguesResult.data ?? []) as League[]);
      setAccounts(
        (accountsResult.data ?? []).map((row: any) => ({
          id: row.id,
          display_name: row.display_name,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          league_id: row.league_id,
          league_name: row.leagues?.name ?? null,
          created_at: row.created_at,
        }))
      );
    } catch (err) {
      console.error('[Accounts] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setSelectedLeagueId(null);
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Validation', 'First and last name are required.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Validation', 'Email is required.');
      return;
    }
    if (!selectedLeagueId) {
      Alert.alert('Validation', 'Please select a league for this LO.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Validation', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Validation', 'Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-lo-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            leagueId: selectedLeagueId,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error ?? 'Failed to create account');

      setShowForm(false);
      resetCreateForm();
      fetchData();
      Alert.alert('Success', `LO account created for ${firstName} ${lastName}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to create LO account.');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (account: LOAccount) => {
    setSelectedAccount(account);
    setEditFirstName(account.first_name ?? '');
    setEditLastName(account.last_name ?? '');
    setEditLeagueId(account.league_id);
  };

  const closeEditModal = () => {
    if (editSaving) return;
    setSelectedAccount(null);
  };

  const handleSaveEdit = async () => {
    if (!selectedAccount) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      Alert.alert('Validation', 'First and last name are required.');
      return;
    }
    if (!editLeagueId) {
      Alert.alert('Validation', 'Please select a league for this LO.');
      return;
    }

    setEditSaving(true);
    try {
      const displayName = `${editFirstName.trim()} ${editLastName.trim()}`;
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editFirstName.trim(),
          last_name: editLastName.trim(),
          display_name: displayName,
          league_id: editLeagueId,
        })
        .eq('id', selectedAccount.id);

      if (error) throw error;

      setSelectedAccount(null);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedAccount?.email) {
      Alert.alert('Error', 'No email address on file for this account.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(selectedAccount.email);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Sent', `Password reset email sent to ${selectedAccount.email}.`);
    }
  };

  const handleDeleteAccount = () => {
    if (!selectedAccount) return;
    const name = [selectedAccount.first_name, selectedAccount.last_name].filter(Boolean).join(' ') || 'this account';
    Alert.alert(
      'Delete LO Account',
      `Are you sure you want to permanently delete ${name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setEditSaving(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error('Not authenticated');

              const response = await fetch(
                `${SUPABASE_URL}/functions/v1/delete-lo-account`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ profileId: selectedAccount.id }),
                },
              );

              const result = await response.json();
              if (!response.ok || result.error) throw new Error(result.error ?? 'Failed to delete account');

              setSelectedAccount(null);
              fetchData();
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Failed to delete account.');
            } finally {
              setEditSaving(false);
            }
          },
        },
      ]
    );
  };

  const renderAccount = ({ item }: { item: LOAccount }) => {
    const name = [item.first_name, item.last_name].filter(Boolean).join(' ') || item.display_name || 'Unknown';
    const initials = [item.first_name?.[0], item.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?';
    const joinedDate = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
      <Pressable
        style={({ pressed }) => [styles.accountCard, pressed && { opacity: 0.8 }]}
        onPress={() => openEditModal(item)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.accountInfo}>
          <Text style={styles.accountName}>{name}</Text>
          <Text style={styles.accountMeta}>
            {item.league_name ? `${item.league_name}  ·  ` : ''}Added {joinedDate}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <View style={styles.loBadge}>
            <Text style={styles.loBadgeText}>LO</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </View>
      </Pressable>
    );
  };

  const LeaguePicker = ({
    selectedId,
    onSelect,
    disabled,
  }: {
    selectedId: string | null;
    onSelect: (id: string) => void;
    disabled?: boolean;
  }) => (
    <View style={styles.leaguePicker}>
      {leagues.length === 0 ? (
        <Text style={styles.noLeaguesText}>No leagues available. Create a league first.</Text>
      ) : (
        leagues.map((league) => {
          const isSelected = league.id === selectedId;
          return (
            <Pressable
              key={league.id}
              style={({ pressed }) => [
                styles.leagueOption,
                isSelected && styles.leagueOptionSelected,
                pressed && !disabled && { opacity: 0.7 },
              ]}
              onPress={() => !disabled && onSelect(league.id)}
            >
              <Text style={[styles.leagueOptionText, isSelected && styles.leagueOptionTextSelected]}>
                {league.name}
              </Text>
              {isSelected && <Ionicons name="checkmark" size={16} color={theme.colors.primary} />}
            </Pressable>
          );
        })
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.screenTitle}>LO Accounts</Text>
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
          data={accounts}
          keyExtractor={(item) => item.id}
          renderItem={renderAccount}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>No LO accounts yet</Text>
              <Text style={styles.emptySubtext}>Tap "New" to create the first LO</Text>
            </View>
          }
        />
      )}

      {/* New LO Account Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => { if (!saving) { setShowForm(false); resetCreateForm(); } }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New LO Account</Text>
              <Pressable onPress={() => { setShowForm(false); resetCreateForm(); }} hitSlop={12} disabled={saving}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.nameRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>First Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First"
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="words"
                    editable={!saving}
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Last Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last"
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="words"
                    editable={!saving}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="lo@example.com"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!saving}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.textInput, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Min 8 characters"
                    placeholderTextColor={theme.colors.textSecondary}
                    secureTextEntry={!showPassword}
                    editable={!saving}
                    returnKeyType="next"
                  />
                  <Pressable style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={theme.colors.textSecondary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirm Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry={!showPassword}
                  editable={!saving}
                  returnKeyType="done"
                />
              </View>

              <View style={[styles.fieldGroup, { marginBottom: 24 }]}>
                <Text style={styles.fieldLabel}>League (required)</Text>
                <LeaguePicker
                  selectedId={selectedLeagueId}
                  onSelect={setSelectedLeagueId}
                  disabled={saving}
                />
              </View>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && { opacity: 0.85 },
                saving && styles.saveButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Create LO Account</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit LO Account Modal */}
      <Modal
        visible={!!selectedAccount}
        animationType="slide"
        transparent
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit LO Account</Text>
              <Pressable onPress={closeEditModal} hitSlop={12} disabled={editSaving}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {selectedAccount?.email ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <View style={styles.readOnlyField}>
                    <Text style={styles.readOnlyText}>{selectedAccount.email}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.nameRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>First Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editFirstName}
                    onChangeText={setEditFirstName}
                    placeholder="First"
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="words"
                    editable={!editSaving}
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Last Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editLastName}
                    onChangeText={setEditLastName}
                    placeholder="Last"
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="words"
                    editable={!editSaving}
                    returnKeyType="done"
                  />
                </View>
              </View>

              <View style={[styles.fieldGroup, { marginBottom: 24 }]}>
                <Text style={styles.fieldLabel}>League</Text>
                <LeaguePicker
                  selectedId={editLeagueId}
                  onSelect={setEditLeagueId}
                  disabled={editSaving}
                />
              </View>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && { opacity: 0.85 },
                editSaving && styles.saveButtonDisabled,
              ]}
              onPress={handleSaveEdit}
              disabled={editSaving}
            >
              {editSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.resetButton, pressed && { opacity: 0.8 }]}
              onPress={handlePasswordReset}
              disabled={editSaving}
            >
              <Ionicons name="mail-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.resetButtonText}>Send Password Reset Email</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.8 }]}
              onPress={handleDeleteAccount}
              disabled={editSaving}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
              <Text style={styles.deleteButtonText}>Delete Account</Text>
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
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  accountMeta: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loBadge: {
    backgroundColor: '#2196F320',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  loBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2196F3',
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
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldGroup: {
    marginBottom: 16,
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
  readOnlyField: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  eyeButton: {
    height: 48,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: theme.colors.border,
  },
  leaguePicker: {
    gap: 8,
  },
  leagueOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    minHeight: 48,
  },
  leagueOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '15',
  },
  leagueOptionText: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500',
  },
  leagueOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  noLeaguesText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 8,
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
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    minHeight: 48,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.error,
    minHeight: 48,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.error,
  },
});
