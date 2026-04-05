import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { supabase } from '../lib/supabase';

export interface BroadcastThreadMessage {
  id: string;
  created_at: string;
  broadcast_id: string;
  body: string;
  is_from_lo: boolean;
  is_read: boolean;
}

interface BroadcastCardProps {
  broadcast: {
    id: string;
    body: string;
    created_at: string;
    type: 'message' | 'poll';
    reply_type: 'none' | 'text' | 'options';
    reply_options: string[] | null;
    closed_at: string | null;
  };
  existingReply: string | null;
  threadMessages: BroadcastThreadMessage[];
  userId: string;
  teamId: string;
  onReply: (broadcastId: string, text: string) => Promise<void>;
  onDismiss: (broadcastId: string) => void;
  onThreadReply: (broadcastId: string, text: string) => Promise<void>;
}

export function BroadcastCard({
  broadcast,
  existingReply,
  threadMessages,
  userId,
  teamId,
  onReply,
  onDismiss,
  onThreadReply,
}: BroadcastCardProps) {
  const [replyExpanded, setReplyExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [threadReplyText, setThreadReplyText] = useState('');
  const [threadSubmitting, setThreadSubmitting] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const seenFired = useRef(false);

  // Mark as seen once on first render
  useEffect(() => {
    if (seenFired.current) return;
    seenFired.current = true;
    supabase
      .from('broadcast_reads')
      .upsert({ broadcast_id: broadcast.id, user_id: userId, team_id: teamId })
      .then();
  }, [broadcast.id, userId, teamId]);

  const isClosed = !!broadcast.closed_at;
  const isPoll = broadcast.type === 'poll';
  const label = isPoll ? 'POLL' : 'LEAGUE UPDATE';

  const formattedDate = new Date(broadcast.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  async function handleTextSend() {
    if (!replyText.trim()) return;
    setSubmitting(true);
    setReplyError(null);
    try {
      await onReply(broadcast.id, replyText.trim());
      setReplyText('');
      setReplyExpanded(false);
    } catch {
      setReplyError('Failed to send. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOptionTap(option: string) {
    setSubmitting(true);
    setReplyError(null);
    try {
      await onReply(broadcast.id, option);
    } catch {
      setReplyError('Failed to send. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleThreadSend() {
    if (!threadReplyText.trim()) return;
    setThreadSubmitting(true);
    setThreadError(null);
    try {
      await onThreadReply(broadcast.id, threadReplyText.trim());
      setThreadReplyText('');
    } catch {
      setThreadError('Failed to send. Please try again.');
    } finally {
      setThreadSubmitting(false);
    }
  }

  // Last thread message is from LO = player needs to respond
  const lastThreadMessage = threadMessages[threadMessages.length - 1];
  const awaitingPlayerThreadReply = lastThreadMessage?.is_from_lo === true;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.timestamp}>{formattedDate}</Text>
      </View>

      {/* Body */}
      <Text style={styles.body}>{broadcast.body}</Text>

      {/* Poll closed notice */}
      {isPoll && isClosed && (
        <Text style={styles.closedNote}>This poll is now closed.</Text>
      )}

      {/* Reply section */}
      {!existingReply && !isClosed && broadcast.reply_type !== 'none' && (
        <>
          {broadcast.reply_type === 'options' && broadcast.reply_options && (
            <View style={styles.optionsRow}>
              {broadcast.reply_options.map(opt => (
                <Pressable
                  key={opt}
                  style={({ pressed }) => [
                    styles.optionPill,
                    pressed && !submitting && styles.optionPillPressed,
                    submitting && styles.optionPillDisabled,
                  ]}
                  onPress={() => handleOptionTap(opt)}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Text style={styles.optionPillText}>{opt}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {broadcast.reply_type === 'text' && (
            <>
              {!replyExpanded ? (
                <Pressable
                  style={({ pressed }) => [styles.replyToggle, pressed && styles.buttonPressed]}
                  onPress={() => setReplyExpanded(true)}
                >
                  <Text style={styles.replyToggleText}>Reply</Text>
                </Pressable>
              ) : (
                <View style={styles.replyInputRow}>
                  <TextInput
                    style={styles.replyInput}
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder="Type your reply..."
                    placeholderTextColor={theme.colors.textMuted}
                    multiline
                    editable={!submitting}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.sendButton,
                      pressed && !submitting && styles.buttonPressed,
                      submitting && styles.sendButtonDisabled,
                    ]}
                    onPress={handleTextSend}
                    disabled={submitting}
                  >
                    {submitting
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.sendButtonText}>Send</Text>
                    }
                  </Pressable>
                </View>
              )}
            </>
          )}

          {replyError && <Text style={styles.errorText}>{replyError}</Text>}
        </>
      )}

      {/* Existing reply confirmation */}
      {existingReply && (
        <Text style={styles.existingReply}>✓ Your reply: {existingReply}</Text>
      )}

      {/* Direct LO thread messages */}
      {threadMessages.length > 0 && (
        <View style={styles.threadSection}>
          <View style={styles.threadDivider} />
          {threadMessages.map(msg => (
            <View
              key={msg.id}
              style={[styles.threadMessage, msg.is_from_lo ? styles.threadFromLo : styles.threadFromPlayer]}
            >
              <Text style={styles.threadSenderLabel}>
                {msg.is_from_lo ? 'Message from your LO' : 'You'}
              </Text>
              <Text style={styles.threadBody}>{msg.body}</Text>
            </View>
          ))}

          {awaitingPlayerThreadReply && (
            <>
              <View style={styles.replyInputRow}>
                <TextInput
                  style={styles.replyInput}
                  value={threadReplyText}
                  onChangeText={setThreadReplyText}
                  placeholder="Reply to LO..."
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  editable={!threadSubmitting}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.sendButton,
                    pressed && !threadSubmitting && styles.buttonPressed,
                    threadSubmitting && styles.sendButtonDisabled,
                  ]}
                  onPress={handleThreadSend}
                  disabled={threadSubmitting}
                >
                  {threadSubmitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.sendButtonText}>Send</Text>
                  }
                </Pressable>
              </View>
              {threadError && <Text style={styles.errorText}>{threadError}</Text>}
            </>
          )}
        </View>
      )}

      {/* Dismiss — only visible if not yet replied */}
      {!existingReply && (
        <Pressable
          style={({ pressed }) => [styles.dismissRow, pressed && styles.buttonPressed]}
          onPress={() => onDismiss(broadcast.id)}
          hitSlop={8}
        >
          <Text style={styles.dismissText}>Dismiss ×</Text>
        </Pressable>
      )}
    </View>
  );
}

const GOLD = '#D4AF37';

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 1,
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  body: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
    marginBottom: 14,
  },
  closedNote: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  optionPill: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 52,
    alignItems: 'center',
  },
  optionPillPressed: {
    backgroundColor: theme.colors.primary + '20',
  },
  optionPillDisabled: {
    opacity: 0.5,
  },
  optionPillText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  replyToggle: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  replyToggleText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  replyInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  replyInput: {
    flex: 1,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.colors.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  existingReply: {
    color: '#4CAF50',
    fontStyle: 'italic',
    fontSize: 14,
    marginBottom: 8,
  },
  threadSection: {
    marginTop: 8,
  },
  threadDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: 12,
  },
  threadMessage: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  threadFromLo: {
    backgroundColor: theme.colors.primary + '15',
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  threadFromPlayer: {
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'flex-end',
    maxWidth: '90%',
  },
  threadSenderLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 3,
  },
  threadBody: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  dismissRow: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  dismissText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
