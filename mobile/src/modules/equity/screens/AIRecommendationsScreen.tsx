/**
 * AIRecommendationsScreen — chat interface for goal-aware portfolio recommendations
 * powered by Groq Llama. Saves conversation history.
 */
import React, { useState, useRef } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore } from '../store';
import { askPortfolioRecommend } from '../../../services/aiServices';

export default function AIRecommendationsScreen() {
  const navigation = useNavigation();
  const { chatHistory, addChatMessage, holdings, goals } = useInvestmentsStore();
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const getSuggestionPrompts = (): string[] => {
    const lastUser = [...chatHistory].reverse().find((m) => m.sender === 'user')?.text ?? '';
    const lower = lastUser.toLowerCase();
    const prompts: string[] = [];

    if (
      lower.includes('hospital') ||
      lower.includes('fundamental') ||
      lower.includes('arpob') ||
      lower.includes('healthcare') ||
      lower.includes('apollo') ||
      lower.includes('max health') ||
      lower.includes('yatharth') ||
      lower.includes('fortis') ||
      lower.includes('narayana') ||
      lower.includes('kims') ||
      lower.includes('rainbow') ||
      lower.includes('aster')
    ) {
      prompts.push(
        'Which hospital stock is a good high-risk/high-reward pick?',
        'Compare the payer mix and expansion plans of two hospital stocks',
        'What red flags should I watch for hospital stocks this quarter?',
        'Is this hospital stock a good buy after its capex-driven decline?'
      );
    } else if (lower.includes('sell') || lower.includes('exit')) {
      prompts.push(
        'Which of my holdings have the worst P&L?',
        'What are the tax implications of selling (STCG/LTCG)?',
        'What should I do with my losing positions?'
      );
    } else if (
      lower.includes('buy') ||
      lower.includes('add') ||
      lower.includes('diversif') ||
      lower.includes('allocate')
    ) {
      prompts.push(
        'What is my current concentration risk?',
        'How much should I allocate to each asset class?',
        'Suggest stocks across different sectors to diversify'
      );
    } else {
      prompts.push(
        'Review my portfolio and suggest rebalancing',
        'What stocks should I add next to diversify?',
        'Am I on track with my investment goals?'
      );
    }

    const topHolding = [...holdings]
      .sort((a, b) => b.quantity * b.currentPrice - a.quantity * a.currentPrice)[0];
    if (topHolding) {
      prompts.push(
        `Is ${topHolding.name} too big a part of my portfolio?`,
        `Analyze ${topHolding.name} fundamentals`
      );
    }
    if (goals.length > 0) {
      prompts.push(`Am I on track to reach ${goals[0].name}?`);
    }

    return [...new Set(prompts)].slice(0, 4);
  };

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const query = inputText.trim();
    addChatMessage('user', query);
    setInputText('');
    scrollToEnd();

    setLoading(true);
    try {
      const result = await askPortfolioRecommend(
        holdings.map(h => ({
          symbol: h.symbol,
          name: h.name,
          type: h.type,
          quantity: h.quantity,
          avgPrice: h.avgPrice,
          currentPrice: h.currentPrice,
          allocation: h.allocation,
        })),
        goals.map(g => ({
          name: g.name,
          target: g.target,
          current: g.current,
          dueDate: g.dueDate,
        })),
        query
      );

      let reply = result.question || result.summary || 'No analysis returned. Please try again.';
      if (result.recommendations.length > 0) {
        const recs = result.recommendations.map(
          r => `\n\n• ${r.asset}: ${r.action.toUpperCase()} — ${r.reason}`
        ).join('');
        reply += recs;
      }
      addChatMessage('assistant', reply);
    } catch {
      addChatMessage('assistant', 'Sorry, I couldn\'t process your request. Please try again.');
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>AI Portfolio Advisor</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={scrollToEnd}
      >
        {chatHistory.length === 0 && (
          <View style={styles.emptyChat}>
            <Ionicons name="sparkles" size={28} color={colors.outline} />
            <Text style={styles.emptyTitle}>AI Portfolio Advisor</Text>
            <Text style={styles.emptySub}>
              Ask about rebalancing, diversification, goal progress,{'\n'}
              or run a fundamental analysis on a specific stock.{'\n'}
              Your holdings and goals will be analyzed.
            </Text>
          </View>
        )}

        {chatHistory.length === 0 && (
          <View style={styles.quickActions}>
            {[
              'Review my portfolio and suggest rebalancing',
              'What stocks should I add next to diversify?',
              'Am I on track with my investment goals?',
              'Any stocks I should consider selling?',
              'Analyze a hospital stock fundamentally (ARPOB, payer mix, expansion)',
              'Fundamental analysis: what metrics matter for hospital stocks?',
            ].map((q, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickChip}
                onPress={() => { setInputText(q); }}
              >
                <Text style={styles.quickChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {chatHistory.map((msg) => {
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
                {new Date(msg.date).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          );
        })}
        {loading && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
        {chatHistory.length > 0 && !loading && (
          <View style={styles.quickActions}>
            <Text style={styles.suggestLabel}>SUGGESTED</Text>
            {getSuggestionPrompts().map((q, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickChip}
                onPress={() => { setInputText(q); }}
              >
                <Text style={styles.quickChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.inputField}
            placeholder="Ask about rebalancing your portfolio..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, loading && styles.sendDisabled]}
            onPress={handleSend}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.onPrimaryContainer} />
            ) : (
              <Ionicons name="send" size={18} color={colors.onPrimaryContainer} />
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
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
    marginRight: 8,
  },
  chatScroll: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  chatContent: {
    padding: spacing.containerPadding,
    gap: 16,
    paddingBottom: 24,
  },
  emptyChat: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  emptySub: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: rounded.lg,
    gap: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primaryContainer,
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: colors.onPrimaryContainer,
  },
  assistantText: {
    color: colors.onSurface,
  },
  messageTime: {
    fontSize: 9,
    color: colors.onSurfaceVariant,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 12,
  },
  inputField: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.onSurface,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: rounded.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
  quickActions: {
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 8,
  },
  suggestLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
    marginBottom: 2,
  },
  quickChip: {
    backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quickChipText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
});
