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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useMealStore, MealFoodItem, MealLogEntry } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { getTodayDateString } from '../../../shared/istDate';

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

type RouteParams = {
  MealEdit: {
    entryId?: string;
    date?: string;
    mealType?: MealType;
  };
};

const MEAL_META: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline', color: colors.primary },
  lunch: { label: 'Lunch', icon: 'restaurant-outline', color: '#f59e0b' },
  snack: { label: 'Snack', icon: 'nutrition-outline', color: colors.success },
  dinner: { label: 'Dinner', icon: 'moon-outline', color: '#3b82f6' },
};

export default function MealEditScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'MealEdit'>>();
  const { entryId, date: paramDate, mealType: paramType } = route.params || {};
  const entries = useMealStore((s) => s.entries);
  const addEntry = useMealStore((s) => s.addEntry);
  const editEntry = useMealStore((s) => s.editEntry);
  const deleteEntry = useMealStore((s) => s.deleteEntry);
  const { user } = useAuth();

  const existing = entryId ? entries.find((e) => e.id === entryId) : null;
  const isEdit = !!existing;

  const [mealType, setMealType] = useState<MealType>(existing?.mealType || paramType || 'breakfast');
  const [mealDate, setMealDate] = useState(existing?.date.slice(0, 10) || paramDate || getTodayDateString());
  const [foodItems, setFoodItems] = useState<MealFoodItem[]>(
    existing?.items?.length ? existing.items : [{ name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0 }]
  );
  const [mealNotes, setMealNotes] = useState(existing?.notes || '');

  const addFoodRow = () => setFoodItems([...foodItems, { name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0 }]);
  const removeFoodRow = (i: number) => {
    if (foodItems.length === 1) return;
    setFoodItems(foodItems.filter((_, idx) => idx !== i));
  };

  const updateFoodItem = (i: number, field: keyof MealFoodItem, value: string) => {
    const updated = [...foodItems];
    if (field === 'name' || field === 'quantity') {
      (updated[i] as any)[field] = value;
    } else {
      (updated[i] as any)[field] = parseFloat(value) || 0;
    }
    setFoodItems(updated);
  };

  const handleSave = () => {
    const validItems = foodItems.filter((f) => f.name.trim());
    if (validItems.length === 0) { alert('Add at least one food item'); return; }

    const entry: Omit<MealLogEntry, 'id'> = {
      date: new Date(mealDate + 'T12:00:00+05:30').toISOString(),
      mealType,
      items: validItems,
      notes: mealNotes.trim(),
    };

    if (isEdit && existing) {
      editEntry(existing.id, entry, user?.id);
    } else {
      addEntry(entry, user?.id);
    }

    navigation.goBack();
  };

  const handleDelete = () => {
    if (existing) {
      deleteEntry(existing.id, user?.id);
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{isEdit ? 'Edit Meal' : 'New Meal'}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={handleSave}>
          <Ionicons name="checkmark" size={24} color={colors.success} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Meal Type */}
        <Text style={styles.sectionLabel}>MEAL TYPE</Text>
        <View style={styles.mealTypeRow}>
          {(Object.keys(MEAL_META) as MealType[]).map((type) => {
            const m = MEAL_META[type];
            const selected = mealType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.mealTypeChip, selected && { backgroundColor: `${m.color}25`, borderColor: m.color }]}
                onPress={() => setMealType(type)}
              >
                <Ionicons name={m.icon as any} size={16} color={selected ? m.color : colors.onSurfaceVariant} />
                <Text style={[styles.mealTypeText, selected && { color: m.color }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date */}
        <Text style={styles.sectionLabel}>DATE</Text>
        <TextInput
          style={styles.dateInput}
          value={mealDate}
          onChangeText={setMealDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.onSurfaceVariant}
        />

        {/* Food Items */}
        <Text style={styles.sectionLabel}>FOOD ITEMS</Text>
        {foodItems.map((item, i) => (
          <View key={i} style={styles.foodCard}>
            <View style={styles.foodHeader}>
              <Text style={styles.foodIndex}>{i + 1}</Text>
              <TextInput
                style={styles.foodNameInput}
                value={item.name}
                onChangeText={(v) => updateFoodItem(i, 'name', v)}
                placeholder="Food name"
                placeholderTextColor={colors.onSurfaceVariant}
              />
              <TouchableOpacity onPress={() => removeFoodRow(i)}>
                <Ionicons name="close-circle" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
            <View style={styles.foodQtyRow}>
              <View style={styles.qtyField}>
                <Text style={styles.qtyLabel}>Quantity</Text>
                <TextInput
                  style={styles.qtyInput}
                  value={item.quantity}
                  onChangeText={(v) => updateFoodItem(i, 'quantity', v)}
                  placeholder="200g"
                  placeholderTextColor={colors.onSurfaceVariant}
                />
              </View>
            </View>
            <View style={styles.nutriGrid}>
              <View style={styles.nutriItem}>
                <Text style={styles.nutriLabel}>Calories</Text>
                <TextInput
                  style={styles.nutriInput}
                  value={item.calories ? item.calories.toString() : ''}
                  onChangeText={(v) => updateFoodItem(i, 'calories', v)}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.onSurfaceVariant}
                />
              </View>
              <View style={styles.nutriItem}>
                <Text style={styles.nutriLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.nutriInput}
                  value={item.protein ? item.protein.toString() : ''}
                  onChangeText={(v) => updateFoodItem(i, 'protein', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.onSurfaceVariant}
                />
              </View>
              <View style={styles.nutriItem}>
                <Text style={styles.nutriLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.nutriInput}
                  value={item.carbs ? item.carbs.toString() : ''}
                  onChangeText={(v) => updateFoodItem(i, 'carbs', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.onSurfaceVariant}
                />
              </View>
              <View style={styles.nutriItem}>
                <Text style={styles.nutriLabel}>Fat (g)</Text>
                <TextInput
                  style={styles.nutriInput}
                  value={item.fat ? item.fat.toString() : ''}
                  onChangeText={(v) => updateFoodItem(i, 'fat', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.onSurfaceVariant}
                />
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addItemBtn} onPress={addFoodRow}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.addItemText}>Add Another Item</Text>
        </TouchableOpacity>

        {/* Notes */}
        <Text style={styles.sectionLabel}>NOTES</Text>
        <TextInput
          style={styles.notesInput}
          value={mealNotes}
          onChangeText={setMealNotes}
          placeholder="Optional notes..."
          placeholderTextColor={colors.onSurfaceVariant}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Actions */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{isEdit ? 'Update Meal' : 'Save Meal'}</Text>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={styles.deleteBtnText}>Delete Meal</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0 },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 64, paddingHorizontal: spacing.containerPadding, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { padding: 8, borderRadius: rounded.full },
  scroll: { padding: spacing.containerPadding, gap: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  mealTypeRow: { flexDirection: 'row', gap: 8 },
  mealTypeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: rounded.DEFAULT, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  mealTypeText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  dateInput: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, height: 48, paddingHorizontal: 14, color: colors.onSurface, fontSize: 15, fontWeight: '500', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  foodCard: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, padding: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  foodHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foodIndex: { fontSize: 14, fontWeight: '700', color: colors.onSurfaceVariant, width: 22, textAlign: 'center' },
  foodNameInput: { flex: 1, height: 42, paddingHorizontal: 12, color: colors.onSurface, fontSize: 15, fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 },
  foodQtyRow: { flexDirection: 'row', gap: 10 },
  qtyField: { flex: 1 },
  qtyLabel: { fontSize: 9, color: colors.onSurfaceVariant, fontWeight: '600', marginBottom: 4 },
  qtyInput: { height: 38, paddingHorizontal: 12, color: colors.onSurface, fontSize: 13, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 },
  nutriGrid: { flexDirection: 'row', gap: 8 },
  nutriItem: { flex: 1 },
  nutriLabel: { fontSize: 9, color: colors.onSurfaceVariant, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  nutriInput: { height: 38, color: colors.onSurface, fontSize: 13, fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, textAlign: 'center' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', borderRadius: rounded.DEFAULT, borderStyle: 'dashed' },
  addItemText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  notesInput: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, height: 80, paddingHorizontal: 12, paddingVertical: 10, color: colors.onSurface, fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryContainer, paddingVertical: 16, borderRadius: rounded.lg, marginTop: 4 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 4 },
  deleteBtnText: { fontSize: 14, color: colors.error, fontWeight: '600' },
});
