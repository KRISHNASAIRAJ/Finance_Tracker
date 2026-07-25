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
import { useMealStore, MealFoodItem, MealLogEntry } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { analyzeMealImage, analyzeMealText, ConversationTurn } from '../../../services/aiServices';
import { tc, ts, tr, card, cardFocus, labelMuted, dataBase } from '../../../shared/theme/tracend';

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

type RouteParams = {
  MealAIConfirm: {
    imageBase64?: string;
    textDescription?: string;
    mealType?: MealType;
  };
};

const MEAL_META: Record<MealType, { label: string; icon: string; color: string; bg: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline', color: tc.action, bg: tc.actionDim },
  lunch: { label: 'Lunch', icon: 'restaurant-outline', color: tc.amber, bg: 'rgba(226,164,92,0.12)' },
  snack: { label: 'Snack', icon: 'nutrition-outline', color: tc.carbs, bg: tc.carbsBg },
  dinner: { label: 'Dinner', icon: 'moon-outline', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
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
  const submittedTextRef = useRef(textDescription || '');
  const [inputText, setInputText] = useState('');

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
    } else if (submittedTextRef.current) {
      result = await analyzeMealText(submittedTextRef.current, updatedConversation);
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

  const handleSubmitText = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    submittedTextRef.current = text;
    setSending(true);
    setInputText('');

    const result = await analyzeMealText(text);

    setItems(result.items || []);
    setAiMessage(result.message || '');
    setHasQuestions(result.hasQuestions);
    setIsComplete(result.isComplete);
    setConversation([{ role: 'assistant', content: result.message || '' }]);
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
          <Ionicons name="arrow-back" size={24} color={tc.action} />
        </TouchableOpacity>
        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>Confirm Meal</Text>
        </View>
        <Ionicons name="sparkles" size={20} color={tc.action} />
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
                    selected && { backgroundColor: m.bg, borderColor: m.color },
                  ]}
                  onPress={() => setMealType(type)}
                >
                  <Ionicons name={m.icon as any} size={13} color={selected ? m.color : tc.textMuted} />
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
            </View>
          ) : null}

          {/* Describe Meal Input */}
          {!imageBase64 && !textDescription && !loading && items.length === 0 && conversation.length === 0 ? (
            <View style={[cardFocus, { padding: 14, gap: 10 }]}>
              <Text style={styles.describeLabel}>Describe your meal</Text>
              <TextInput
                style={styles.describeInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder='"Rice with dal and 2 chapatis with paneer curry"'
                placeholderTextColor={tc.textMuted}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.describeSubmitBtn, (!inputText.trim() || sending) && { opacity: 0.3 }]}
                onPress={handleSubmitText}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={tc.canvas} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color={tc.canvas} />
                    <Text style={styles.describeSubmitText}>Analyze with AI</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {/* AI Loading */}
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={tc.action} />
              <Text style={styles.loadingText}>AI is analyzing your meal...</Text>
            </View>
          ) : aiMessage ? (
            <View style={styles.aiBubble}>
              <Ionicons name="sparkles" size={15} color={tc.action} style={{ marginTop: 1 }} />
              <Text style={styles.aiText}>{aiMessage}</Text>
            </View>
          ) : null}

          {/* Detected Items */}
          {items.length > 0 && (
            <>
              <Text style={[labelMuted, { marginTop: 4 }]}>Detected Items</Text>
              {items.map((item, i) => (
                <View key={i} style={styles.itemCard}>
                  <View style={styles.itemNameRow}>
                    <TextInput
                      style={styles.itemNameInput}
                      value={item.name}
                      onChangeText={(v) => updateItem(i, 'name', v)}
                      placeholder="Food name"
                      placeholderTextColor={tc.textMuted}
                    />
                    <TouchableOpacity
                      style={styles.estimateBtn}
                      onPress={() => handleReestimate(i)}
                      disabled={estimatingIndex === i}
                    >
                      {estimatingIndex === i ? (
                        <ActivityIndicator size="small" color={tc.action} />
                      ) : (
                        <Ionicons name="sparkles-outline" size={16} color={tc.action} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeItem(i)} style={styles.removeBtn}>
                      <Ionicons name="close-circle" size={20} color={tc.attention} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.itemDetailRow}>
                    <TextInput
                      style={styles.qtyInput}
                      value={item.quantity}
                      onChangeText={(v) => updateItem(i, 'quantity', v)}
                      placeholder="Qty"
                      placeholderTextColor={tc.textMuted}
                    />
                    <View style={styles.nutriGroup}>
                      {[
                        { label: 'Cal', key: 'calories' },
                        { label: 'Prot', key: 'protein' },
                        { label: 'Carbs', key: 'carbs' },
                        { label: 'Fat', key: 'fat' },
                      ].map((f) => (
                        <View style={styles.nutriField} key={f.key}>
                          <Text style={styles.nutriLabel}>{f.label}</Text>
                          <TextInput
                            style={styles.nutriInput}
                            value={(item as any)[f.key] ? (item as any)[f.key].toString() : ''}
                            onChangeText={(v) => updateItem(i, f.key as any, parseFloat(v) || 0)}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={tc.textMuted}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
                <Ionicons name="add" size={16} color={tc.action} />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>

              {/* Macro Summary */}
              <View style={styles.macroSummary}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryVal}>{totalCal}</Text>
                  <Text style={styles.summaryLabel}>Cal</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={[styles.summaryVal, { color: tc.action }]}>{totalProt}g</Text>
                  <Text style={styles.summaryLabel}>Protein</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={[styles.summaryVal, { color: tc.carbs }]}>{totalCarbs}g</Text>
                  <Text style={styles.summaryLabel}>Carbs</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={[styles.summaryVal, { color: tc.fat }]}>{totalFat}g</Text>
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
            placeholderTextColor={tc.textMuted}
          />
        </ScrollView>

        {/* Reply Input */}
        {hasQuestions && !loading && (
          <View style={styles.replyRow}>
            <TextInput
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Reply to AI..."
              placeholderTextColor={tc.textMuted}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!replyText.trim() || sending) && { opacity: 0.3 }]}
              onPress={handleSendReply}
              disabled={!replyText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={tc.canvas} />
              ) : (
                <Ionicons name="arrow-up" size={16} color={tc.canvas} />
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
            style={[styles.confirmBtn, (items.length === 0 || loading) && { opacity: 0.3 }]}
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
  appBarCenter: { alignItems: 'center' },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tc.textPrimary,
    letterSpacing: -0.3,
  },
  iconBtn: { padding: 8, borderRadius: tr.full },
  scroll: { padding: ts.gutter, gap: 12, paddingBottom: 20 },

  // Meal type selector
  mealTypeRow: { flexDirection: 'row', gap: 6 },
  mealTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: tr.DEFAULT,
    backgroundColor: tc.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  mealTypeText: { fontSize: 11, fontWeight: '600', color: tc.textMuted },

  // Image
  imagePreview: { borderRadius: tr.lg, overflow: 'hidden', marginTop: 4 },
  mealImage: { width: '100%', height: 180, borderRadius: tr.lg },

  // Loading & AI bubble
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: tc.surface,
    borderRadius: tr.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  loadingText: { fontSize: 13, color: tc.textSecondary },
  aiBubble: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: tc.surface,
    borderRadius: tr.lg,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.borderFocus,
  },
  aiText: { flex: 1, fontSize: 13, color: tc.textPrimary, lineHeight: 19 },

  // Items
  itemCard: {
    backgroundColor: tc.surface,
    borderRadius: tr.DEFAULT,
    padding: 12,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemNameInput: {
    flex: 1,
    height: 38,
    paddingHorizontal: 12,
    color: tc.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(244,247,251,0.04)',
    borderRadius: 8,
  },
  estimateBtn: { padding: 6, borderRadius: tr.full },
  removeBtn: { padding: 2 },
  itemDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  qtyInput: {
    width: 72,
    height: 50,
    paddingHorizontal: 6,
    color: tc.textPrimary,
    fontSize: 12,
    backgroundColor: 'rgba(244,247,251,0.04)',
    borderRadius: 8,
    textAlign: 'center',
  },
  nutriGroup: { flex: 1, flexDirection: 'row', gap: 4 },
  nutriField: { flex: 1, alignItems: 'center', gap: 3 },
  nutriLabel: {
    fontSize: 8,
    color: tc.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  nutriInput: {
    width: '100%',
    height: 30,
    backgroundColor: 'rgba(244,247,251,0.04)',
    borderRadius: 6,
    textAlign: 'center',
    color: tc.textPrimary,
    fontSize: 12,
    fontWeight: '600',
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
    borderStyle: 'dashed',
  },
  addItemText: { fontSize: 13, color: tc.action, fontWeight: '600' },

  // Macro summary
  macroSummary: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: tc.surface,
    borderRadius: tr.DEFAULT,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  summaryChip: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 16, fontWeight: '700', color: tc.textPrimary },
  summaryLabel: { fontSize: 9, color: tc.textMuted, fontWeight: '600', marginTop: 2 },

  // Notes
  notesInput: {
    backgroundColor: tc.surface,
    borderRadius: tr.DEFAULT,
    height: 40,
    paddingHorizontal: 12,
    color: tc.textPrimary,
    fontSize: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },

  // Reply
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: ts.gutter,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tc.border,
  },
  replyInput: {
    flex: 1,
    backgroundColor: tc.surface,
    borderRadius: tr.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: tc.textPrimary,
    fontSize: 13,
    maxHeight: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: tc.action,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: ts.gutter,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tc.border,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: tr.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: tc.textSecondary },
  confirmBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: tr.lg,
    backgroundColor: tc.action,
  },
  confirmText: { fontSize: 14, fontWeight: '700', color: tc.canvas },

  // Describe meal input
  describeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  describeInput: {
    backgroundColor: 'rgba(244,247,251,0.04)',
    borderRadius: 10,
    padding: 12,
    color: tc.textPrimary,
    fontSize: 14,
    minHeight: 100,
    lineHeight: 20,
  },
  describeSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tc.action,
    paddingVertical: 12,
    borderRadius: 10,
  },
  describeSubmitText: { fontSize: 14, fontWeight: '700', color: tc.canvas },
});
