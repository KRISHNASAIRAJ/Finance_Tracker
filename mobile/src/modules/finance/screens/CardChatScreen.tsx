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

const QUICK_QUERIES = [
  'Which card is best for online shopping?',
  'What\'s the cashback on IDFC Power+ for fuel?',
  'Compare SBI Cashback vs Amazon Pay ICICI',
  'Which LTF card has the highest rewards?',
];

const DOC_QUERIES = [
  'Summarize the key reward categories',
  'What are the annual fee and fee waiver conditions?',
  'List all excluded categories',
  'What is the fuel surcharge policy?',
];

export default function CardChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<CardChatRouteProp>();
  const documentId = (route.params as any)?.documentId;
  const documentName = (route.params as any)?.documentName;

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

  const handleSend = async (text?: string) => {
    const query = (text || inputText).trim();
    if (!query || loading) return;

    if (!text) setInputText('');
    addMessage('user', query);
    scrollToEnd();

    setLoading(true);
    try {
      const result = await askCardTnC(query, documentId);
      addMessage('assistant', result.answer);
    } catch {
      addMessage('assistant', 'Sorry, I couldn\'t process your question. Please try again.');
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  };

  const queries = documentId ? DOC_QUERIES : QUICK_QUERIES;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {documentName ? `${documentName}` : 'Card AI Assistant'}
          </Text>
          {documentName && (
            <Text style={styles.appBarSub}>Document Q&A</Text>
          )}
        </View>
        <View style={{ width: 32 }} />
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
              {documentId ? 'Ask About This Document' : 'Ask About Any Credit Card'}
            </Text>
            <Text style={styles.emptySub}>
              {documentId
                ? 'Ask questions about the terms and conditions\nof your uploaded card document.'
                : 'I know about SBI Cashback, SimplySAVE, IDFC Power+,\nAmazon Pay ICICI, HSBC Platinum, Slice, Pazapp & more.'}
            </Text>
            <View style={styles.quickQueries}>
              {queries.map((q, i) => (
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
          </View>
        )}

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
            placeholder={
              documentId
                ? 'Ask about this document...'
                : 'Ask me about card rewards, fees, or comparisons...'
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
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: { padding: 6, borderRadius: rounded.full },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  appBarSub: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 1 },
  chatScroll: { flex: 1 },
  chatContent: { padding: spacing.containerPadding, gap: 14, paddingBottom: 24 },
  emptyChat: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  emptySub: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 18 },
  quickQueries: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  quickPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: rounded.full,
    backgroundColor: `${colors.primary}12`, borderWidth: 1, borderColor: `${colors.primary}20`,
  },
  quickPillText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  messageBubble: { maxWidth: '82%', padding: 14, borderRadius: rounded.lg, gap: 6 },
  userBubble: {
    alignSelf: 'flex-end', backgroundColor: colors.primaryContainer, borderBottomRightRadius: 2,
  },
  assistantBubble: {
    alignSelf: 'flex-start', backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderBottomLeftRadius: 2,
  },
  messageText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#ffffff' },
  assistantText: { color: colors.onSurface },
  messageTime: { fontSize: 9, color: colors.onSurfaceVariant, alignSelf: 'flex-end' },
  inputContainer: {
    flexDirection: 'row', padding: 12, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)', backgroundColor: colors.surface,
    alignItems: 'center', gap: 12,
  },
  inputField: {
    flex: 1, backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderRadius: rounded.full, paddingHorizontal: 16, paddingVertical: 10,
    color: colors.onSurface, fontSize: 14,
  },
  sendButton: {
    width: 40, height: 40, borderRadius: rounded.full,
    backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
});
