import React, { useState } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore } from '../store';

export default function AIRecommendationsScreen() {
  const navigation = useNavigation();
  const { chatHistory, addChatMessage } = useInvestmentsStore();
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;

    const query = inputText.trim();
    addChatMessage('user', query);
    setInputText('');

    // Generate a mock smart investment response matching the portfolio
    setTimeout(() => {
      let reply = "Based on your goals and current profile, I suggest rebalancing to increase allocation in small-cap funds slightly. Your Parag Parikh Flexi Cap allocation is currently at 45%, which is optimal.";
      if (query.toLowerCase().includes('reliance') || query.toLowerCase().includes('stock')) {
        reply = "Your RELIANCE holdings are showing a healthy +9.3% return. However, it represents 35% of your single-stock holdings. Consider taking partial profits and moving funds into a debt instrument or index fund to match your Retirement 2045 risk scale.";
      }
      addChatMessage('assistant', reply);
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Safety Compliance Disclaimer Banner */}
      <View style={styles.disclaimerBanner}>
        <Ionicons name="alert-circle" size={16} color={colors.onPrimaryContainer} />
        <Text style={styles.disclaimerText}>
          All AI recommendations are suggestions only. Confirm pricing and market conditions before trading.
        </Text>
      </View>

      {/* Header */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>AI Portfolio Advisor</Text>
          <Text style={styles.headerSubtitle}>Goal-aware allocations</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Chat History View */}
      <ScrollView
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        ref={(ref) => ref?.scrollToEnd({ animated: true })}
      >
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
      </ScrollView>

      {/* Input row */}
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
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="send" size={18} color="#ffffff" />
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
});
