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
        }))
      );

      let reply = result.summary;
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
      <View style={styles.disclaimerBanner}>
        <Ionicons name="alert-circle" size={16} color={colors.onPrimaryContainer} />
        <Text style={styles.disclaimerText}>
          AI recommendations are suggestions only. Not investment advice.
        </Text>
      </View>

      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>AI Portfolio Advisor</Text>
          <Text style={styles.headerSubtitle}>Goal-aware allocations · Groq Llama 3.3</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

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
              Ask about rebalancing, diversification, or goal progress.{'\n'}
              Your holdings and goals will be analyzed.
            </Text>
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
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
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
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#ffffff" />
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
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 10,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
    lineHeight: 14,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
    marginRight: 8,
  },
  chatScroll: {
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
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#ffffff',
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
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 12,
  },
  inputField: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
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
});
