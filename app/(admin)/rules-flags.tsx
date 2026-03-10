import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase/client';

type AuditVerdict = 'CONFIRMED' | 'CORRECTED' | 'NUANCE ADDED' | 'ERROR';

interface RulesFlag {
  id: string;
  created_at: string;
  question: string;
  original_answer: string;
  audit_verdict: AuditVerdict;
  proposed_correction: string | null;
  status: 'pending' | 'approved' | 'dismissed';
  // joined
  player_name: string | null;
  team_name: string | null;
}

const VERDICT_COLOR: Record<AuditVerdict, string> = {
  CONFIRMED: '#4a9a4a',
  CORRECTED: '#cc4444',
  'NUANCE ADDED': '#D4AF37',
  ERROR: '#888',
};

const VERDICT_ICON: Record<AuditVerdict, string> = {
  CONFIRMED: '✅',
  CORRECTED: '❌',
  'NUANCE ADDED': '⚠️',
  ERROR: '⚠️',
};

function FlagCard({
  flag,
  onApprove,
  onDismiss,
}: {
  flag: RulesFlag;
  onApprove: (id: string, correction: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(flag.proposed_correction ?? '');

  const verdictColor = VERDICT_COLOR[flag.audit_verdict] ?? '#888';
  const verdictIcon = VERDICT_ICON[flag.audit_verdict] ?? '⚠️';

  const attribution =
    flag.player_name && flag.team_name
      ? `${flag.player_name} from ${flag.team_name}`
      : flag.player_name ?? flag.team_name ?? 'Anonymous';

  return (
    <View style={styles.card}>
      {/* Attribution */}
      <Text style={styles.attribution}>🚩 {attribution}</Text>
      <Text style={styles.timestamp}>
        {new Date(flag.created_at).toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
      </Text>

      {/* Verdict badge */}
      <View style={[styles.verdictBadge, { borderColor: verdictColor, backgroundColor: verdictColor + '18' }]}>
        <Text style={[styles.verdictText, { color: verdictColor }]}>
          {verdictIcon} {flag.audit_verdict}
        </Text>
      </View>

      {/* Q&A */}
      <Text style={styles.sectionLabel}>QUESTION</Text>
      <Text style={styles.questionText}>{flag.question}</Text>

      <Text style={styles.sectionLabel}>ORIGINAL ANSWER</Text>
      <Text style={styles.answerText} numberOfLines={4}>{flag.original_answer}</Text>

      {/* Proposed correction */}
      {flag.proposed_correction ? (
        <>
          <Text style={styles.sectionLabel}>PROPOSED CORRECTION</Text>
          {editing ? (
            <TextInput
              value={editText}
              onChangeText={setEditText}
              multiline
              style={styles.editInput}
              autoFocus
            />
          ) : (
            <Text style={styles.correctionText}>{flag.proposed_correction}</Text>
          )}
        </>
      ) : null}

      {/* Action buttons */}
      <View style={styles.actionRow}>
        {flag.proposed_correction ? (
          editing ? (
            <>
              <Pressable
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => {
                  setEditing(false);
                  onApprove(flag.id, editText.trim() || flag.proposed_correction!);
                }}
              >
                <Text style={styles.approveBtnText}>✅ Save & Approve</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => { setEditing(false); setEditText(flag.proposed_correction ?? ''); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => onApprove(flag.id, flag.proposed_correction!)}
              >
                <Text style={styles.approveBtnText}>✅ Approve</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.editBtn]}
                onPress={() => setEditing(true)}
              >
                <Text style={styles.editBtnText}>✏️ Edit</Text>
              </Pressable>
            </>
          )
        ) : (
          <Text style={styles.noCorrectionNote}>No correction proposed (verdict was CONFIRMED)</Text>
        )}
        <Pressable
          style={[styles.actionBtn, styles.dismissBtn]}
          onPress={() => onDismiss(flag.id)}
        >
          <Text style={styles.dismissBtnText}>❌ Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function RulesFlagsScreen() {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<RulesFlag[]>([]);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch pending flags — attribution (player/team) requires player identity
      // feature to be implemented; shows "Anonymous" until then.
      const { data, error } = await supabase
        .from('rules_flags')
        .select('id, created_at, question, original_answer, audit_verdict, proposed_correction, status, user_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: RulesFlag[] = (data ?? []).map((row: any) => {
        return {
          id: row.id,
          created_at: row.created_at,
          question: row.question,
          original_answer: row.original_answer,
          audit_verdict: row.audit_verdict,
          proposed_correction: row.proposed_correction,
          status: row.status,
          player_name: null,
          team_name: null,
        };
      });

      setFlags(mapped);
    } catch (err: any) {
      console.error('[RulesFlags] fetch error:', err);
      Alert.alert('Error', 'Failed to load flagged rules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchFlags(); }, [fetchFlags]));

  const handleApprove = async (flagId: string, correction: string) => {
    try {
      // Mark the flag approved
      await supabase.from('rules_flags').update({ status: 'approved' }).eq('id', flagId);
      // Insert into prompt_overrides so the widget picks it up
      await supabase.from('prompt_overrides').insert({
        correction,
        source_flag_id: flagId,
        status: 'approved',
      });
      setFlags(prev => prev.filter(f => f.id !== flagId));
    } catch {
      Alert.alert('Error', 'Failed to approve flag.');
    }
  };

  const handleDismiss = async (flagId: string) => {
    try {
      await supabase.from('rules_flags').update({ status: 'dismissed' }).eq('id', flagId);
      setFlags(prev => prev.filter(f => f.id !== flagId));
    } catch {
      Alert.alert('Error', 'Failed to dismiss flag.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Flagged Rules</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.headerSub}>
        Player-challenged assistant answers awaiting review
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : flags.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyTitle}>No pending flags</Text>
          <Text style={styles.emptySubtitle}>
            When players challenge a rules answer, it will appear here for review.
          </Text>
        </View>
      ) : (
        <FlatList
          data={flags}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <FlagCard
              flag={item}
              onApprove={handleApprove}
              onDismiss={handleDismiss}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 36,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 36,
  },
  headerSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 8,
  },
  attribution: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D4AF37',
  },
  timestamp: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: -4,
  },
  verdictBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 2,
  },
  verdictText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  questionText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    lineHeight: 19,
  },
  answerText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  correctionText: {
    fontSize: 13,
    color: '#e8d8c8',
    lineHeight: 19,
    backgroundColor: 'rgba(204,68,68,0.08)',
    borderLeftWidth: 2,
    borderLeftColor: '#cc4444',
    paddingLeft: 8,
    paddingVertical: 6,
    borderRadius: 4,
  },
  editInput: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 19,
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  noCorrectionNote: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  actionBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  approveBtn: {
    borderColor: '#4a9a4a',
    backgroundColor: 'rgba(50,180,50,0.12)',
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6abf6a',
  },
  editBtn: {
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212,175,55,0.10)',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D4AF37',
  },
  cancelBtn: {
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  dismissBtn: {
    borderColor: '#cc4444',
    backgroundColor: 'rgba(200,60,60,0.10)',
    marginLeft: 'auto',
  },
  dismissBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e07070',
  },
});
