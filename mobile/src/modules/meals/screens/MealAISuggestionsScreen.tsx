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
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useMealStore, MealAIMessage } from '../store';
import { supabase } from '../../../services/supabaseClient';

const HEALTH_PROFILE = `Conditions
* Current weight is 54.5kg and height is aeound 5.7-5.8ft. Age 23 and Male.
* Uses Anveshan Groundnut oil. Will prefer to use very less oil in my recipes.
* Uses homemade peanut butter, ghee whenever needed, home grown hen eggs.
* Drinks around 2-2.5ltr water per day.
* Wakesup between 5.30-6.00 am from Mon-Thu and 7.00-8.00 am Fri-Sun, sleeps by 10.00-11.00pm.
* Cooks food between 6-7.15am Mon-Thu, no non-veg on Wednesday and Thursday strictly.
* Has airfryer, blender, gas-stove. Yoghurt is favourite (Epigamia/Milkymist).
* Needs at least one fruit daily. Eats flax seeds and pumpkin seeds.
* Uses milkbread, multigrain bread (Swisscastle, Theobroma).
* Primary target: weight gain to 65kgs by end of 2026.
* Lunch: raw rice (180-200ml cup). Prefers rice only in afternoon.
* Past Abdominal TB, took many antibiotics. Low immunity.
* Likes lemon, raw onions, non-veg (chicken, prawns, fish, mutton).
* Prefers eating at home, strictly no frozen items.
* No workouts (timings 8am-6pm, 40min commute each way).
* Goal: weight gain 65kg, immunity boost, skin glow, eliminate grey hair, healthy gut.`;

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
      const { data, error } = await supabase.functions.invoke('ai-meal-suggest', {
        body: {
          query: text,
          healthProfile: HEALTH_PROFILE,
          todayContext: ctx,
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
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Meal AI</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {aiMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="sparkles" size={48} color={colors.primary} />
            <Text style={styles.emptyTitle}>Meal AI Assistant</Text>
            <Text style={styles.emptySub}>
              Ask for meal suggestions, recipes, or nutrition advice based on your health profile and today's food log.
            </Text>
            <View style={styles.quickActions}>
              {[
                'What should I eat for dinner to hit my protein target?',
                'Suggest a high-protein breakfast',
                'Give me meal ideas for weight gain',
              ].map((q, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickChip}
                  onPress={() => { setInput(q); }}
                >
                  <Text style={styles.quickChipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
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

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.chatInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about meals, nutrition..."
            placeholderTextColor={colors.onSurfaceVariant}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0 },
  flex: { flex: 1 },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 64, paddingHorizontal: spacing.containerPadding, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  appBarTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  iconBtn: { padding: 8, borderRadius: rounded.full },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.onSurface, marginTop: 8 },
  emptySub: { fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20 },
  quickActions: { width: '100%', gap: 8, marginTop: 12 },
  quickChip: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  quickChipText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  chatList: { padding: spacing.containerPadding, gap: 12, paddingBottom: 16 },
  msgBubble: { maxWidth: '85%', padding: 12, borderRadius: rounded.lg },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primaryContainer },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  userText: { fontSize: 14, color: '#fff', lineHeight: 20 },
  assistantText: { fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  loadingText: { fontSize: 12, color: colors.onSurfaceVariant },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  chatInput: { flex: 1, backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, paddingHorizontal: 14, paddingVertical: 10, color: colors.onSurface, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
});
