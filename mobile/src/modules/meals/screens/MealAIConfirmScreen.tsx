import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useMealStore, MealFoodItem, MealLogEntry } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { analyzeMealImage, analyzeMealText, ConversationTurn } from '../../../services/aiServices';

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

type RouteParams = {
  MealAIConfirm: {
    imageBase64?: string;
    textDescription?: string;
    mealType?: MealType;
  };
};

const MEAL_META: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline', color: colors.primary },
  lunch: { label: 'Lunch', icon: 'restaurant-outline', color: '#f59e0b' },
  snack: { label: 'Snack', icon: 'nutrition-outline', color: colors.success },
  dinner: { label: 'Dinner', icon: 'moon-outline', color: '#3b82f6' },
};

export default function MealAIConfirmScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'MealAIConfirm'>>();
  const { imageBase64, textDescription, mealType: initialMealType } = route.params || {};
  const { user } = useAuth();
  const addEntry = useMealStore((s) => s.addEntry);

  const [mealType, setMealType] = useState<MealType>(initialMealType || 'lunch');
  const [items, setItems] = useState<MealFoodItem[]>([]);
  const [aiMessage, setAiMessage] = useState('');
  const [hasQuestions, setHasQuestions] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [notes, setNotes] = useState('');
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [estimatingIndex, setEstimatingIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const initialAnalysisDone = useRef(false);

  useEffect(() => {
    if (initialAnalysisDone.current) return;
    initialAnalysisDone.current = true;
    runInitialAnalysis();
  }, []);

  const runInitialAnalysis = async () => {
    setLoading(true);
    let result;
    if (imageBase64) {
      result = await analyzeMealImage(imageBase64);
    } else if (textDescription) {
      result = await analyzeMealText(textDescription);
    } else {
      setAiMessage('No meal data provided. Please go back and try again.');
      setLoading(false);
      return;
    }

    setItems(result.items || []);
    setAiMessage(result.message || '');
    setHasQuestions(result.hasQuestions);
    setIsComplete(result.isComplete);
    setConversation([{ role: 'assistant', content: result.message || '' }]);
    setLoading(false);
  };

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    setReplyText('');
    setSending(true);

    const updatedConversation: ConversationTurn[] = [
      ...conversation,
      { role: 'user', content: text },
    ];

    let result;
    if (imageBase64) {
      result = await analyzeMealImage(imageBase64, updatedConversation);
    } else if (textDescription) {
      result = await analyzeMealText(textDescription, updatedConversation);
    } else {
      setSending(false);
      return;
    }

    if (result.items && result.items.length > 0) {
      setItems(result.items);
    }
    setAiMessage(result.message || '');
    setHasQuestions(result.hasQuestions);
    setIsComplete(result.isComplete);
    setConversation([
      ...updatedConversation,
      { role: 'assistant', content: result.message || '' },
    ]);
    setSending(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const handleReestimate = async (index: number) => {
    const item = items[index];
    if (!item.name.trim()) return;
    setEstimatingIndex(index);

    const prompt = `Re-estimate nutrition for this single food item. Return ONLY the JSON object - no other text:
{
  "items": [
    {
      "name": "${item.name}",
      "quantity": "${item.quantity}",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0
    }
  ],
  "message": "",
  "hasQuestions": false,
  "isComplete": true
}

Food to estimate: ${item.name}${item.quantity ? ` (${item.quantity})` : ''}.
Estimate realistic nutrition values for this specific item.`;

    const result = await analyzeMealText(prompt);
    setEstimatingIndex(null);

    if (result.items && result.items.length > 0) {
      const updated = [...items];
      updated[index] = { ...updated[index], ...result.items[0] };
      setItems(updated);
    }
  };

  const updateItem = (index: number, field: keyof MealFoodItem, value: string | number) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0 }]);
  };

  const handleConfirm = () => {
    const validItems = items.filter((f) => f.name.trim());
    if (validItems.length === 0) {
      alert('No food items to log. Add at least one item.');
      return;
    }

    const entry: Omit<MealLogEntry, 'id'> = {
      date: new Date().toISOString(),
      mealType,
      items: validItems,
      notes: notes.trim(),
    };

    addEntry(entry, user?.id);
    navigation.goBack();
  };

  const totalCal = items.reduce((s, i) => s + (i.calories || 0), 0);
  const totalProt = items.reduce((s, i) => s + (i.protein || 0), 0);
  const totalCarbs = items.reduce((s, i) => s + (i.carbs || 0), 0);
  const totalFat = items.reduce((s, i) => s + (i.fat || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>Confirm Meal</Text>
        </View>
        <Ionicons name="sparkles" size={20} color={colors.primary} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {/* Meal Type Selector */}
          <View style={styles.mealTypeRow}>
            {(Object.keys(MEAL_META) as MealType[]).map((type) => {
              const m = MEAL_META[type];
              const selected = mealType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.mealTypeChip,
                    selected && { backgroundColor: `${m.color}25`, borderColor: m.color },
                  ]}
                  onPress={() => setMealType(type)}
                >
                  <Ionicons name={m.icon as any} size={14} color={selected ? m.color : colors.onSurfaceVariant} />
                  <Text style={[styles.mealTypeText, selected && { color: m.color }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Image Preview */}
          {imageBase64 ? (
            <View style={styles.imagePreview}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${imageBase64}` }}
                style={styles.mealImage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                <Ionicons name="camera" size={14} color={colors.onSurface} />
              </View>
            </View>
          ) : null}

          {/* AI Message */}
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>AI is analyzing your meal...</Text>
            </View>
          ) : (
            <View style={styles.aiBubble}>
              <Ionicons name="sparkles" size={16} color={colors.primary} style={{ marginTop: 2 }} />
              <Text style={styles.aiText}>{aiMessage}</Text>
            </View>
          )}

          {/* Detected Items */}
          {items.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>DETECTED ITEMS</Text>
              {items.map((item, i) => (
                <View key={i} style={styles.itemCard}>
                  {/* Name row */}
                  <View style={styles.itemNameRow}>
                    <TextInput
                      style={styles.itemNameInput}
                      value={item.name}
                      onChangeText={(v) => updateItem(i, 'name', v)}
                      placeholder="Food name"
                      placeholderTextColor={colors.onSurfaceVariant}
                    />
                    <TouchableOpacity
                      style={styles.estimateBtn}
                      onPress={() => handleReestimate(i)}
                      disabled={estimatingIndex === i}
                    >
                      {estimatingIndex === i ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeItem(i)} style={styles.removeBtn}>
                      <Ionicons name="close-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>

                  {/* Qty + nutrition row */}
                  <View style={styles.itemDetailRow}>
                    <TextInput
                      style={styles.qtyInput}
                      value={item.quantity}
                      onChangeText={(v) => updateItem(i, 'quantity', v)}
                      placeholder="Qty"
                      placeholderTextColor={colors.onSurfaceVariant}
                    />
                    <View style={styles.nutriGroup}>
                      <View style={styles.nutriField}>
                        <Text style={styles.nutriLabel}>Cal</Text>
                        <TextInput
                          style={styles.nutriInput}
                          value={item.calories ? item.calories.toString() : ''}
                          onChangeText={(v) => updateItem(i, 'calories', parseFloat(v) || 0)}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={colors.onSurfaceVariant}
                        />
                      </View>
                      <View style={styles.nutriField}>
                        <Text style={styles.nutriLabel}>Prot(g)</Text>
                        <TextInput
                          style={styles.nutriInput}
                          value={item.protein ? item.protein.toString() : ''}
                          onChangeText={(v) => updateItem(i, 'protein', parseFloat(v) || 0)}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={colors.onSurfaceVariant}
                        />
                      </View>
                      <View style={styles.nutriField}>
                        <Text style={styles.nutriLabel}>Carbs(g)</Text>
                        <TextInput
                          style={styles.nutriInput}
                          value={item.carbs ? item.carbs.toString() : ''}
                          onChangeText={(v) => updateItem(i, 'carbs', parseFloat(v) || 0)}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={colors.onSurfaceVariant}
                        />
                      </View>
                      <View style={styles.nutriField}>
                        <Text style={styles.nutriLabel}>Fat(g)</Text>
                        <TextInput
                          style={styles.nutriInput}
                          value={item.fat ? item.fat.toString() : ''}
                          onChangeText={(v) => updateItem(i, 'fat', parseFloat(v) || 0)}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={colors.onSurfaceVariant}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>

              {/* Macro Summary */}
              <View style={styles.macroSummary}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryVal}>{totalCal}</Text>
                  <Text style={styles.summaryLabel}>Calories</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryVal}>{totalProt}g</Text>
                  <Text style={styles.summaryLabel}>Protein</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryVal}>{totalCarbs}g</Text>
                  <Text style={styles.summaryLabel}>Carbs</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryVal}>{totalFat}g</Text>
                  <Text style={styles.summaryLabel}>Fat</Text>
                </View>
              </View>
            </>
          )}

          {/* Notes */}
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.onSurfaceVariant}
          />
        </ScrollView>

        {/* Reply Input (only when AI has questions) */}
        {hasQuestions && !loading && (
          <View style={styles.replyRow}>
            <TextInput
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Reply to AI..."
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!replyText.trim() || sending) && { opacity: 0.4 }]}
              onPress={handleSendReply}
              disabled={!replyText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, (items.length === 0 || loading) && { opacity: 0.4 }]}
            onPress={handleConfirm}
            disabled={items.length === 0 || loading}
          >
            <Text style={styles.confirmText}>Confirm & Log</Text>
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
  appBarCenter: { alignItems: 'center' },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { padding: 8, borderRadius: rounded.full },
  scroll: { padding: spacing.containerPadding, gap: 12, paddingBottom: 20 },
  mealTypeRow: { flexDirection: 'row', gap: 8 },
  mealTypeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: rounded.DEFAULT, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  mealTypeText: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },
  imagePreview: { borderRadius: rounded.lg, overflow: 'hidden', marginTop: 4 },
  mealImage: { width: '100%', height: 180, borderRadius: rounded.lg },
  imageOverlay: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: rounded.full, padding: 6 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  loadingText: { fontSize: 13, color: colors.onSurfaceVariant },
  aiBubble: { flexDirection: 'row', gap: 8, backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, padding: 12, borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)' },
  aiText: { flex: 1, fontSize: 13, color: colors.onSurface, lineHeight: 19 },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginTop: 4 },
  itemCard: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, padding: 12, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemNameInput: { flex: 1, height: 38, paddingHorizontal: 12, color: colors.onSurface, fontSize: 14, fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8 },
  estimateBtn: { padding: 6, borderRadius: rounded.full },
  removeBtn: { padding: 2 },
  itemDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  qtyInput: { width: 72, height: 50, paddingHorizontal: 6, color: colors.onSurface, fontSize: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, textAlign: 'center' },
  nutriGroup: { flex: 1, flexDirection: 'row', gap: 6 },
  nutriField: { flex: 1, alignItems: 'center', gap: 3 },
  nutriLabel: { fontSize: 9, color: colors.onSurfaceVariant, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  nutriInput: { width: '100%', height: 30, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6, textAlign: 'center', color: colors.onSurface, fontSize: 12, fontWeight: '600' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', borderRadius: rounded.DEFAULT, borderStyle: 'dashed' },
  addItemText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  macroSummary: { flexDirection: 'row', gap: 6, backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  summaryChip: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  summaryLabel: { fontSize: 9, color: colors.onSurfaceVariant, fontWeight: '600', marginTop: 2 },
  notesInput: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, height: 40, paddingHorizontal: 12, color: colors.onSurface, fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: spacing.containerPadding, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  replyInput: { flex: 1, backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, paddingHorizontal: 12, paddingVertical: 8, color: colors.onSurface, fontSize: 13, maxHeight: 80, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.containerPadding, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: rounded.lg, borderWidth: 1, borderColor: colors.outlineVariant },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.onSurfaceVariant },
  confirmBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: rounded.lg, backgroundColor: colors.primaryContainer },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
