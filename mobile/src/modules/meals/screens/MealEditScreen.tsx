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
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useMealStore, MealFoodItem, MealLogEntry } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { getTodayDateString, formatDateFull } from '../../../shared/istDate';
import { tc, ts, tr, card, labelMuted } from '../../../shared/theme/tracend';
import CalendarPicker from '../../../shared/components/CalendarPicker';

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

type RouteParams = {
  MealEdit: {
    entryId?: string;
    date?: string;
    mealType?: MealType;
  };
};

const MEAL_META: Record<MealType, { label: string; icon: string; color: string; bg: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline', color: tc.action, bg: tc.actionDim },
  lunch: { label: 'Lunch', icon: 'restaurant-outline', color: tc.amber, bg: 'rgba(226,164,92,0.12)' },
  snack: { label: 'Snack', icon: 'nutrition-outline', color: tc.carbs, bg: tc.carbsBg },
  dinner: { label: 'Dinner', icon: 'moon-outline', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
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
  const [showDatePicker, setShowDatePicker] = useState(false);
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
          <Ionicons name="arrow-back" size={24} color={tc.action} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{isEdit ? 'Edit Meal' : 'New Meal'}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={handleSave}>
          <Ionicons name="checkmark" size={24} color={tc.carbs} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Meal Type */}
        <Text style={labelMuted}>Meal Type</Text>
        <View style={styles.mealTypeRow}>
          {(Object.keys(MEAL_META) as MealType[]).map((type) => {
            const m = MEAL_META[type];
            const selected = mealType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.mealTypeChip, selected && { backgroundColor: m.bg, borderColor: m.color }]}
                onPress={() => setMealType(type)}
              >
                <Ionicons name={m.icon as any} size={13} color={selected ? m.color : tc.textMuted} />
                <Text style={[styles.mealTypeText, selected && { color: m.color }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date */}
        <Text style={labelMuted}>Date</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.dateInputText}>{formatDateFull(mealDate)}</Text>
          <Ionicons name="calendar-outline" size={18} color={tc.textSecondary} />
        </TouchableOpacity>

        {/* Food Items */}
        <Text style={labelMuted}>Food Items</Text>
        {foodItems.map((item, i) => (
          <View key={i} style={styles.foodCard}>
            <View style={styles.foodHeader}>
              <Text style={styles.foodIndex}>{i + 1}</Text>
              <TextInput
                style={styles.foodNameInput}
                value={item.name}
                onChangeText={(v) => updateFoodItem(i, 'name', v)}
                placeholder="Food name"
                placeholderTextColor={tc.textMuted}
              />
              <TouchableOpacity onPress={() => removeFoodRow(i)}>
                <Ionicons name="close-circle" size={20} color={tc.attention} />
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
                  placeholderTextColor={tc.textMuted}
                />
              </View>
            </View>
            <View style={styles.nutriGrid}>
              {[
                { label: 'Calories', key: 'calories', color: tc.calories },
                { label: 'Protein (g)', key: 'protein', color: tc.action },
                { label: 'Carbs (g)', key: 'carbs', color: tc.carbs },
                { label: 'Fat (g)', key: 'fat', color: tc.fat },
              ].map((f) => (
                <View style={styles.nutriItem} key={f.key}>
                  <Text style={[styles.nutriLabel, { color: f.color }]}>{f.label}</Text>
                  <TextInput
                    style={styles.nutriInput}
                    value={(item as any)[f.key] ? (item as any)[f.key].toString() : ''}
                    onChangeText={(v) => updateFoodItem(i, f.key as any, v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={tc.textMuted}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addItemBtn} onPress={addFoodRow}>
          <Ionicons name="add" size={16} color={tc.action} />
          <Text style={styles.addItemText}>Add Another Item</Text>
        </TouchableOpacity>

        {/* Notes */}
        <Text style={labelMuted}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          value={mealNotes}
          onChangeText={setMealNotes}
          placeholder="Optional notes..."
          placeholderTextColor={tc.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Actions */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.9}>
          <Ionicons name="checkmark-circle" size={18} color={tc.canvas} />
          <Text style={styles.saveBtnText}>{isEdit ? 'Update Meal' : 'Save Meal'}</Text>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={16} color={tc.attention} />
            <Text style={styles.deleteBtnText}>Delete Meal</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <CalendarPicker
        visible={showDatePicker}
        selected={new Date(mealDate + 'T12:00:00')}
        onSelect={(d) => {
          setMealDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />
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
  scroll: { padding: ts.gutter, gap: 14, paddingBottom: 50 },

  mealTypeRow: { flexDirection: 'row', gap: 6 },
  mealTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: tr.DEFAULT,
    backgroundColor: tc.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  mealTypeText: { fontSize: 11, fontWeight: '600', color: tc.textMuted },

  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tc.surface,
    borderRadius: tr.DEFAULT,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  dateInputText: {
    color: tc.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },

  foodCard: {
    ...card,
    padding: 14,
    gap: 12,
  },
  foodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  foodIndex: {
    fontSize: 14,
    fontWeight: '700',
    color: tc.textMuted,
    width: 22,
    textAlign: 'center',
  },
  foodNameInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    color: tc.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: 'rgba(244,247,251,0.03)',
    borderRadius: 8,
  },
  foodQtyRow: { flexDirection: 'row', gap: 10 },
  qtyField: { flex: 1 },
  qtyLabel: {
    fontSize: 9,
    color: tc.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  qtyInput: {
    height: 38,
    paddingHorizontal: 12,
    color: tc.textPrimary,
    fontSize: 13,
    backgroundColor: 'rgba(244,247,251,0.03)',
    borderRadius: 8,
  },
  nutriGrid: { flexDirection: 'row', gap: 6 },
  nutriItem: { flex: 1 },
  nutriLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  nutriInput: {
    height: 36,
    color: tc.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(244,247,251,0.03)',
    borderRadius: 8,
    textAlign: 'center',
  },

  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.borderFocus,
    borderRadius: tr.DEFAULT,
    borderStyle: 'dashed' as const,
  },
  addItemText: { fontSize: 13, color: tc.action, fontWeight: '600' },

  notesInput: {
    backgroundColor: tc.surface,
    borderRadius: tr.DEFAULT,
    height: 80,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: tc.textPrimary,
    fontSize: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tc.action,
    paddingVertical: 16,
    borderRadius: tr.lg,
    marginTop: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: tc.canvas },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  deleteBtnText: { fontSize: 14, color: tc.attention, fontWeight: '600' },
});
