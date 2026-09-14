/**
 * MealPlannerScreen — plan what to cook for upcoming days (or log what was
 * cooked). One card per day, four slots (breakfast/lunch/snack/dinner).
 * Pick from your recipe library or type a custom meal. Long-press a slot to
 * clear it. "Ask AI" plans tomorrow from your diet profile via ai-meal-suggest.
 */
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { tc } from '../../../shared/theme/tracend';
import Entrance from '../../../shared/components/Entrance';
import { istDayKey } from '../../habits/habits';
import {
  useMealPlannerStore,
  MealPlanItem,
  MealSlot,
  MEAL_SLOTS,
  plansForDate,
} from '../plannerStore';
import { usePersonalStore, Recipe } from '../../personal/store';
import { useMealStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { supabase } from '../../../services/supabaseClient';
import { MoreStackParamList } from '../../../navigation/RootNavigator';

type Nav = { navigate: (screen: keyof MoreStackParamList) => void };

function dayKeyOffset(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return istDayKey(d);
}

function dayLabel(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  const label = d.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
  return label;
}

function prettyDate(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export default function MealPlannerScreen() {
  const navigation = useNavigation<Nav>();
  const plans = useMealPlannerStore((s) => s.plans);
  const setPlan = useMealPlannerStore((s) => s.setPlan);
  const clearPlan = useMealPlannerStore((s) => s.clearPlan);
  const toggleDone = useMealPlannerStore((s) => s.toggleDone);
  const recipes = usePersonalStore((s) => s.recipes);
  const mealEntries = useMealStore((s) => s.entries);
  const addEntry = useMealStore((s) => s.addEntry);
  const { user } = useAuth();

  const todayK = dayKeyOffset(0);
  // 7 days: yesterday → +5 (plan ahead "for tomorrow")
  const dayKeys = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dayKeyOffset(i - 1)),
    []
  );

  const [pickerFor, setPickerFor] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const filteredRecipes = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, pickerQuery]);

  const pickRecipe = (r: Recipe) => {
    if (!pickerFor) return;
    setPlan(pickerFor.date, pickerFor.slot, { title: r.title, recipeId: r.id }, user?.id);
    setPickerFor(null);
    setPickerQuery('');
    setCustomTitle('');
  };

  const pickCustom = () => {
    if (!pickerFor) return;
    const title = customTitle.trim();
    if (!title) return;
    setPlan(pickerFor.date, pickerFor.slot, { title }, user?.id);
    setPickerFor(null);
    setPickerQuery('');
    setCustomTitle('');
  };

  /** Log a planned meal as eaten (into the meal logger). */
  const logEaten = (item: MealPlanItem) => {
    addEntry(
      {
        date: new Date().toISOString(),
        mealType: item.slot,
        items: [],
        notes: `Planned meal: ${item.title}${item.notes ? ` — ${item.notes}` : ''}`,
      },
      user?.id
    );
    if (!item.done) toggleDone(item.date, item.slot, user?.id);
  };

  /** Ask the meal AI to plan tomorrow's cooking. */
  const askAiTomorrow = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const tomorrow = dayKeyOffset(1);
      const todayContext = mealEntries
        .filter((e) => e.date.slice(0, 10) === todayK)
        .map((e) => `${e.mealType}: ${e.items.map((i) => i.name).join(', ') || e.notes}`)
        .join('\n') || 'nothing logged yet today';
      const { data, error } = await supabase.functions.invoke('ai-meal-suggest', {
        body: {
          query: `Plan tomorrow's cooking (${prettyDate(tomorrow)}). Give me exactly 4 lines, one per slot, in this format:\nBREAKFAST: <meal with kcal/protein>\nLUNCH: <meal with kcal/protein>\nSNACK: <meal with kcal/protein>\nDINNER: <meal with kcal/protein>\nAll home-cookable in my morning 5:30-7:45 AM cooking window.`,
          todayContext,
        },
      });
      if (error) throw error;
      const suggestion = (data?.suggestion as string) || '';
      const lines = suggestion.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        const m = line.match(/^\s*(BREAKFAST|LUNCH|SNACK|DINNER)\s*[:\-]\s*(.+)$/i);
        if (!m) continue;
        const slot = m[1].toUpperCase().toLowerCase() as MealSlot;
        const title = m[2].replace(/\*\*/g, '').trim();
        if (MEAL_SLOTS.some((s) => s.key === slot)) {
          setPlan(tomorrow, slot, { title }, user?.id);
        }
      }
    } catch {
      /* best-effort — user can still plan manually */
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (navigation as any).goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Meal Planner</Text>
        <View style={styles.appBarSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Entrance index={0}>
          <TouchableOpacity style={styles.aiCard} onPress={askAiTomorrow} disabled={aiLoading} activeOpacity={0.8}>
            {aiLoading ? (
              <ActivityIndicator color="#4fdbcc" size="small" />
            ) : (
              <Ionicons name="sparkles" size={18} color="#0A0A10" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.aiTitle}>Plan tomorrow with AI</Text>
              <Text style={styles.aiSub}>
                4 meals matched to your diet profile + today's log
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />
          </TouchableOpacity>
        </Entrance>

        {dayKeys.map((dk, di) => {
          const bySlot = plansForDate(plans, dk);
          const isToday = dk === todayK;
          const isTomorrow = dk === dayKeyOffset(1);
          const plannedCount = MEAL_SLOTS.filter((s) => bySlot[s.key]).length;
          return (
            <Entrance key={dk} index={di + 1}>
              <View style={[styles.dayCard, isToday && styles.dayCardToday]}>
                <View style={styles.dayHeadRow}>
                  <View>
                    <Text style={[styles.dayTitle, isToday && styles.dayTitleToday]}>
                      {dayLabel(dk)}
                      {isToday && ' · TODAY'}
                      {isTomorrow && ' · TOMORROW'}
                    </Text>
                    <Text style={styles.daySub}>
                      {prettyDate(dk)} · {plannedCount}/4 planned
                    </Text>
                  </View>
                </View>
                <View style={styles.slotList}>
                  {MEAL_SLOTS.map((s) => {
                    const item = bySlot[s.key];
                    return (
                      <TouchableOpacity
                        key={s.key}
                        style={styles.slotRow}
                        onPress={() => setPickerFor({ date: dk, slot: s.key })}
                        onLongPress={() => item && clearPlan(dk, s.key, user?.id)}
                        delayLongPress={400}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.slotEmoji}>{s.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.slotLabel}>{s.label.toUpperCase()}</Text>
                          {item ? (
                            <Text style={[styles.slotValue, item.done && styles.slotValueDone]} numberOfLines={2}>
                              {item.title}
                            </Text>
                          ) : (
                            <Text style={styles.slotEmpty}>+ tap to plan</Text>
                          )}
                        </View>
                        {item && (
                          <TouchableOpacity
                            style={[styles.eatBtn, item.done && styles.eatBtnDone]}
                            onPress={() => logEaten(item)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons
                              name={item.done ? 'checkmark' : 'restaurant-outline'}
                              size={13}
                              color={item.done ? '#0A0A10' : '#4fdbcc'}
                            />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Entrance>
          );
        })}
      </ScrollView>

      {/* Slot picker */}
      <Modal visible={!!pickerFor} transparent animationType="fade" onRequestClose={() => setPickerFor(null)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setPickerFor(null)} activeOpacity={1}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pickerFor ? `${MEAL_SLOTS.find((s) => s.key === pickerFor.slot)?.label} · ${prettyDate(pickerFor.date)}` : ''}
            </Text>

            <TextInput
              style={styles.modalSearch}
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder="Search your recipes…"
              placeholderTextColor={tc.textMuted}
            />
            <ScrollView style={styles.recipeList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {filteredRecipes.map((r) => (
                <TouchableOpacity key={r.id} style={styles.recipeRow} onPress={() => pickRecipe(r)} activeOpacity={0.75}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipeTitle} numberOfLines={1}>{r.title}</Text>
                    <Text style={styles.recipeMeta}>
                      {r.prepTime} · {r.calories}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={18} color="#4fdbcc" />
                </TouchableOpacity>
              ))}
              {filteredRecipes.length === 0 && (
                <Text style={styles.recipeEmpty}>No recipes match — type a custom meal below</Text>
              )}
            </ScrollView>

            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={customTitle}
                onChangeText={setCustomTitle}
                placeholder="…or type a custom meal"
                placeholderTextColor={tc.textMuted}
                onSubmitEditing={pickCustom}
              />
              <TouchableOpacity
                style={[styles.customBtn, !customTitle.trim() && { opacity: 0.4 }]}
                onPress={pickCustom}
                disabled={!customTitle.trim()}
              >
                <Text style={styles.customBtnText}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingHorizontal: spacing.containerPadding,
    paddingVertical: 8,
    gap: 8,
  },
  appBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  appBarSide: { width: 40, height: 40 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapMd,
    paddingBottom: 100,
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(79,219,204,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,219,204,0.35)',
    borderRadius: rounded.xl,
    padding: 16,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: tc.textPrimary,
  },
  aiSub: {
    fontSize: 11,
    color: tc.textMuted,
    marginTop: 2,
  },
  dayCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: rounded.xl,
    padding: 16,
    gap: 12,
  },
  dayCardToday: {
    borderColor: 'rgba(139,149,255,0.45)',
    backgroundColor: 'rgba(139,149,255,0.07)',
  },
  dayHeadRow: { flexDirection: 'row', alignItems: 'center' },
  dayTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: tc.textPrimary,
  },
  dayTitleToday: { color: '#8b95ff' },
  daySub: {
    fontSize: 11,
    color: tc.textMuted,
    marginTop: 2,
  },
  slotList: { gap: 4 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: rounded.md,
  },
  slotEmoji: { fontSize: 15 },
  slotLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
  },
  slotValue: {
    fontSize: 13.5,
    fontWeight: '600',
    color: tc.textPrimary,
    marginTop: 1,
  },
  slotValueDone: {
    color: tc.textMuted,
    textDecorationLine: 'line-through',
    textDecorationColor: 'rgba(79,219,204,0.6)',
  },
  slotEmpty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 1,
  },
  eatBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(79,219,204,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eatBtnDone: {
    backgroundColor: '#4fdbcc',
    borderColor: '#4fdbcc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#14141F',
    borderRadius: rounded.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSearch: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: rounded.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tc.textPrimary,
  },
  recipeList: { maxHeight: 260 },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  recipeTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: tc.textPrimary,
  },
  recipeMeta: {
    fontSize: 11,
    color: tc.textMuted,
    marginTop: 1,
  },
  recipeEmpty: {
    fontSize: 12,
    color: tc.textMuted,
    paddingVertical: 12,
    textAlign: 'center',
  },
  customRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: rounded.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tc.textPrimary,
  },
  customBtn: {
    backgroundColor: '#4fdbcc',
    borderRadius: rounded.md,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  customBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A0A10',
  },
});
