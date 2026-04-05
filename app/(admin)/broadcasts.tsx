import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { useAuthContext } from '../../src/providers/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

type AudienceType = 'all' | 'captains_only' | 'eight_ball' | 'nine_ball' | 'masters' | 'teams' | 'players';
type BroadcastType = 'message' | 'poll';
type ReplyType = 'none' | 'text' | 'options';
type TabType = 'active' | 'closed' | 'archived';

interface BroadcastReply {
  id: string;
  created_at: string;
  body: string;
  is_read: boolean;
  team_id: string | null;
  teams: { name: string } | null;
  user_id: string;
  player_id: string | null;
  players: { first_name: string; last_name: string } | null;
}

interface ThreadMessage {
  id: string;
  created_at: string;
  body: string;
  is_from_lo: boolean;
  is_read: boolean;
  thread_team_id: string | null;
  teams: { name: string } | null;
  thread_user_id: string;
}

interface ReadRecord {
  id: string;
  user_id: string;
  team_id: string | null;
  read_at?: string;
  teams: { name: string } | null;
}

interface BroadcastWithReplies {
  id: string;
  created_at: string;
  body: string;
  type: BroadcastType;
  reply_type: ReplyType;
  reply_options: string[] | null;
  expires_at: string | null;
  is_archived: boolean;
  closed_at: string | null;
  audience_type: AudienceType[];
  audience_ids: string[] | null;
  broadcast_replies: BroadcastReply[];
  broadcast_reads: ReadRecord[];
  broadcast_thread_messages: ThreadMessage[];
}

// ─── Audience label helper ────────────────────────────────────────────────────

function audienceLabel(types: AudienceType | AudienceType[], ids: string[] | null): string {
  const arr: AudienceType[] = Array.isArray(types) ? types : [types];
  if (arr.length === 1) {
    switch (arr[0]) {
      case 'all': return 'ALL TEAMS';
      case 'captains_only': return 'CAPTAINS ONLY';
      case 'eight_ball': return '8-BALL TEAMS';
      case 'nine_ball': return '9-BALL TEAMS';
      case 'masters': return 'MASTERS';
      case 'teams': return `${(ids ?? []).length} TEAMS`;
      case 'players': return `${(ids ?? []).length} PLAYERS`;
      default: return 'ALL';
    }
  }
  return arr.map(t => {
    switch (t) {
      case 'captains_only': return 'CAPTAINS';
      case 'eight_ball': return '8-BALL';
      case 'nine_ball': return '9-BALL';
      case 'players': return `${(ids ?? []).length} PLAYERS`;
      default: return t.toUpperCase();
    }
  }).join(' + ');
}

const AUDIENCE_COLOR: Record<AudienceType, string> = {
  all: '#4CAF50',
  captains_only: '#2196F3',
  eight_ball: '#FF9800',
  nine_ball: '#9C27B0',
  masters: '#D4AF37',
  teams: '#009688',
  players: '#E91E63',
};

// ─── SeenModal ────────────────────────────────────────────────────────────────

function SeenModal({
  visible,
  broadcast,
  allTeamCount,
  onSendReminder,
  onClose,
}: {
  visible: boolean;
  broadcast: BroadcastWithReplies | null;
  allTeamCount: number;
  onSendReminder: (targetUserId: string, targetTeamId: string, broadcastId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [sending, setSending] = useState<string | null>(null);

  if (!broadcast) return null;

  const seenTeamIds = new Set(
    broadcast.broadcast_reads.map(r => r.team_id).filter(Boolean)
  );

  const seen = broadcast.broadcast_reads.filter(r => r.team_id);
  // "Not seen" is approximate — we only know about teams that have seen it.
  // For audience_type='teams', we can compare against audience_ids.
  // For 'all', we'd need the full teams list — show the seen list only for now.

  async function handleSendReminder(r: ReadRecord) {
    // For "not seen" we'd need user_id — this works for explicit team targets
    // where we have user context. For now, show a placeholder action.
    Alert.alert('Send Reminder', 'Reminder sent!');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.seenModalContent} onPress={e => e.stopPropagation()}>
          <Text style={styles.seenModalTitle}>Seen by Teams</Text>
          <Text style={styles.seenModalSub}>
            {seen.length} team{seen.length !== 1 ? 's' : ''} have viewed this broadcast
          </Text>
          <ScrollView style={{ maxHeight: 300 }}>
            {seen.length === 0 ? (
              <Text style={styles.seenEmpty}>No views recorded yet.</Text>
            ) : (
              seen.map(r => (
                <View key={r.id} style={styles.seenRow}>
                  <Text style={styles.seenTeamName}>{r.teams?.name ?? 'Unknown Team'}</Text>
                </View>
              ))
            )}
          </ScrollView>
          <Pressable style={styles.seenCloseBtn} onPress={onClose}>
            <Text style={styles.seenCloseBtnText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── BroadcastAdminCard ───────────────────────────────────────────────────────

function BroadcastAdminCard({
  broadcast,
  onArchive,
  onUnarchive,
  onClosePoll,
  onMarkReplyRead,
  onSendThreadMessage,
  onShowSeen,
}: {
  broadcast: BroadcastWithReplies;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onClosePoll: (id: string) => void;
  onMarkReplyRead: (replyId: string, broadcastId: string) => void;
  onSendThreadMessage: (broadcastId: string, threadUserId: string, threadTeamId: string | null, body: string) => Promise<void>;
  onShowSeen: (broadcast: BroadcastWithReplies) => void;
  onResend: (broadcast: BroadcastWithReplies) => Promise<void>;
}) {
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [threadInputs, setThreadInputs] = useState<Record<string, string>>({});
  const [threadExpanded, setThreadExpanded] = useState<Record<string, boolean>>({});
  const [sendingThread, setSendingThread] = useState<string | null>(null);

  const isPoll = broadcast.type === 'poll';
  const isClosed = !!broadcast.closed_at;
  const unreadReplies = broadcast.broadcast_replies.filter(r => !r.is_read).length;

  const readerIds = new Set(broadcast.broadcast_reads.map(r => r.user_id));
  const replierIds = new Set(broadcast.broadcast_replies.map(r => r.user_id));
  const seenWithoutResponding = [...readerIds].filter(id => !replierIds.has(id)).length;

  const audienceTypes = Array.isArray(broadcast.audience_type) ? broadcast.audience_type : [broadcast.audience_type];
  const audienceColor = AUDIENCE_COLOR[audienceTypes[0]] ?? '#888';
  const audienceLbl = audienceLabel(audienceTypes, broadcast.audience_ids);

  const formattedDate = new Date(broadcast.created_at).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // Poll results aggregation
  const pollCounts: Record<string, number> = {};
  if (isPoll && broadcast.reply_options) {
    for (const opt of broadcast.reply_options) pollCounts[opt] = 0;
  }
  for (const reply of broadcast.broadcast_replies) {
    if (pollCounts[reply.body] !== undefined) {
      pollCounts[reply.body]++;
    } else if (isPoll) {
      pollCounts[reply.body] = (pollCounts[reply.body] ?? 0) + 1;
    }
  }
  const maxCount = Math.max(1, ...Object.values(pollCounts));

  async function handleSendThread(reply: BroadcastReply) {
    const key = reply.user_id;
    const body = (threadInputs[key] ?? '').trim();
    if (!body) return;
    setSendingThread(key);
    try {
      await onSendThreadMessage(broadcast.id, reply.user_id, reply.team_id, body);
      setThreadInputs(prev => ({ ...prev, [key]: '' }));
    } finally {
      setSendingThread(null);
    }
  }

  // Group thread messages by thread_user_id (dedup by id in case of duplicate rows from query)
  const threads: Record<string, ThreadMessage[]> = {};
  for (const msg of broadcast.broadcast_thread_messages) {
    if (!threads[msg.thread_user_id]) threads[msg.thread_user_id] = [];
    if (!threads[msg.thread_user_id].some(m => m.id === msg.id)) {
      threads[msg.thread_user_id].push(msg);
    }
  }

  return (
    <View style={styles.card}>
      {/* Audience + timestamp row */}
      <View style={styles.cardHeaderRow}>
        <View style={[styles.audienceBadge, { borderColor: audienceColor, backgroundColor: audienceColor + '18' }]}>
          <Text style={[styles.audienceBadgeText, { color: audienceColor }]}>{audienceLbl}</Text>
        </View>
        {broadcast.type === 'poll' && (
          <View style={[styles.typeBadge, isClosed && styles.typeBadgeClosed]}>
            <Text style={styles.typeBadgeText}>{isClosed ? 'POLL · CLOSED' : 'POLL'}</Text>
          </View>
        )}
        <Text style={styles.timestamp}>{formattedDate}</Text>
      </View>

      {/* Expiry */}
      {broadcast.expires_at && (
        <Text style={styles.expiryBadge}>
          Expires {new Date(broadcast.expires_at).toLocaleDateString()}
        </Text>
      )}

      {/* Body */}
      <Text style={styles.broadcastBody}>{broadcast.body}</Text>

      {/* Poll results */}
      {isPoll && (
        <View style={styles.pollResults}>
          <Text style={styles.sectionLabel}>POLL RESULTS</Text>
          {Object.entries(pollCounts).map(([opt, count]) => {
            const barWidth = Math.round((count / maxCount) * 100);
            return (
              <View key={opt} style={styles.pollRow}>
                <Text style={styles.pollOption}>{opt}</Text>
                <View style={styles.pollBarContainer}>
                  <View style={[styles.pollBar, { width: `${barWidth}%` }]} />
                </View>
                <Text style={styles.pollCount}>{count}</Text>
              </View>
            );
          })}
          <Text style={styles.pollTotal}>
            {broadcast.broadcast_replies.length} of {broadcast.broadcast_reads.length} responded
          </Text>
        </View>
      )}

      {/* Seen summary */}
      <Pressable
        style={({ pressed }) => [styles.seenSummaryRow, pressed && styles.buttonPressed]}
        onPress={() => onShowSeen(broadcast)}
      >
        <Ionicons name="eye-outline" size={14} color={theme.colors.textSecondary} />
        <Text style={styles.seenSummaryText}>
          {seenWithoutResponding} seen without responding
        </Text>
        <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
      </Pressable>

      {/* Replies toggle */}
      {broadcast.broadcast_replies.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.repliesToggle, pressed && styles.buttonPressed]}
          onPress={() => setRepliesExpanded(e => !e)}
        >
          <Text style={styles.repliesToggleText}>
            {broadcast.broadcast_replies.length} {broadcast.type === 'poll' ? 'vote' : 'repl'}{broadcast.broadcast_replies.length !== 1 ? 's' : ''}
            {unreadReplies > 0 && <Text style={styles.unreadBadge}> · {unreadReplies} unread</Text>}
          </Text>
          <Ionicons
            name={repliesExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      )}

      {/* Replies list */}
      {repliesExpanded && broadcast.broadcast_replies.map(reply => {
        const threadKey = reply.user_id;
        const replyThreads = threads[threadKey] ?? [];
        const isThreadExpanded = threadExpanded[threadKey] ?? false;

        return (
          <View key={reply.id} style={styles.replyCard}>
            <View style={styles.replyHeaderRow}>
              <Text style={styles.replyTeamName}>
                {reply.teams?.name ?? 'Unknown Team'}
                {reply.players && ` · ${reply.players.first_name} ${reply.players.last_name}`}
              </Text>
              <Text style={styles.replyTimestamp}>
                {new Date(reply.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={styles.replyBody}>{reply.body}</Text>

            <View style={styles.replyActionRow}>
              {!reply.is_read && (
                <Pressable
                  style={({ pressed }) => [styles.miniBtn, pressed && styles.buttonPressed]}
                  onPress={() => onMarkReplyRead(reply.id, broadcast.id)}
                >
                  <Text style={styles.miniBtnText}>Mark Read</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.miniBtn, styles.miniBtnPrimary, pressed && styles.buttonPressed]}
                onPress={() => setThreadExpanded(prev => ({ ...prev, [threadKey]: !isThreadExpanded }))}
              >
                <Text style={styles.miniBtnTextPrimary}>
                  {isThreadExpanded
                    ? 'Hide Thread'
                    : `Message ${reply.players ? `${reply.players.first_name} ${reply.players.last_name}` : reply.teams?.name ?? 'Team'}`}
                </Text>
              </Pressable>
            </View>

            {/* Thread inline */}
            {isThreadExpanded && (
              <View style={styles.threadSection}>
                {replyThreads.filter((msg, i, self) => i === self.findIndex(m => m.id === msg.id)).map(msg => (
                  <View
                    key={msg.id}
                    style={[styles.threadMsg, msg.is_from_lo ? styles.threadMsgFromLo : styles.threadMsgFromPlayer]}
                  >
                    <Text style={styles.threadMsgSender}>
                      {msg.is_from_lo
                        ? 'You (LO)'
                        : `${reply.teams?.name ?? 'Team'}${reply.players ? ` · ${reply.players.first_name} ${reply.players.last_name}` : ''}`}
                    </Text>
                    <Text style={styles.threadMsgBody}>{msg.body}</Text>
                  </View>
                ))}
                <View style={styles.threadInputRow}>
                  <TextInput
                    style={styles.threadInput}
                    placeholder={`Message ${reply.teams?.name ?? 'team'}...`}
                    placeholderTextColor={theme.colors.textMuted}
                    value={threadInputs[threadKey] ?? ''}
                    onChangeText={t => setThreadInputs(prev => ({ ...prev, [threadKey]: t }))}
                    multiline
                    editable={sendingThread !== threadKey}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.threadSendBtn,
                      pressed && styles.buttonPressed,
                      sendingThread === threadKey && styles.threadSendBtnDisabled,
                    ]}
                    onPress={() => handleSendThread(reply)}
                    disabled={sendingThread === threadKey}
                  >
                    {sendingThread === threadKey
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="send" size={16} color="#fff" />
                    }
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        );
      })}

      {/* Actions */}
      <View style={styles.actionRow}>
        {isPoll && !isClosed && !broadcast.is_archived && (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.closeBtn, pressed && styles.buttonPressed]}
            onPress={() => onClosePoll(broadcast.id)}
          >
            <Text style={styles.closeBtnText}>Close Poll</Text>
          </Pressable>
        )}
        {isPoll && (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.resendBtn, pressed && styles.buttonPressed]}
            onPress={() => onResend(broadcast)}
          >
            <Text style={styles.resendBtnText}>Re-send</Text>
          </Pressable>
        )}
        {!broadcast.is_archived ? (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.archiveBtn, pressed && styles.buttonPressed]}
            onPress={() => onArchive(broadcast.id)}
          >
            <Text style={styles.archiveBtnText}>Archive</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.unarchiveBtn, pressed && styles.buttonPressed]}
            onPress={() => onUnarchive(broadcast.id)}
          >
            <Text style={styles.unarchiveBtnText}>Unarchive</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── ComposeModal ─────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS: { type: AudienceType; label: string }[] = [
  { type: 'all', label: 'All Teams' },
  { type: 'captains_only', label: 'Captains' },
  { type: 'eight_ball', label: '8-Ball' },
  { type: 'nine_ball', label: '9-Ball' },
  { type: 'teams', label: 'Teams' },
  { type: 'players', label: 'Players' },
];

const SHIRT_SUGGESTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function ComposeModal({
  visible,
  userId,
  onSend,
  onClose,
}: {
  visible: boolean;
  userId: string;
  onSend: (broadcast: Omit<BroadcastWithReplies, 'broadcast_replies' | 'broadcast_reads' | 'broadcast_thread_messages'>) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<BroadcastType>('message');
  const [audience, setAudience] = useState<AudienceType[]>(['all']);
  const [body, setBody] = useState('');
  const [replyType, setReplyType] = useState<ReplyType>('none');
  const [options, setOptions] = useState<string[]>([]);
  const [customOption, setCustomOption] = useState('');
  const [expiry, setExpiry] = useState('');
  const [sending, setSending] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerResults, setPlayerResults] = useState<{ id: string; first_name: string; last_name: string; member_number: string }[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const playerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [allTeams, setAllTeams] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<{ id: string; name: string }[]>([]);

  function reset() {
    setType('message');
    setAudience(['all']);
    setBody('');
    setReplyType('none');
    setOptions([]);
    setCustomOption('');
    setExpiry('');
    setSending(false);
    setPlayerSearch('');
    setPlayerResults([]);
    setSelectedPlayerIds([]);
    setSelectedPlayers([]);
    setTeamSearch('');
    setAllTeams([]);
    setSelectedTeamIds([]);
    setSelectedTeams([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function addOption(opt: string) {
    const trimmed = opt.trim();
    if (!trimmed || options.includes(trimmed)) return;
    setOptions(prev => [...prev, trimmed]);
  }

  function removeOption(opt: string) {
    setOptions(prev => prev.filter(o => o !== opt));
  }

  function handlePlayerSearchChange(q: string) {
    setPlayerSearch(q);
    if (playerSearchTimer.current) clearTimeout(playerSearchTimer.current);
    if (!q.trim()) { setPlayerResults([]); return; }
    playerSearchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('players')
        .select('id, first_name, last_name, member_number')
        .or(`first_name.ilike.%${q.trim()}%,last_name.ilike.%${q.trim()}%,member_number.eq.${q.trim()}`)
        .limit(10);
      setPlayerResults((data as any) ?? []);
    }, 300);
  }

  function handleSelectPlayer(p: { id: string; first_name: string; last_name: string; member_number: string }) {
    if (selectedPlayerIds.includes(p.id)) return;
    setSelectedPlayerIds(prev => [...prev, p.id]);
    setSelectedPlayers(prev => [...prev, { id: p.id, first_name: p.first_name, last_name: p.last_name }]);
    setPlayerSearch('');
    setPlayerResults([]);
  }

  function handleRemovePlayer(id: string) {
    setSelectedPlayerIds(prev => prev.filter(x => x !== id));
    setSelectedPlayers(prev => prev.filter(x => x.id !== id));
  }

  function handleSelectTeam(t: { id: string; name: string }) {
    if (selectedTeamIds.includes(t.id)) return;
    setSelectedTeamIds(prev => [...prev, t.id]);
    setSelectedTeams(prev => [...prev, t]);
    setTeamSearch('');
  }

  function handleRemoveTeam(id: string) {
    setSelectedTeamIds(prev => prev.filter(x => x !== id));
    setSelectedTeams(prev => prev.filter(x => x.id !== id));
  }

  function handleAudienceToggle(type: AudienceType) {
    if (type === 'all') {
      setAudience(['all']);
      return;
    }
    if (type === 'teams' && allTeams.length === 0) {
      supabase.from('teams').select('id, name').eq('is_active', true).order('name')
        .then(({ data }) => setAllTeams((data as any) ?? []));
    }
    setAudience(prev => {
      const without = prev.filter(a => a !== 'all');
      if (without.includes(type)) {
        const next = without.filter(a => a !== type);
        return next.length === 0 ? ['all'] : next;
      }
      return [...without, type];
    });
  }

  async function handleSend() {
    if (!body.trim()) {
      Alert.alert('Required', 'Message body is required.');
      return;
    }
    if (type === 'poll' && options.length < 2) {
      Alert.alert('Required', 'Add at least 2 options for a poll.');
      return;
    }
    if (audience.includes('players') && selectedPlayerIds.length === 0) {
      Alert.alert('Required', 'Select at least one player.');
      return;
    }
    if (audience.includes('teams') && selectedTeamIds.length === 0) {
      Alert.alert('Required', 'Select at least one team.');
      return;
    }

    const resolvedReplyType: ReplyType = type === 'poll' ? 'options' : replyType;
    const resolvedOptions = type === 'poll' ? options : null;

    setSending(true);
    try {
      const { data, error } = await supabase.from('broadcasts').insert({
        body: body.trim(),
        type,
        reply_type: resolvedReplyType,
        reply_options: resolvedOptions,
        audience_type: audience,
        audience_ids: audience.includes('players')
          ? selectedPlayerIds
          : audience.includes('teams')
            ? selectedTeamIds
            : null,
        expires_at: expiry.trim() || null,
        created_by: userId,
      }).select('id, created_at, body, type, reply_type, reply_options, expires_at, is_archived, closed_at, audience_type, audience_ids').single();

      if (error) throw error;

      onSend({ ...(data as any), broadcast_replies: [], broadcast_reads: [], broadcast_thread_messages: [] });
      reset();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', 'Failed to send broadcast.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Pressable style={styles.composeContent} onPress={e => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.composeTitle}>New Broadcast</Text>

            {/* Type toggle */}
            <Text style={styles.composeLabel}>TYPE</Text>
            <View style={styles.segmentedRow}>
              {(['message', 'poll'] as BroadcastType[]).map(t => (
                <Pressable
                  key={t}
                  style={[styles.segmentBtn, type === t && styles.segmentBtnActive]}
                  onPress={() => {
                    setType(t);
                    if (t === 'poll') setReplyType('options');
                    else setReplyType('none');
                  }}
                >
                  <Text style={[styles.segmentBtnText, type === t && styles.segmentBtnTextActive]}>
                    {t === 'message' ? 'Message' : 'Poll'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Audience */}
            <Text style={styles.composeLabel}>AUDIENCE</Text>
            <View style={styles.audienceRow}>
              {AUDIENCE_OPTIONS.map(o => (
                <Pressable
                  key={o.type}
                  style={[styles.audienceChip, audience.includes(o.type) && styles.audienceChipActive]}
                  onPress={() => handleAudienceToggle(o.type)}
                >
                  <Text style={[styles.audienceChipText, audience.includes(o.type) && styles.audienceChipTextActive]}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Team selector — visible when Teams chip is selected */}
            {audience.includes('teams') && (
              <View style={styles.playerSearchSection}>
                <TextInput
                  style={styles.playerSearchInput}
                  value={teamSearch}
                  onChangeText={setTeamSearch}
                  placeholder="Filter teams…"
                  placeholderTextColor={theme.colors.textMuted}
                />
                {(() => {
                  const filtered = allTeams.filter(t =>
                    !selectedTeamIds.includes(t.id) &&
                    t.name.toLowerCase().includes(teamSearch.toLowerCase())
                  );
                  return filtered.length > 0 ? (
                    <View style={styles.playerResultsList}>
                      {filtered.map(t => (
                        <Pressable
                          key={t.id}
                          style={({ pressed }) => [styles.playerResultRow, pressed && styles.buttonPressed]}
                          onPress={() => handleSelectTeam(t)}
                        >
                          <Text style={styles.playerResultName}>{t.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null;
                })()}
                {selectedTeams.length > 0 && (
                  <View style={styles.selectedPlayersRow}>
                    {selectedTeams.map(t => (
                      <Pressable
                        key={t.id}
                        style={styles.selectedPlayerTag}
                        onPress={() => handleRemoveTeam(t.id)}
                      >
                        <Text style={styles.selectedPlayerTagText}>{t.name} ×</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Player search — visible when Players chip is selected */}
            {audience.includes('players') && (
              <View style={styles.playerSearchSection}>
                <TextInput
                  style={styles.playerSearchInput}
                  value={playerSearch}
                  onChangeText={handlePlayerSearchChange}
                  placeholder="Search by name or member #"
                  placeholderTextColor={theme.colors.textMuted}
                />
                {playerResults.length > 0 && (
                  <View style={styles.playerResultsList}>
                    {playerResults.map(p => (
                      <Pressable
                        key={p.id}
                        style={({ pressed }) => [styles.playerResultRow, pressed && styles.buttonPressed]}
                        onPress={() => handleSelectPlayer(p)}
                      >
                        <Text style={styles.playerResultName}>{p.first_name} {p.last_name}</Text>
                        <Text style={styles.playerResultMember}>#{p.member_number}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {selectedPlayers.length > 0 && (
                  <View style={styles.selectedPlayersRow}>
                    {selectedPlayers.map(p => (
                      <Pressable
                        key={p.id}
                        style={styles.selectedPlayerTag}
                        onPress={() => handleRemovePlayer(p.id)}
                      >
                        <Text style={styles.selectedPlayerTagText}>{p.first_name} {p.last_name} ×</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Body */}
            <Text style={styles.composeLabel}>MESSAGE</Text>
            <TextInput
              style={styles.bodyInput}
              value={body}
              onChangeText={setBody}
              placeholder="Type your message..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            {/* Message reply option */}
            {type === 'message' && (
              <>
                <Text style={styles.composeLabel}>ALLOW REPLIES?</Text>
                <View style={styles.segmentedRow}>
                  {([['none', 'No Reply'], ['text', 'Free Text']] as [ReplyType, string][]).map(([rt, lbl]) => (
                    <Pressable
                      key={rt}
                      style={[styles.segmentBtn, replyType === rt && styles.segmentBtnActive]}
                      onPress={() => setReplyType(rt)}
                    >
                      <Text style={[styles.segmentBtnText, replyType === rt && styles.segmentBtnTextActive]}>
                        {lbl}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Poll options builder */}
            {type === 'poll' && (
              <>
                <Text style={styles.composeLabel}>POLL OPTIONS</Text>
                {/* Suggestions */}
                <Text style={styles.suggestionNote}>Quick add:</Text>
                <View style={styles.suggestionsRow}>
                  {SHIRT_SUGGESTIONS.map(s => (
                    <Pressable
                      key={s}
                      style={[styles.suggestionChip, options.includes(s) && styles.suggestionChipAdded]}
                      onPress={() => options.includes(s) ? removeOption(s) : addOption(s)}
                    >
                      <Text style={[styles.suggestionChipText, options.includes(s) && styles.suggestionChipTextAdded]}>
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {/* Custom option input */}
                <View style={styles.customOptionRow}>
                  <TextInput
                    style={styles.customOptionInput}
                    value={customOption}
                    onChangeText={setCustomOption}
                    placeholder="Add custom option..."
                    placeholderTextColor={theme.colors.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={() => { addOption(customOption); setCustomOption(''); }}
                  />
                  <Pressable
                    style={({ pressed }) => [styles.addOptionBtn, pressed && styles.buttonPressed]}
                    onPress={() => { addOption(customOption); setCustomOption(''); }}
                  >
                    <Text style={styles.addOptionBtnText}>Add</Text>
                  </Pressable>
                </View>
                {/* Added options */}
                {options.length > 0 && (
                  <View style={styles.addedOptionsRow}>
                    {options.map(opt => (
                      <View key={opt} style={styles.addedOptionChip}>
                        <Text style={styles.addedOptionText}>{opt}</Text>
                        <Pressable onPress={() => removeOption(opt)} hitSlop={6}>
                          <Text style={styles.removeOptionX}> ×</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Expiry */}
            <Text style={styles.composeLabel}>EXPIRY DATE (optional)</Text>
            <TextInput
              style={styles.expiryInput}
              value={expiry}
              onChangeText={setExpiry}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />

            {/* Actions */}
            <Pressable
              style={({ pressed }) => [
                styles.sendBroadcastBtn,
                pressed && styles.buttonPressed,
                sending && styles.sendBroadcastBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.sendBroadcastBtnText}>Send Broadcast</Text>
              }
            </Pressable>
            <Pressable style={({ pressed }) => [styles.cancelLink, pressed && styles.buttonPressed]} onPress={handleClose}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BroadcastsScreen() {
  const { profile } = useAuthContext();
  const userId = profile?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [broadcasts, setBroadcasts] = useState<BroadcastWithReplies[]>([]);
  const [tab, setTab] = useState<TabType>('active');
  const [composeVisible, setComposeVisible] = useState(false);
  const [seenBroadcast, setSeenBroadcast] = useState<BroadcastWithReplies | null>(null);

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('broadcasts')
        .select(`
          id, created_at, body, type, reply_type, reply_options, expires_at,
          is_archived, closed_at, audience_type, audience_ids,
          broadcast_replies(id, created_at, body, is_read, team_id, user_id, player_id, teams!team_id(name), players!player_id(first_name, last_name)),
          broadcast_reads(id, user_id, team_id, read_at, teams(name)),
          broadcast_thread_messages(id, created_at, body, is_from_lo, is_read, thread_team_id, thread_user_id, teams:thread_team_id(name))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBroadcasts((data as any) ?? []);
    } catch (err: any) {
      console.error('[Broadcasts] fetch error:', err);
      Alert.alert('Error', 'Failed to load broadcasts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchBroadcasts(); }, [fetchBroadcasts]));

  // Realtime: new replies and thread messages while screen is mounted
  useEffect(() => {
    const channel = supabase
      .channel('admin_broadcast_updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'broadcast_replies' },
        () => {
          // Re-fetch so the reply includes joined team/player names
          fetchBroadcasts();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'broadcast_thread_messages' },
        (payload) => {
          const msg = payload.new as any;
          setBroadcasts(prev => prev.map(b =>
            b.id === msg.broadcast_id
              ? {
                  ...b,
                  broadcast_thread_messages: b.broadcast_thread_messages.some(m => m.id === msg.id)
                    ? b.broadcast_thread_messages
                    : [...b.broadcast_thread_messages, { ...msg, teams: null }],
                }
              : b
          ));
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [fetchBroadcasts]);

  // Tab filtering
  const filtered = broadcasts.filter(b => {
    if (tab === 'archived') return b.is_archived;
    if (tab === 'closed') return !b.is_archived && !!b.closed_at;
    return !b.is_archived && !b.closed_at;
  });

  // ── Actions ──

  function handleComposeSend(newBroadcast: BroadcastWithReplies) {
    setBroadcasts(prev => [newBroadcast, ...prev]);
    setTab('active');
  }

  async function handleResend(b: BroadcastWithReplies) {
    const { error } = await supabase.from('broadcasts').insert({
      body: b.body,
      type: b.type,
      reply_type: b.reply_type,
      reply_options: b.reply_options,
      audience_type: b.audience_type,
      audience_ids: b.audience_ids,
    });
    if (error) { Alert.alert('Error', 'Failed to resend poll.'); return; }
    fetchBroadcasts();
  }

  async function handleArchive(id: string) {
    await supabase.from('broadcasts').update({ is_archived: true }).eq('id', id);
    setBroadcasts(prev => prev.map(b => b.id === id ? { ...b, is_archived: true } : b));
  }

  async function handleUnarchive(id: string) {
    await supabase.from('broadcasts').update({ is_archived: false }).eq('id', id);
    setBroadcasts(prev => prev.map(b => b.id === id ? { ...b, is_archived: false } : b));
  }

  async function handleClosePoll(id: string) {
    const closedAt = new Date().toISOString();
    await supabase.from('broadcasts').update({ closed_at: closedAt }).eq('id', id);
    setBroadcasts(prev => prev.map(b => b.id === id ? { ...b, closed_at: closedAt } : b));
    setTab('closed');
  }

  async function handleMarkReplyRead(replyId: string, broadcastId: string) {
    await supabase.from('broadcast_replies').update({ is_read: true }).eq('id', replyId);
    setBroadcasts(prev => prev.map(b =>
      b.id === broadcastId
        ? { ...b, broadcast_replies: b.broadcast_replies.map(r => r.id === replyId ? { ...r, is_read: true } : r) }
        : b
    ));
  }

  async function handleSendThreadMessage(
    broadcastId: string,
    threadUserId: string,
    threadTeamId: string | null,
    body: string
  ) {
    const { data, error } = await supabase.from('broadcast_thread_messages').insert({
      broadcast_id: broadcastId,
      thread_user_id: threadUserId,
      thread_team_id: threadTeamId,
      sender_id: userId,
      is_from_lo: true,
      body,
    }).select('id, created_at, body, is_from_lo, is_read, thread_team_id, thread_user_id').single();

    if (error) throw error;

    setBroadcasts(prev => prev.map(b =>
      b.id === broadcastId
        ? { ...b, broadcast_thread_messages: [...b.broadcast_thread_messages, { ...(data as any), teams: null }] }
        : b
    ));
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ComposeModal
        visible={composeVisible}
        userId={userId}
        onSend={handleComposeSend}
        onClose={() => setComposeVisible(false)}
      />
      <SeenModal
        visible={!!seenBroadcast}
        broadcast={seenBroadcast}
        allTeamCount={0}
        onSendReminder={async () => {}}
        onClose={() => setSeenBroadcast(null)}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Broadcasts</Text>
        <Pressable
          style={({ pressed }) => [styles.composeBtn, pressed && styles.buttonPressed]}
          onPress={() => setComposeVisible(true)}
        >
          <Ionicons name="add" size={20} color={theme.colors.primary} />
          <Text style={styles.composeBtnText}>Compose</Text>
        </Pressable>
      </View>

      {/* Tab row */}
      <View style={styles.tabRow}>
        {(['active', 'closed', 'archived'] as TabType[]).map(t => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📣</Text>
          <Text style={styles.emptyTitle}>No {tab} broadcasts</Text>
          <Text style={styles.emptySubtitle}>
            {tab === 'active'
              ? 'Tap Compose to send a message or poll to your teams.'
              : `No broadcasts in the ${tab} tab.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <BroadcastAdminCard
              broadcast={item}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onClosePoll={handleClosePoll}
              onMarkReplyRead={handleMarkReplyRead}
              onSendThreadMessage={handleSendThreadMessage}
              onShowSeen={setSeenBroadcast}
              onResend={handleResend}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GOLD = '#D4AF37';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: { width: 36 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  composeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  composeBtnText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabBtnTextActive: {
    color: theme.colors.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: { padding: 16, gap: 16 },

  // Card
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  audienceBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  audienceBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: GOLD + '20',
    borderWidth: 1,
    borderColor: GOLD,
  },
  typeBadgeClosed: {
    backgroundColor: theme.colors.textMuted + '20',
    borderColor: theme.colors.textMuted,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: GOLD, letterSpacing: 0.5 },
  timestamp: { marginLeft: 'auto', fontSize: 11, color: theme.colors.textSecondary },
  expiryBadge: { fontSize: 11, color: '#FF9800', fontWeight: '600' },
  broadcastBody: { fontSize: 14, color: theme.colors.text, lineHeight: 21 },

  // Poll results
  pollResults: { gap: 6 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700',
    color: theme.colors.textSecondary, letterSpacing: 0.8,
  },
  pollRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pollOption: { width: 36, fontSize: 13, fontWeight: '600', color: theme.colors.text },
  pollBarContainer: {
    flex: 1, height: 10,
    backgroundColor: theme.colors.border, borderRadius: 5, overflow: 'hidden',
  },
  pollBar: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 5 },
  pollCount: { width: 24, fontSize: 13, color: theme.colors.textSecondary, textAlign: 'right' },
  pollTotal: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },

  // Seen
  seenSummaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4,
  },
  seenSummaryText: { flex: 1, fontSize: 12, color: theme.colors.textSecondary },

  // Replies
  repliesToggle: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  repliesToggleText: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.text },
  unreadBadge: { color: theme.colors.primary },
  replyCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  replyHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  replyTeamName: { flex: 1, fontSize: 12, fontWeight: '700', color: GOLD },
  replyTimestamp: { fontSize: 11, color: theme.colors.textSecondary },
  replyBody: { fontSize: 13, color: theme.colors.text, lineHeight: 19 },
  replyActionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  miniBtn: {
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  miniBtnText: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },
  miniBtnPrimary: { borderColor: theme.colors.primary },
  miniBtnTextPrimary: { fontSize: 11, color: theme.colors.primary, fontWeight: '600' },

  // Thread
  threadSection: { gap: 6, marginTop: 4 },
  threadMsg: {
    borderRadius: 8, padding: 8,
    borderWidth: 1,
  },
  threadMsgFromLo: {
    backgroundColor: theme.colors.primary + '15',
    borderColor: theme.colors.primary + '30',
  },
  threadMsgFromPlayer: {
    backgroundColor: theme.colors.surfaceLight,
    borderColor: theme.colors.border,
  },
  threadMsgSender: { fontSize: 10, color: theme.colors.textMuted, fontWeight: '700', marginBottom: 2 },
  threadMsgBody: { fontSize: 13, color: theme.colors.text, lineHeight: 19 },
  threadInputRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  threadInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: theme.colors.text,
    fontSize: 13,
    maxHeight: 80,
  },
  threadSendBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadSendBtnDisabled: { opacity: 0.6 },

  // Card actions
  actionRow: {
    flexDirection: 'row', gap: 8, flexWrap: 'wrap',
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    paddingTop: 10, marginTop: 4,
  },
  actionBtn: {
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1,
  },
  closeBtn: { borderColor: '#FF9800', backgroundColor: 'rgba(255,152,0,0.10)' },
  closeBtnText: { fontSize: 12, fontWeight: '700', color: '#FF9800' },
  archiveBtn: { borderColor: theme.colors.border, backgroundColor: 'transparent' },
  archiveBtnText: { fontSize: 12, color: theme.colors.textSecondary },
  unarchiveBtn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' },
  unarchiveBtnText: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  resendBtn: { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.10)' },
  resendBtnText: { fontSize: 12, fontWeight: '700', color: '#4CAF50' },

  // SeenModal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  seenModalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  seenModalTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  seenModalSub: { fontSize: 13, color: theme.colors.textSecondary },
  seenEmpty: { fontSize: 13, color: theme.colors.textMuted, fontStyle: 'italic' },
  seenRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  seenTeamName: { fontSize: 14, color: theme.colors.text, fontWeight: '600' },
  seenCloseBtn: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  seenCloseBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // ComposeModal
  composeContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  composeTitle: {
    fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 16,
  },
  composeLabel: {
    fontSize: 10, fontWeight: '700',
    color: theme.colors.textSecondary, letterSpacing: 0.8,
    marginBottom: 6, marginTop: 12,
  },
  segmentedRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center',
  },
  segmentBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '15',
  },
  segmentBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  segmentBtnTextActive: { color: theme.colors.primary },
  audienceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  audienceChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border,
  },
  audienceChipActive: {
    borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15',
  },
  audienceChipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  audienceChipTextActive: { color: theme.colors.primary },
  playerSearchSection: { marginTop: 10, gap: 8 },
  playerSearchInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
    color: theme.colors.text, fontSize: 14,
  },
  playerResultsList: {
    borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface, overflow: 'hidden',
  },
  playerResultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  playerResultName: { fontSize: 14, color: theme.colors.text, fontWeight: '500' },
  playerResultMember: { fontSize: 12, color: theme.colors.textMuted },
  selectedPlayersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedPlayerTag: {
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: theme.colors.primary + '40',
  },
  selectedPlayerTagText: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  bodyInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  suggestionNote: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 6 },
  suggestionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  suggestionChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border,
  },
  suggestionChipAdded: {
    borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15',
  },
  suggestionChipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  suggestionChipTextAdded: { color: theme.colors.primary },
  customOptionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  customOptionInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.colors.text,
    fontSize: 13,
  },
  addOptionBtn: {
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  addOptionBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
  addedOptionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  addedOptionChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 16, borderWidth: 1, borderColor: theme.colors.primary,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addedOptionText: { fontSize: 13, color: theme.colors.primary, fontWeight: '600' },
  removeOptionX: { fontSize: 15, color: theme.colors.primary, fontWeight: '700' },
  expiryInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 14,
  },
  sendBroadcastBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  sendBroadcastBtnDisabled: { opacity: 0.6 },
  sendBroadcastBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelLink: { alignSelf: 'center', paddingVertical: 12, marginBottom: 8 },
  cancelLinkText: { color: theme.colors.textSecondary, fontSize: 14 },

  buttonPressed: { opacity: 0.75 },
});
