/**
 * CardChatScreen — AI chat over card terms & conditions via the Groq-backed
 * ai-tnc-query edge function, with chat export support.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { askCardTnC } from '../../../services/aiServices';
import { saveAIChatToFile } from '../../../services/chatExportService';
import { useFinanceStore } from '../store';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';

type CardChatRouteProp = RouteProp<FinanceStackParamList, 'CardChat'>;

interface ChatMsg {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  date: string;
}

let msgId = 0;
function makeId() { return `cardchat_${++msgId}_${Date.now()}`; }

export default function CardChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<CardChatRouteProp>();
  const documentId = (route.params as any)?.documentId;
  const documentName = (route.params as any)?.documentName;

  const { transactions, cards, receivables, fixedExpenses, getTotalBalance } = useFinanceStore();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const addMessage = (sender: 'user' | 'assistant', text: string) => {
    const msg: ChatMsg = { id: makeId(), sender, text, date: new Date().toISOString() };
    setMessages(prev => [...prev, msg]);
    return msg;
  };

  useEffect(() => {
    if (documentId && documentName) {
      addMessage('assistant', `I'm ready to answer questions about your "${documentName}" document. Ask me anything about its terms and conditions.`);
    }
  }, []);

  const buildTransactionContext = () => {
    const recent = transactions.slice(0, 20);
    if (recent.length === 0) return '';
    let ctx = 'Recent Transactions:\n';
    for (const tx of recent) {
      const date = new Date(tx.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      const amt = `₹${(Math.abs(tx.amount) / 100).toFixed(0)}`;
      ctx += `- ${date}: ${tx.category} · ${amt}`;
      if (tx.paymentMode) ctx += ` via ${tx.paymentMode}`;
      ctx += '\n';
    }
    return ctx;
  };

  // Full finance context: aggregates + masked cards. NEVER includes full card
  // numbers, CVV, PIN or expiry — only the last-4 "endingWith" suffix.
  const buildFinanceContext = () => {
    const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalBalance = typeof getTotalBalance === 'function' ? getTotalBalance() : 0;
    const monthTxs = transactions.filter((t) => new Date(t.date) >= monthStart && new Date(t.date) < monthEnd);
    const monthlySpend = monthTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const monthlyIncome = monthTxs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

    const cardLines = (cards || []).map((c) => {
      const billLeft = c.billAmount ? Math.max(0, c.billAmount - (c.paidAmount || 0)) : c.balance;
      const due = c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
      return `- ${c.name} (••••${c.endingWith || '—'} ${c.network}): bill left ${fmt(billLeft)}, due ${due}`;
    });

    const catTotals: Record<string, number> = {};
    monthTxs.filter((t) => t.amount < 0).forEach((t) => {
      catTotals[t.category] = (catTotals[t.category] || 0) + Math.abs(t.amount);
    });
    const topCats = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amt]) => `- ${cat}: ${fmt(amt)}`)
      .join('\n');

    const lent = (receivables || []).filter((r) => r.type === 'lent').reduce((s, r) => s + (r.amount - (r.paidAmount || 0)), 0);
    const borrowed = (receivables || []).filter((r) => r.type === 'borrowed').reduce((s, r) => s + (r.amount - (r.paidAmount || 0)), 0);
    const unpaidFixed = (fixedExpenses || [])
      .filter((f) => f.lastPaidMonth !== currentMonthStr)
      .reduce((s, f) => s + f.amount, 0);

    const recent = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15)
      .map((tx) => {
        const d = new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const amt = fmt(Math.abs(tx.amount));
        return `- ${d}: ${tx.category} · ${tx.type === 'income' ? '+' : '-'}${amt}${tx.paymentMode ? ` via ${tx.paymentMode}` : ''}`;
      })
      .join('\n');

    return `## User's financial summary (the user's own personal data from their device)
Bank account total: ${fmt(totalBalance)}
This month spend: ${fmt(monthlySpend)}
This month income: ${fmt(monthlyIncome)}
Net lent outstanding: ${fmt(lent)}
Net borrowed outstanding: ${fmt(borrowed)}
Unpaid fixed expenses this month: ${fmt(unpaidFixed)}

Credit cards (masked, last 4 digits only):
${cardLines.length ? cardLines.join('\n') : '- none'}

Top spending categories this month:
${topCats || '- none'}

Recent transactions:
${recent || '- none'}`;
  };

  const handleSend = async (text?: string) => {
    const query = (text || inputText).trim();
    if (!query || loading) return;

    if (!text) setInputText('');
    addMessage('user', query);
    scrollToEnd();

    setLoading(true);
    try {
      const txCtx = buildTransactionContext();
      const financeCtx = buildFinanceContext();
      const result = await askCardTnC(query, documentId, txCtx, financeCtx);
      addMessage('assistant', result.answer);
    } catch {
      addMessage('assistant', 'Sorry, I couldn\'t process your question. Please try again.');
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  };

  const getContextualPrompts = () => {
    if (documentId) {
      return [
        'Summarize the key reward categories',
        'What are the annual fee and fee waiver conditions?',
        'List all excluded categories',
        'What is the fuel surcharge policy?',
      ];
    }
    const prompts: string[] = [];
    const cardNames = cards.map((c) => c.name).slice(0, 4);
    if (cards.length > 0) {
      const firstCard = cardNames[0];
      prompts.push(`What's the best use for ${firstCard}?`);
      if (cards.length > 1) {
        prompts.push(`Compare ${cardNames[0]} vs ${cardNames[1]}`);
      }
    }
    const totalSpent = transactions
      .filter((t) => t.amount < 0)
      .slice(0, 10)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    if (totalSpent > 0) {
      prompts.push(`Analyze my recent spending of ₹${(totalSpent / 100).toFixed(0)}`);
    }
    prompts.push('How much do I owe on all my credit cards?');
    prompts.push('What is my net worth?');
    prompts.push('Which of my cards gives the best fuel rewards?');
    prompts.push('Help me pick the right card for online shopping');
    return prompts.slice(0, 4);
  };

  const prompts = getContextualPrompts();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {documentName || 'Card AI Assistant'}
          </Text>
          {documentName ? (
            <Text style={styles.appBarSub}>Document Q&A</Text>
          ) : null}
        </View>
        <View style={{ width: 32 }}>
          {messages.length > 0 && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => saveAIChatToFile(
                messages.map((m) => ({ role: m.sender, text: m.text, date: m.date })),
                'Card AI Chat'
              )}
            >
              <Ionicons name="download-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={scrollToEnd}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && (
          <View style={styles.emptyChat}>
            <Ionicons name="sparkles" size={32} color={colors.primary} />
            <Text style={styles.emptyTitle}>
              {documentId ? 'Ask About This Document' : 'Card & Spending AI'}
            </Text>
            <Text style={styles.emptySub}>
              {documentId
                ? 'Ask questions about the terms and conditions\nof your uploaded card document.'
                : 'Ask about credit cards, cashback, fees, comparisons,\nor get insights on your spending patterns.'}
            </Text>
          </View>
        )}

        {/* Quick Prompts */}
        <View style={styles.quickQueries}>
          {prompts.map((q, i) => (
            <TouchableOpacity
              key={i}
              style={styles.quickPill}
              onPress={() => handleSend(q)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickPillText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
                {msg.text}
              </Text>
              <Text style={styles.messageTime}>
                {new Date(msg.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        })}
        {loading && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.inputField}
            placeholder={
              documentId
                ? 'Ask about this document...'
                : 'Ask about cards, cashback, or spending...'
            }
            placeholderTextColor={colors.onSurfaceVariant}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, loading && styles.sendDisabled]}
            onPress={() => handleSend()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Ionicons name="send" size={18} color={colors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  appBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 56, paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 6, borderRadius: rounded.full },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  appBarSub: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 1 },
  chatScroll: { flex: 1 },
  chatContent: { padding: spacing.containerPadding, gap: 12, paddingBottom: 24 },
  emptyChat: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  emptySub: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 18 },
  quickQueries: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 8 },
  quickPill: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: rounded.DEFAULT,
    backgroundColor: `${colors.primary}12`, borderWidth: StyleSheet.hairlineWidth, borderColor: `${colors.primary}20`,
  },
  quickPillText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  messageBubble: { maxWidth: '82%', padding: 14, borderRadius: rounded.lg, gap: 6 },
  userBubble: {
    alignSelf: 'flex-end', backgroundColor: colors.primaryContainer, borderBottomRightRadius: 2,
  },
  assistantBubble: {
    alignSelf: 'flex-start', backgroundColor: colors.surfaceContainer,
    borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 2,
  },
  messageText: { fontSize: 14, lineHeight: 20 },
  userText: { color: colors.textPrimary },
  assistantText: { color: colors.onSurface },
  messageTime: { fontSize: 9, color: colors.onSurfaceVariant, alignSelf: 'flex-end' },
  inputContainer: {
    flexDirection: 'row', padding: 12, borderTopWidth: 1,
    borderTopColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center', gap: 12,
  },
  inputField: {
    flex: 1, backgroundColor: colors.surfaceContainer,
    borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.full, paddingHorizontal: 16, paddingVertical: 10,
    color: colors.onSurface, fontSize: 14,
  },
  sendButton: {
    width: 40, height: 40, borderRadius: rounded.full,
    backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
});
