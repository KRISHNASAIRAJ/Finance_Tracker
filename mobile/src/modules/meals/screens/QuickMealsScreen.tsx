/**
 * QuickMealsScreen — one-tap logging from the Recipes Library.
 * Lists recipes as presets; tapping one opens a confirm sheet (meal type, date,
 * editable calories/macros) before logging.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePersonalStore } from '../../personal/store';
import { useMealStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { analyzeMealText } from '../../../services/aiServices';
import { tc, ts, tr, card, labelMuted } from '../../../shared/theme/tracend';
import { getTodayDateString } from '../../../shared/istDate';

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

type RouteParams = {
  QuickMeals: { date?: string } | undefined;
};

const MEAL_META: Record<MealType, { label: string; icon: string; color: string; bg: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline', color: tc.action, bg: tc.actionDim },
  lunch: { label: 'Lunch', icon: 'restaurant-outline', color: tc.amber, bg: 'rgba(226,164,92,0.12)' },
  snack: { label: 'Snack', icon: 'nutrition-outline', color: tc.carbs, bg: tc.carbsBg },
  dinner: { label: 'Dinner', icon: 'moon-outline', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
};

function parseCalories(calStr: string): number {
  const n = parseInt(calStr.replace(/[^0-9.]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

interface DraftItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function QuickMealsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'QuickMeals'>>();
  const recipes = usePersonalStore((s) => s.recipes) || [];
  const addEntry = useMealStore((s) => s.addEntry);
  const { user } = useAuth();
  const paramDate = route.params?.date || getTodayDateString();

  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [item, setItem] = useState<DraftItem | null>(null);
  const [estimating, setEstimating] = useState(false);

  const openRecipe = (title: string, cal: string, ingredients: string[]) => {
    setSelectedTitle(title);
    setItem({
      name: title,
      quantity: '1 serving',
      calories: parseCalories(cal),
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    // Pick default meal slot by time of day
    const h = new Date().getHours();
    setMealType(h < 11 ? 'breakfast' : h < 17 ? 'lunch' : h < 20 ? 'snack' : 'dinner');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void ingredients;
  };

  const estimateMacros = async () => {
    if (!selectedTitle || !item || estimating) return;
    setEstimating(true);
    const recipe = recipes.find((r) => r.title === selectedTitle);
    const prompt = `Estimate macros for this Indian recipe as one serving:
Title: ${selectedTitle}
Ingredients: ${(recipe?.ingredients || []).join(', ')}
Return ONLY JSON: {"name":"...","quantity":"1 serving","calories":N,"protein":N,"carbs":N,"fat":N}`;
    try {
      const result = await analyzeMealText(prompt);
      if (result.items && result.items[0]) {
        setItem({
          name: selectedTitle,
          quantity: result.items[0].quantity || '1 serving',
          calories: result.items[0].calories || item.calories,
          protein: result.items[0].protein || 0,
          carbs: result.items[0].carbs || 0,
          fat: result.items[0].fat || 0,
        });
      }
    } catch {
      // keep manual values
    }
    setEstimating(false);
  };

  const setField = (field: keyof DraftItem, value: string) => {
    if (!item) return;
    if (field === 'quantity' || field === 'name') {
      setItem({ ...item, [field]: value });
    } else {
      const n = parseFloat(value);
      setItem({ ...item, [field]: isNaN(n) ? 0 : n });
    }
  };

  const handleConfirm = () => {
    if (!selectedTitle || !item) return;
    const trimmedName = item.name.trim();
    if (!trimmedName || item.calories <= 0) {
      alert('Recipe name is empty or calories are 0 — adjust before logging.');
      return;
    }
    addEntry(
      {
        date: new Date(paramDate + 'T12:00:00+05:30').toISOString(),
        mealType,
        items: [{
          name: trimmedName,
          quantity: item.quantity,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
        }],
        notes: '',
      },
      user?.id
    );
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={tc.action} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Quick Meals</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => (navigation as any).navigate('RecipesLibrary')}>
          <Ionicons name="add" size={24} color={tc.action} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {recipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={40} color={tc.textMuted} />
            <Text style={styles.emptyTitle}>No recipes in your library</Text>
            <Text style={styles.emptySub}>
              Add recipes in the Recipes Library, then come back here to log them in one tap.
            </Text>
            <TouchableOpacity style={styles.gotoLibraryBtn} onPress={() => (navigation as any).navigate('RecipesLibrary')}>
              <Text style={styles.gotoLibraryText}>Open Recipes Library</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[labelMuted, { marginBottom: 4 }]}>TAP A RECIPE TO LOG IT</Text>
            {recipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={[card, styles.recipeCard]}
                onPress={() => openRecipe(recipe.title, recipe.calories, recipe.ingredients)}
                activeOpacity={0.7}
              >
                <View style={styles.recipeIconWrap}>
                  <Ionicons name="restaurant-outline" size={18} color={tc.carbs} />
                </View>
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
                  <View style={styles.recipeMetaRow}>
                    <Text style={styles.recipeMeta}>{recipe.calories}</Text>
                    {recipe.prepTime ? (
                      <>
                        <View style={styles.metaDot} />
                        <Text style={styles.recipeMeta}>{recipe.prepTime}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={tc.textMuted} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* Confirm Modal */}
      <Modal visible={!!selectedTitle} transparent animationType="slide" onRequestClose={() => setSelectedTitle(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{selectedTitle}</Text>
              <TouchableOpacity onPress={() => setSelectedTitle(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={tc.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={labelMuted}>MEAL TYPE</Text>
            <View style={styles.mealTypeRow}>
              {(Object.keys(MEAL_META) as MealType[]).map((type) => {
                const m = MEAL_META[type];
                const sel = mealType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.mealTypeChip, sel && { backgroundColor: m.bg, borderColor: m.color }]}
                    onPress={() => setMealType(type)}
                  >
                    <Ionicons name={m.icon as any} size={13} color={sel ? m.color : tc.textMuted} />
                    <Text style={[styles.mealTypeText, sel && { color: m.color }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[labelMuted, { marginTop: 4 }]}>NUTRITION (EDIT IF NEEDED)</Text>
            {item && (
              <View style={styles.nutriRow}>
                {(
                  [
                    { label: 'Qty', key: 'quantity', type: 'text' as const },
                    { label: 'Cal', key: 'calories', type: 'num' as const },
                    { label: 'Prot', key: 'protein', type: 'num' as const },
                    { label: 'Carbs', key: 'carbs', type: 'num' as const },
                    { label: 'Fat', key: 'fat', type: 'num' as const },
                  ]
                ).map((f) => (
                  <View style={styles.nutriField} key={f.key}>
                    <Text style={styles.nutriLabel}>{f.label}</Text>
                    <TextInput
                      style={styles.nutriInput}
                      value={String((item as any)[f.key])}
                      onChangeText={(v) => setField(f.key as keyof DraftItem, v)}
                      keyboardType={f.type === 'num' ? 'decimal-pad' : 'default'}
                      placeholder="0"
                      placeholderTextColor={tc.textMuted}
                    />
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.estimateBtn, estimating && { opacity: 0.5 }]}
              onPress={estimateMacros}
              disabled={estimating}
            >
              {estimating ? (
                <ActivityIndicator size="small" color={tc.action} />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={15} color={tc.action} />
                  <Text style={styles.estimateText}>Estimate macros with AI</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedTitle(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                <Text style={styles.confirmText}>Confirm & Log</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tc.canvas,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
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
  scroll: { padding: ts.gutter, gap: 10, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingTop: 70, gap: 10, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: tc.textPrimary },
  emptySub: { fontSize: 12, color: tc.textMuted, textAlign: 'center', lineHeight: 18 },
  gotoLibraryBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tr.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.borderFocus,
  },
  gotoLibraryText: { fontSize: 13, fontWeight: '600', color: tc.action },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  recipeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: tc.carbsBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeInfo: { flex: 1, gap: 3 },
  recipeTitle: { fontSize: 14, fontWeight: '600', color: tc.textPrimary },
  recipeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recipeMeta: { fontSize: 11, color: tc.textMuted },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: tc.textMuted },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: tc.surfaceRaised,
    borderTopLeftRadius: tr.xl,
    borderTopRightRadius: tr.xl,
    padding: ts.gutter,
    gap: 12,
    paddingBottom: 32,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: tc.textPrimary, flex: 1 },
  mealTypeRow: { flexDirection: 'row', gap: 6 },
  mealTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: tr.DEFAULT,
    backgroundColor: tc.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  mealTypeText: { fontSize: 11, fontWeight: '600', color: tc.textMuted },
  nutriRow: { flexDirection: 'row', gap: 6 },
  nutriField: { flex: 1, alignItems: 'center', gap: 4 },
  nutriLabel: {
    fontSize: 8,
    color: tc.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  nutriInput: {
    width: '100%',
    height: 34,
    backgroundColor: 'rgba(244,247,251,0.04)',
    borderRadius: 8,
    textAlign: 'center',
    color: tc.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  estimateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.borderFocus,
    borderRadius: tr.DEFAULT,
    borderStyle: 'dashed',
  },
  estimateText: { fontSize: 13, color: tc.action, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 2 },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: tr.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: tc.textSecondary },
  confirmBtn: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: tr.lg,
    backgroundColor: tc.action,
  },
  confirmText: { fontSize: 14, fontWeight: '700', color: tc.canvas },
});
