/**
 * MealChatScreen — conversational meal log management.
 * Type a request like "add a banana to lunch" or "remove the chapati" and the
 * AI proposes structured changes that you review and confirm before applying.
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useMealStore, MealLogEntry, MealFoodItem } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { analyzeMealManage, ProposedChange } from '../../../services/aiServices';
import { tc, ts, tr } from '../../../shared/theme/tracend';
import { getTodayDateString } from '../../../shared/istDate';

type RouteParams = {
  MealChat: { date?: string } | undefined;
};

type ChatMsg = { id: string; role: 'user' | 'assistant'; text: string };

const QUICK_PROMPTS = [
  'Add a banana to lunch',
  'Remove something from today',
  'Make dinner higher protein',
];

export default function MealChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'MealChat'>>();
  const paramDate = route.params?.date || getTodayDateString();
  const { entries, addEntry, editEntry, deleteEntry } = useMealStore();
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposed, setProposed] = useState<ProposedChange[]>([]);
  const [applying, setApplying] = useState(false);
  const listRef = useRef<FlatList<ChatMsg>>(null);

  const dayEntries = useMemo(
    () => entries.filter((e) => e.date.slice(0, 10) === paramDate),
    [entries, paramDate]
  );

  const buildTodayContext = () => {
    if (dayEntries.length === 0) return 'No meals logged for this day yet.';
    const lines: string[] = [];
    for (const entry of dayEntries) {
      lines.push(`${entry.mealType.toUpperCase()} (entryId: ${entry.id}):`);
      for (const item of entry.items) {
        lines.push(`  - ${item.name}${item.quantity ? ` (${item.quantity})` : ''}: ${item.calories}cal, ${item.protein}g P, ${item.carbs}g C, ${item.fat}g F`);
      }
    }
    return lines.join('\n');
  };

  const send = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || loading) return;
    setInput('');
    setProposed([]);
    setMessages((m) => [...m, { id: `${Date.now()}-u`, role: 'user', text }]);
    setLoading(true);
    try {
      const result = await analyzeMealManage(text, buildTodayContext());
      setMessages((m) => [...m, { id: `${Date.now()}-a`, role: 'assistant', text: result.message || 'Here is what I propose.' }]);
      setProposed(Array.isArray(result.proposedChanges) ? result.proposedChanges : []);
    } catch (e: any) {
      setMessages((m) => [...m, { id: `${Date.now()}-a`, role: 'assistant', text: `Something went wrong: ${e?.message || 'try again'}` }]);
    }
    setLoading(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const applyChanges = () => {
    if (applying || proposed.length === 0) return;
    setApplying(true);
    for (const ch of proposed) {
      if (ch.type === 'delete') {
        if (ch.entryId) deleteEntry(ch.entryId, user?.id);
      } else if (ch.type === 'modify') {
        if (ch.entryId && ch.items.length > 0) {
          editEntry(ch.entryId, { items: ch.items }, user?.id);
        }
      } else if (ch.type === 'add') {
        const validItems = ch.items.filter((i) => i.name.trim());
        if (validItems.length > 0) {
          addEntry(
            {
              date: new Date(paramDate + 'T12:00:00+05:30').toISOString(),
              mealType: ch.mealType || 'lunch',
              items: validItems,
              notes: '',
            },
            user?.id
          );
        }
      }
    }
    setApplying(false);
    setProposed([]);
    setMessages((m) => [...m, { id: `${Date.now()}-a`, role: 'assistant', text: `Applied ${proposed.length} change${proposed.length > 1 ? 's' : ''}. Check your log for today.` }]);
  };

  const macroSummary = (items: MealFoodItem[]) => {
    const t = items.reduce((a, i) => ({ c: a.c + (i.calories || 0), p: a.p + (i.protein || 0) }), { c: 0, p: 0 });
    return `${t.c} cal · ${t.p}g P`;
  };

  const renderProposal = (ch: ProposedChange, i: number) => {
    const color = ch.type === 'add' ? tc.stable : ch.type === 'delete' ? tc.attention : tc.amber;
    const icon = ch.type === 'add' ? 'add-circle-outline' : ch.type === 'delete' ? 'remove-circle-outline' : 'create-outline';
    return (
      <View key={i} style={styles.proposalRow}>
        <Ionicons name={icon as any} size={16} color={color} />
        <View style={{ flex: 1 }}>
          <Text style={styles.proposalReason}>{ch.reason || ch.type}</Text>
          {ch.items.length > 0 && (
            <Text style={styles.proposalItems}>
              {ch.items.map((it) => it.name).join(', ')} · {macroSummary(ch.items)}
            </Text>
          )}
          {ch.entryId && <Text style={styles.proposalEntryId}>entry {ch.entryId.slice(0, 6)}…</Text>}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={tc.action} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Meal Chat</Text>
        <Ionicons name="sparkles" size={18} color={tc.action} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.quickRow}>
              {QUICK_PROMPTS.map((p) => (
                <TouchableOpacity key={p} style={styles.quickChip} onPress={() => send(p)} disabled={loading}>
                  <Text style={styles.quickChipText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
              <Text style={[styles.bubbleText, item.role === 'user' && { color: tc.canvas }]}>{item.text}</Text>
            </View>
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={tc.textMuted} />
                <Text style={styles.emptyTitle}>Tell me what to change</Text>
                <Text style={styles.emptySub}>
                  "Add a banana to lunch", "remove the chapati", or "make dinner higher protein" — then review my changes before applying.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={tc.action} />
                <Text style={styles.loadingText}>AI is reviewing your log…</Text>
              </View>
            ) : null
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {proposed.length > 0 && (
          <View style={styles.proposalCard}>
            <Text style={styles.proposalTitle}>PROPOSED CHANGES</Text>
            {proposed.map(renderProposal)}
            <View style={styles.proposalBtns}>
              <TouchableOpacity style={styles.discardBtn} onPress={() => setProposed([])}>
                <Text style={styles.discardText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyChanges} disabled={applying}>
                {applying ? (
                  <ActivityIndicator size="small" color={tc.canvas} />
                ) : (
                  <Text style={styles.applyText}>Apply {proposed.length > 0 ? `(${proposed.length})` : ''}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Tell the AI what to add / remove / change…"
            placeholderTextColor={tc.textMuted}
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.35 }]}
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
          >
            {loading ? <ActivityIndicator size="small" color={tc.canvas} /> : <Ionicons name="arrow-up" size={16} color={tc.canvas} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tc.canvas,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  flex: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: ts.gutter,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tc.border,
  },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: tc.textPrimary, letterSpacing: -0.3 },
  iconBtn: { padding: 8, borderRadius: tr.full },
  list: { flex: 1 },
  listContent: { padding: ts.gutter, gap: 10, paddingBottom: 16 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tr.full,
    backgroundColor: tc.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  quickChipText: { fontSize: 11, fontWeight: '600', color: tc.textSecondary },
  bubble: {
    maxWidth: '85%',
    borderRadius: tr.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: tc.action,
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: tc.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 13, lineHeight: 19, color: tc.textPrimary },
  emptyWrap: { alignItems: 'center', paddingTop: 50, gap: 10, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: tc.textPrimary },
  emptySub: { fontSize: 12, color: tc.textMuted, textAlign: 'center', lineHeight: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  loadingText: { fontSize: 12, color: tc.textSecondary },
  proposalCard: {
    backgroundColor: tc.surfaceRaised,
    borderTopLeftRadius: tr.xl,
    borderTopRightRadius: tr.xl,
    padding: ts.gutter,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.borderFocus,
  },
  proposalTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: tc.textMuted,
    letterSpacing: 1.4,
  },
  proposalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  proposalReason: { fontSize: 13, fontWeight: '600', color: tc.textPrimary },
  proposalItems: { fontSize: 11, color: tc.textMuted, marginTop: 1 },
  proposalEntryId: { fontSize: 9, color: tc.textMuted, marginTop: 1 },
  proposalBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  discardBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: tr.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  discardText: { fontSize: 13, fontWeight: '600', color: tc.textSecondary },
  applyBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: tr.lg,
    backgroundColor: tc.action,
  },
  applyText: { fontSize: 13, fontWeight: '700', color: tc.canvas },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: ts.gutter,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tc.border,
  },
  input: {
    flex: 1,
    backgroundColor: tc.surface,
    borderRadius: tr.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: tc.textPrimary,
    fontSize: 13,
    maxHeight: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tc.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
