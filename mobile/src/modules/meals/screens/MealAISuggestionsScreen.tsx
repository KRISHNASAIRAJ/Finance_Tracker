/**
 * MealAISuggestionsScreen — Chat with AI for personalized meal suggestions against the health profile.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useMealStore, MealAIMessage } from '../store';
import { supabase } from '../../../services/supabaseClient';
import { saveAIChatToFile } from '../../../services/chatExportService';
import { tc, ts, tr, card, labelMuted } from '../../../shared/theme/tracend';

const HEALTH_PROFILE = `Project 65 — Body Recomposition Protocol
* Current: 54kg, 170.6cm, BMI 18.5 (underweight). Target: 65kg at ~0.4 kg/week. Age 23 Male.
* Daily targets: 2,650 kcal (range 2,600-2,800), 140g protein (~2.6 g/kg), 340g carbs, 85g fat, 2.5-3L water.
* One cooking block: 5:30-7:45 AM makes breakfast + lunch + dinner's protein doubled. Office 8 AM-6 PM (40min commute).
* Uses Anveshan groundnut oil, ghee. Airfryer, blender, induction, gas-stove.
* Fixed daily dose: pumpkin+sesame seeds, 1 fruit (banana/avocado/pineapple), 1 scoop Comix plant protein (~24g).
* Only Greek yoghurt (Epigamia/Milkymist), no curd/buttermilk.
* No non-veg Wednesday and Thursday. Fish/prawns only alternate Saturdays, else chicken.
* Homemade peanut butter. Uses milkbread, multigrain, sourdough (Swisscastle, Theobroma).
* Wakes 5:30 AM Mon-Thu, 7 AM Fri-Sun. Sleeps 10-11 PM.
* Past Abdominal TB, took antibiotics. Low immunity.
* Goals: 65kg, immunity, skin glow, eliminate grey hair, healthy gut.
* Weigh weekly (not daily), track progress with photos monthly.`;

export default function MealAISuggestionsScreen() {
  const navigation = useNavigation();
  const { aiMessages, addAIMessage, getTodayTotals, entries, dailyCalorieTarget, dailyProteinTarget } = useMealStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const todayTotals = getTodayTotals();
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter((e) => e.date.slice(0, 10) === today);

  const buildTodayContext = () => {
    let ctx = `Today's food log:\n`;
    if (todayEntries.length === 0) {
      ctx += 'No meals logged yet today.\n';
    } else {
      for (const entry of todayEntries) {
        ctx += `\n${entry.mealType.toUpperCase()}:\n`;
        for (const item of entry.items) {
          ctx += `- ${item.name} (${item.calories}cal, ${item.protein}g P, ${item.carbs}g C, ${item.fat}g F)\n`;
        }
      }
    }
    ctx += `\nDaily targets: ${dailyCalorieTarget}cal, ${dailyProteinTarget}g protein\n`;
    ctx += `So far today: ${todayTotals.calories}cal, ${todayTotals.protein}g P, ${todayTotals.carbs}g C, ${todayTotals.fat}g F\n`;
    return ctx;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    addAIMessage('user', text);

    setLoading(true);
    try {
      const ctx = buildTodayContext();
      const recentMessages = aiMessages
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.text }));
      const { data, error } = await supabase.functions.invoke('ai-meal-suggest', {
        body: {
          query: text,
          healthProfile: HEALTH_PROFILE,
          todayContext: ctx,
          conversation: recentMessages,
        },
      });

      if (error) throw error;
      const reply = data?.suggestion || 'Sorry, I could not generate a suggestion.';
      addAIMessage('assistant', reply);
    } catch (e: any) {
      addAIMessage('assistant', `Error: ${e?.message || 'Could not reach AI service. Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  }, [aiMessages]);

  const renderMessage = ({ item }: { item: MealAIMessage }) => (
    <View style={[styles.msgBubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
      <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>
        {item.text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={tc.action} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Meal AI</Text>
        <View style={{ width: 40 }}>
          {aiMessages.length > 0 && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => saveAIChatToFile(
                aiMessages.map((m) => ({ role: m.role, text: m.text, date: m.date })),
                'Meal AI Chat'
              )}
            >
              <Ionicons name="download-outline" size={20} color={tc.action} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {aiMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="sparkles" size={36} color={tc.action} />
            </View>
            <Text style={styles.emptyTitle}>Meal AI Assistant</Text>
            <Text style={styles.emptySub}>
              Ask for meal suggestions, recipes, or nutrition advice based on your health profile and today's food log.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={aiMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {(() => {
            const remaining = dailyProteinTarget - todayTotals.protein;
            const remainingCal = dailyCalorieTarget - todayTotals.calories;
            const prompts: string[] = [];
            if (todayEntries.length === 0) {
              prompts.push('Suggest a high-protein breakfast for today');
              prompts.push('What should I eat for lunch to start my day right?');
              prompts.push('Give me meal ideas for weight gain');
            } else {
              if (remaining > 0) {
                prompts.push(`How can I get ${remaining.toFixed(0)}g more protein today?`);
              }
              if (remainingCal > 200) {
                prompts.push(`Suggest a ${remainingCal.toFixed(0)}cal meal for my remaining intake`);
              }
              prompts.push('Suggest a high-protein dinner');
              prompts.push('What snacks can I have to hit my targets?');
            }
            return prompts.map((q, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickChip}
                onPress={() => { setInput(q); }}
              >
                <Text style={styles.quickChipText}>{q}</Text>
              </TouchableOpacity>
            ));
          })()}
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={tc.action} />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.chatInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about meals, nutrition..."
            placeholderTextColor={tc.textMuted}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.3 }]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={18} color={tc.canvas} />
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
  appBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tc.textPrimary,
    letterSpacing: -0.3,
  },
  iconBtn: { padding: 8, borderRadius: tr.full },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ts.gutter,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tc.actionDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  emptySub: {
    fontSize: 14,
    color: tc.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },

  // Quick actions
  quickActions: {
    paddingHorizontal: ts.gutter,
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  quickChip: {
    padding: 12,
    borderRadius: tr.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.borderStrong,
    backgroundColor: tc.actionDim,
  },
  quickChipText: {
    fontSize: 13,
    color: tc.action,
    fontWeight: '500',
  },

  // Chat list
  chatList: {
    padding: ts.gutter,
    gap: 10,
    paddingBottom: 12,
  },
  msgBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: tr.lg,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: tc.action,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: tc.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  userText: {
    fontSize: 14,
    color: tc.canvas,
    lineHeight: 20,
    fontWeight: '500',
  },
  assistantText: {
    fontSize: 14,
    color: tc.textPrimary,
    lineHeight: 20,
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: ts.gutter,
    paddingVertical: 6,
  },
  loadingText: {
    fontSize: 12,
    color: tc.textSecondary,
  },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: ts.gutter,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tc.border,
  },
  chatInput: {
    flex: 1,
    backgroundColor: tc.surface,
    borderRadius: tr.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: tc.textPrimary,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: tc.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
