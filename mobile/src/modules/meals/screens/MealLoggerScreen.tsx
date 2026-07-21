import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useMealStore, MealFoodItem, MealLogEntry } from '../store';
import { useAuth } from '../../../services/AuthProvider';

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

const MEAL_META: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline', color: colors.primary },
  lunch: { label: 'Lunch', icon: 'restaurant-outline', color: '#f59e0b' },
  snack: { label: 'Snack', icon: 'nutrition-outline', color: colors.success },
  dinner: { label: 'Dinner', icon: 'moon-outline', color: '#3b82f6' },
};

export default function MealLoggerScreen() {
  const navigation = useNavigation();
  const { entries, addEntry, editEntry, deleteEntry, dailyCalorieTarget, dailyProteinTarget, setTargets, aiMessages } = useMealStore();
  const todayTotals = useMealStore((s) => s.getTodayTotals());
  const { user } = useAuth();

  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = useMemo(
    () => entries.filter((e) => e.date.slice(0, 10) === today),
    [entries, today]
  );

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [foodItems, setFoodItems] = useState<MealFoodItem[]>([{ name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0 }]);
  const [mealNotes, setMealNotes] = useState('');
  const [showTargets, setShowTargets] = useState(false);
  const [targetCal, setTargetCal] = useState(dailyCalorieTarget.toString());
  const [targetProt, setTargetProt] = useState(dailyProteinTarget.toString());

  const calPercent = dailyCalorieTarget > 0 ? Math.min(100, (todayTotals.calories / dailyCalorieTarget) * 100) : 0;
  const protPercent = dailyProteinTarget > 0 ? Math.min(100, (todayTotals.protein / dailyProteinTarget) * 100) : 0;

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

  const saveEntry = () => {
    const validItems = foodItems.filter((f) => f.name.trim());
    if (validItems.length === 0) { alert('Add at least one food item'); return; }

    const entry: Omit<MealLogEntry, 'id'> = {
      date: new Date().toISOString(),
      mealType,
      items: validItems,
      notes: mealNotes.trim(),
    };

    if (editingId) {
      editEntry(editingId, entry, user?.id);
    } else {
      addEntry(entry, user?.id);
    }

    setShowAdd(false);
    setEditingId(null);
    setFoodItems([{ name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0 }]);
    setMealNotes('');
  };

  const openEdit = (entry: MealLogEntry) => {
    setEditingId(entry.id);
    setMealType(entry.mealType);
    setFoodItems(entry.items.length > 0 ? entry.items : [{ name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0 }]);
    setMealNotes(entry.notes);
    setShowAdd(true);
  };

  const handleSaveTargets = () => {
    const cal = parseInt(targetCal, 10) || 0;
    const prot = parseInt(targetProt, 10) || 0;
    setTargets(cal, prot);
    setShowTargets(false);
  };

  const formatNum = (n: number) => n.toFixed(0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>Meal Logger</Text>
          <Text style={styles.appBarDate}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
        </View>
        <View style={styles.appBarRight}>
          <TouchableOpacity style={styles.iconBtnSm} onPress={() => (navigation as any).navigate('MealAISuggestions')}>
            <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtnSm} onPress={() => { setTargetCal(dailyCalorieTarget.toString()); setTargetProt(dailyProteinTarget.toString()); setShowTargets(true); }}>
            <Ionicons name="options-outline" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Daily Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressItem}>
            <View style={styles.progressLabelRow}>
              <Ionicons name="flame-outline" size={16} color="#f59e0b" />
              <Text style={styles.progressLabel}>Calories</Text>
              <Text style={styles.progressValue}>{formatNum(todayTotals.calories)} / {dailyCalorieTarget}</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { backgroundColor: '#f59e0b', width: `${calPercent}%` }]} />
            </View>
          </View>
          <View style={styles.progressItem}>
            <View style={styles.progressLabelRow}>
              <Ionicons name="barbell-outline" size={16} color={colors.success} />
              <Text style={styles.progressLabel}>Protein</Text>
              <Text style={styles.progressValue}>{formatNum(todayTotals.protein)}g / {dailyProteinTarget}g</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { backgroundColor: colors.success, width: `${protPercent}%` }]} />
            </View>
          </View>
          <View style={styles.macroRow}>
            <View style={styles.macroChip}>
              <Text style={styles.macroVal}>{formatNum(todayTotals.carbs)}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroChip}>
              <Text style={styles.macroVal}>{formatNum(todayTotals.fat)}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
            <View style={styles.macroChip}>
              <Text style={styles.macroVal}>{todayEntries.reduce((s, e) => s + e.items.length, 0)}</Text>
              <Text style={styles.macroLabel}>Items</Text>
            </View>
          </View>
        </View>

        {/* Add Meal Button */}
        <TouchableOpacity
          style={styles.addMealBtn}
          onPress={() => {
            setEditingId(null);
            setMealType('breakfast');
            setFoodItems([{ name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0 }]);
            setMealNotes('');
            setShowAdd(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.addMealText}>Log Meal</Text>
        </TouchableOpacity>

        {/* Today's Meals */}
        <Text style={styles.sectionTitle}>TODAY'S MEALS</Text>
        {todayEntries.length === 0 ? (
          <Text style={styles.emptyText}>No meals logged today</Text>
        ) : (
          todayEntries.map((entry) => {
            const meta = MEAL_META[entry.mealType];
            const mealCal = entry.items.reduce((s, i) => s + i.calories, 0);
            const mealProt = entry.items.reduce((s, i) => s + i.protein, 0);
            return (
              <TouchableOpacity key={entry.id} style={styles.mealCard} onPress={() => openEdit(entry)} activeOpacity={0.7}>
                <View style={[styles.mealIconBox, { backgroundColor: `${meta.color}20` }]}>
                  <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                </View>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealTitle}>{meta.label}</Text>
                  <View style={styles.mealItems}>
                    {entry.items.map((item, i) => (
                      <Text key={i} style={styles.mealItemText}>{item.name}{item.quantity ? ` (${item.quantity})` : ''}</Text>
                    ))}
                  </View>
                  {entry.notes ? <Text style={styles.mealNote}>{entry.notes}</Text> : null}
                </View>
                <View style={styles.mealStats}>
                  <Text style={styles.mealCal}>{mealCal} cal</Text>
                  <Text style={styles.mealProt}>{mealProt}g P</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add/Edit Meal Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Meal' : 'Log Meal'}</Text>

            {/* Meal Type Selector */}
            <View style={styles.mealTypeRow}>
              {(Object.keys(MEAL_META) as MealType[]).map((type) => {
                const m = MEAL_META[type];
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.mealTypeChip,
                      mealType === type && { backgroundColor: `${m.color}25`, borderColor: m.color },
                    ]}
                    onPress={() => setMealType(type)}
                  >
                    <Ionicons name={m.icon as any} size={14} color={mealType === type ? m.color : colors.onSurfaceVariant} />
                    <Text style={[styles.mealTypeText, mealType === type && { color: m.color }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Food Items */}
            <Text style={styles.sectionLabel}>FOOD ITEMS</Text>
            <ScrollView style={styles.foodScroll} contentContainerStyle={{ gap: 8 }}>
              {foodItems.map((item, i) => (
                <View key={i} style={styles.foodRow}>
                  <View style={styles.foodRowHeader}>
                    <TextInput
                      style={styles.foodInput}
                      value={item.name}
                      onChangeText={(v) => updateFoodItem(i, 'name', v)}
                      placeholder="Food name"
                      placeholderTextColor={colors.onSurfaceVariant}
                    />
                    <TouchableOpacity onPress={() => removeFoodRow(i)}>
                      <Ionicons name="close-circle" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.nutriRow}>
                    <View style={styles.nutriField}>
                      <Text style={styles.nutriLabel}>Cal</Text>
                      <TextInput style={styles.nutriInput} value={item.calories ? item.calories.toString() : ''} onChangeText={(v) => updateFoodItem(i, 'calories', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.onSurfaceVariant} />
                    </View>
                    <View style={styles.nutriField}>
                      <Text style={styles.nutriLabel}>Prot(g)</Text>
                      <TextInput style={styles.nutriInput} value={item.protein ? item.protein.toString() : ''} onChangeText={(v) => updateFoodItem(i, 'protein', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.onSurfaceVariant} />
                    </View>
                    <View style={styles.nutriField}>
                      <Text style={styles.nutriLabel}>Carbs(g)</Text>
                      <TextInput style={styles.nutriInput} value={item.carbs ? item.carbs.toString() : ''} onChangeText={(v) => updateFoodItem(i, 'carbs', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.onSurfaceVariant} />
                    </View>
                    <View style={styles.nutriField}>
                      <Text style={styles.nutriLabel}>Fat(g)</Text>
                      <TextInput style={styles.nutriInput} value={item.fat ? item.fat.toString() : ''} onChangeText={(v) => updateFoodItem(i, 'fat', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.onSurfaceVariant} />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.addItemBtn} onPress={addFoodRow}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addItemText}>Add Item</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.notesInput}
              value={mealNotes}
              onChangeText={setMealNotes}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            {editingId ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: colors.errorContainer }]} onPress={() => { deleteEntry(editingId, user?.id); setShowAdd(false); }}>
                  <Text style={styles.saveBtnText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={saveEntry}>
                  <Text style={styles.saveBtnText}>Update</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.saveBtn} onPress={saveEntry}>
                <Text style={styles.saveBtnText}>Save Meal</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Targets Modal */}
      <Modal visible={showTargets} transparent animationType="fade" onRequestClose={() => setShowTargets(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.targetsModal}>
            <Text style={styles.targetsTitle}>Daily Targets</Text>
            <View style={styles.targetField}>
              <Text style={styles.targetLabel}>Calorie Target</Text>
              <TextInput style={styles.targetInput} value={targetCal} onChangeText={setTargetCal} keyboardType="number-pad" placeholderTextColor={colors.onSurfaceVariant} />
            </View>
            <View style={styles.targetField}>
              <Text style={styles.targetLabel}>Protein Target (g)</Text>
              <TextInput style={styles.targetInput} value={targetProt} onChangeText={setTargetProt} keyboardType="number-pad" placeholderTextColor={colors.onSurfaceVariant} />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTargets}>
              <Text style={styles.saveBtnText}>Save Targets</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTargets(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0 },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 64, paddingHorizontal: spacing.containerPadding, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  appBarCenter: { alignItems: 'center' },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  appBarDate: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 1 },
  appBarRight: { flexDirection: 'row', gap: 8, width: 80, justifyContent: 'flex-end' },
  iconBtn: { padding: 8, borderRadius: rounded.full },
  iconBtnSm: { padding: 6 },
  scroll: { padding: spacing.containerPadding, gap: 14, paddingBottom: 40 },
  progressCard: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, padding: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  progressItem: { gap: 6 },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressLabel: { fontSize: 13, fontWeight: '600', color: colors.onSurface, flex: 1 },
  progressValue: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  progressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  macroRow: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  macroChip: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', paddingVertical: 8, borderRadius: rounded.DEFAULT },
  macroVal: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  macroLabel: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 2 },
  addMealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryContainer, paddingVertical: 14, borderRadius: rounded.lg },
  addMealText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  sectionTitle: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginTop: 4 },
  emptyText: { fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 16 },
  mealCard: { flexDirection: 'row', backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, padding: 12, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  mealIconBox: { width: 42, height: 42, borderRadius: rounded.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  mealInfo: { flex: 1, gap: 2 },
  mealTitle: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  mealItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  mealItemText: { fontSize: 11, color: colors.onSurfaceVariant, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  mealNote: { fontSize: 11, color: colors.onSurfaceVariant, fontStyle: 'italic' },
  mealStats: { alignItems: 'flex-end', gap: 2 },
  mealCal: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  mealProt: { fontSize: 11, color: colors.success, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center', marginBottom: 16 },
  mealTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  mealTypeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: rounded.DEFAULT, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  mealTypeText: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginBottom: 8 },
  foodScroll: { maxHeight: 220 },
  foodRow: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, padding: 10, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  foodRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  foodInput: { flex: 1, height: 36, paddingHorizontal: 10, color: colors.onSurface, fontSize: 14, fontWeight: '500', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6 },
  nutriRow: { flexDirection: 'row', gap: 6 },
  nutriField: { flex: 1, alignItems: 'center' },
  nutriLabel: { fontSize: 9, color: colors.onSurfaceVariant, fontWeight: '600', marginBottom: 2 },
  nutriInput: { width: '100%', height: 32, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6, textAlign: 'center', color: colors.onSurface, fontSize: 12, fontWeight: '600' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 4 },
  addItemText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  notesInput: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, height: 40, paddingHorizontal: 12, color: colors.onSurface, fontSize: 13, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  saveBtn: { backgroundColor: colors.primaryContainer, paddingVertical: 14, borderRadius: rounded.lg, alignItems: 'center', marginTop: 12 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  cancelBtnText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
  targetsModal: { backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 24, margin: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  targetsTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center', marginBottom: 16 },
  targetField: { gap: 6, marginBottom: 12 },
  targetLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  targetInput: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, height: 44, paddingHorizontal: 14, color: colors.onSurface, fontSize: 16, fontWeight: '600', textAlign: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
});
