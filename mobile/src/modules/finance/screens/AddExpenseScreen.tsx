/**
 * AddExpenseScreen — Windfall-style transaction entry.
 * Type it naturally ("Lunch at Starbucks 300 UPI") → the smart parser fills
 * amount, category, payment mode and notes; review the chips before saving
 * with the floating bottom action. The full form below acts as the editor.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  autoDetectCategory,
} from '../../../shared/categoryMap';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import DateTimePicker from '../../../shared/components/DateTimePicker';
import CategoryIcon from '../../../shared/CategoryIcon';
import { smartParse } from '../smartParse';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'AddExpense'>;

export default function AddExpenseScreen() {
  const navigation = useNavigation<NavigationProp>();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const accounts = useFinanceStore((state) => state.accounts);
  const cards = useFinanceStore((state) => state.cards);
  const { user } = useAuth();

  const [smartInput, setSmartInput] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [notes, setNotes] = useState('');
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [selectedCategory, setSelectedCategory] = useState(EXPENSE_CATEGORIES[0].name);
  const [isManualCategory, setIsManualCategory] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'upi' | 'card' | 'cash'>('cash');
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState<string>('');
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [smartUsed, setSmartUsed] = useState(false);
  const [smsModalVisible, setSmsModalVisible] = useState(false);
  const [smsText, setSmsText] = useState('');

  const categoriesList = transactionType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const applyParsed = (parsed: ReturnType<typeof smartParse>) => {
    setTransactionType(parsed.type);
    setIsManualCategory(false);
    if (parsed.amount !== null) setAmount(String(parsed.amount));
    if (parsed.notes) setExpenseName(parsed.notes);
    setSelectedCategory(parsed.category);
    if (parsed.paymentMode === 'cash') setPaymentMode('cash');
    else if (parsed.paymentMode === 'card') setPaymentMode('card');
    else if (parsed.paymentMode === 'upi' || parsed.paymentMode === 'bank') setPaymentMode('upi');
    if (parsed.date) setSelectedDate(parsed.date);
    setSmartUsed(true);
  };

  const applySmartParse = () => {
    const parsed = smartParse(smartInput);
    if (parsed.amount === null && !parsed.notes) {
      alert('Add an amount, e.g. "Lunch 300 upi" or "Salary 45000"');
      return;
    }
    applyParsed(parsed);
  };

  const applySmsParse = () => {
    const parsed = smartParse(smsText);
    if (parsed.amount === null) {
      alert('Could not find an amount in the SMS. Paste a bank alert like "Rs.5000 debited ... on 12-Mar-25 via UPI".');
      return;
    }
    applyParsed(parsed);
    setSmsModalVisible(false);
    setSmsText('');
  };

  const handleNameChange = (name: string) => {
    setExpenseName(name);
    if (!isManualCategory) {
      setSelectedCategory(autoDetectCategory(name, transactionType));
    }
  };

  const handleTypeChange = (type: 'expense' | 'income') => {
    setTransactionType(type);
    setIsManualCategory(false);
    const cats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    setSelectedCategory(expenseName ? autoDetectCategory(expenseName, type) : cats[0].name);
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setIsManualCategory(true);
  };

  const handleSubmit = () => {
    const rawVal = parseFloat(amount);
    if (isNaN(rawVal) || rawVal <= 0) { alert('Please enter a valid amount'); return; }
    if (!expenseName.trim()) { alert('Please enter an expense/income name'); return; }

    const amountInPaise = Math.round(rawVal * 100);
    const accountName = paymentMode === 'upi' ? (accounts.find(a => a.id === selectedPaymentAccount)?.title || 'UPI') :
      paymentMode === 'card' ? (cards.find(c => c.id === selectedPaymentAccount)?.name || 'Card') : '';
    const newId = addTransaction({
      type: transactionType,
      amount: amountInPaise,
      currency: 'INR',
      category: selectedCategory,
      notes: expenseName.trim() + (notes.trim() ? ` — ${notes.trim()}` : ''),
      source: 'manual',
      date: selectedDate.toISOString(),
      paymentMode: paymentMode === 'cash' ? 'cash' : `${paymentMode}:${accountName}`,
    }, user?.id);

    navigation.navigate('ExpenseConfirmation', { transactionId: newId });
  };

  const selectedCatObj = categoriesList.find((c) => c.name === selectedCategory) || categoriesList[0];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* AppBar */}
          <View style={styles.appBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.appBarTitle}>Add Transaction</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Smart Add — Windfall-style natural language entry */}
          <View style={styles.smartPanel}>
            <View style={styles.smartInputRow}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
              <TextInput
                style={styles.smartInput}
                placeholder="Type it — try “Lunch at Starbucks 300 UPI”"
                placeholderTextColor={colors.onSurfaceVariant}
                value={smartInput}
                onChangeText={setSmartInput}
                onSubmitEditing={applySmartParse}
                returnKeyType="go"
                autoCapitalize="sentences"
              />
              <TouchableOpacity style={styles.smartGoBtn} onPress={applySmartParse} activeOpacity={0.8}>
                <Ionicons name="arrow-forward" size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.smartHintRow}>
              <Text style={styles.smartHint}>Type it naturally — amount, category and payment are filled for you to review.</Text>
              <TouchableOpacity style={styles.smsBtn} onPress={() => setSmsModalVisible(true)} activeOpacity={0.8}>
                <Ionicons name="chatbox-ellipses-outline" size={13} color={colors.primary} />
                <Text style={styles.smsBtnText}>Paste SMS</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Review chips — shown once smart entry has filled fields */}
          {smartUsed && (
            <View style={styles.reviewChips}>
              {amount !== '' && (
                <View style={styles.reviewChip}>
                  <Text style={styles.reviewChipLabel}>AMOUNT</Text>
                  <Text style={styles.reviewChipValue}>₹{amount}</Text>
                </View>
              )}
              <View style={styles.reviewChip}>
                <Text style={styles.reviewChipLabel}>CATEGORY</Text>
                <Text style={[styles.reviewChipValue, { color: selectedCatObj.color }]}>{selectedCategory}</Text>
              </View>
              <View style={styles.reviewChip}>
                <Text style={styles.reviewChipLabel}>PAYMENT</Text>
                <Text style={styles.reviewChipValue}>{paymentMode.toUpperCase()}</Text>
              </View>
              <View style={styles.reviewChip}>
                <Text style={styles.reviewChipLabel}>DATE</Text>
                <Text style={styles.reviewChipValue}>
                  {selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            </View>
          )}

          {/* Large Amount Input */}
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={colors.outline}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          {/* Type Toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, transactionType === 'expense' && styles.toggleActiveExpense]}
              onPress={() => handleTypeChange('expense')}
            >
              <Text style={[styles.toggleText, transactionType === 'expense' && styles.toggleTextActive]}>
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, transactionType === 'income' && styles.toggleActiveIncome]}
              onPress={() => handleTypeChange('income')}
            >
              <Text style={[styles.toggleText, transactionType === 'income' && styles.toggleTextActive]}>
                Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* Name Input */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>{transactionType === 'expense' ? 'EXPENSE NAME' : 'INCOME NAME'}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={transactionType === 'expense' ? 'e.g. Swiggy, Rent, Petrol' : 'e.g. Salary, Project X'}
              placeholderTextColor={colors.onSurfaceVariant}
              value={expenseName}
              onChangeText={handleNameChange}
            />
          </View>

          {/* Category Grid */}
          <View style={styles.formSection}>
            <View style={styles.rowBetween}>
              <Text style={styles.inputLabel}>CATEGORY</Text>
              {!isManualCategory && expenseName.trim() !== '' && (
                <View style={styles.autoDetectBadge}>
                  <Ionicons name="flash" size={10} color={selectedCatObj.color} />
                  <Text style={[styles.detectedLabel, { color: selectedCatObj.color }]}>Auto-detected</Text>
                </View>
              )}
            </View>
            <View style={styles.categoryGrid}>
              {categoriesList.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[
                      styles.categoryChip,
                      isSelected && { backgroundColor: `${cat.color}20`, borderColor: cat.color },
                    ]}
                    onPress={() => handleCategorySelect(cat.name)}
                  >
                    <CategoryIcon category={cat.name} size={14} color={isSelected ? cat.color : colors.onSurfaceVariant} />
                    <Text style={[styles.categoryText, isSelected && { color: cat.color, fontWeight: '700' }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Payment Mode */}
          {transactionType === 'expense' && (
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>PAYMENT MODE</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleButton, paymentMode === 'upi' && styles.toggleActiveExpense]}
                  onPress={() => { setPaymentMode('upi'); setSelectedPaymentAccount(''); setShowPaymentDropdown(false); }}
                >
                  <Text style={[styles.toggleText, paymentMode === 'upi' && styles.toggleTextActive]}>UPI</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, paymentMode === 'card' && styles.toggleActiveExpense]}
                  onPress={() => { setPaymentMode('card'); setSelectedPaymentAccount(''); setShowPaymentDropdown(false); }}
                >
                  <Text style={[styles.toggleText, paymentMode === 'card' && styles.toggleTextActive]}>Card</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, paymentMode === 'cash' && styles.toggleActiveExpense]}
                  onPress={() => { setPaymentMode('cash'); setSelectedPaymentAccount(''); setShowPaymentDropdown(false); }}
                >
                  <Text style={[styles.toggleText, paymentMode === 'cash' && styles.toggleTextActive]}>Cash</Text>
                </TouchableOpacity>
              </View>

              {paymentMode === 'upi' && (
                <TouchableOpacity
                  style={styles.datePickerTrigger}
                  onPress={() => setShowPaymentDropdown(!showPaymentDropdown)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="wallet-outline" size={18} color={colors.primary} />
                  <Text style={styles.datePickerText}>
                    {selectedPaymentAccount ? (accounts.find(a => a.id === selectedPaymentAccount)?.title || 'Select Account') : 'Select Account'}
                  </Text>
                  <Ionicons name={showPaymentDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={colors.onSurfaceVariant} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              )}

              {paymentMode === 'card' && (
                <TouchableOpacity
                  style={styles.datePickerTrigger}
                  onPress={() => setShowPaymentDropdown(!showPaymentDropdown)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="card-outline" size={18} color={colors.primary} />
                  <Text style={styles.datePickerText}>
                    {selectedPaymentAccount ? (cards.find(c => c.id === selectedPaymentAccount)?.name || 'Select Card') : 'Select Card'}
                  </Text>
                  <Ionicons name={showPaymentDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={colors.onSurfaceVariant} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              )}

              {showPaymentDropdown && paymentMode === 'upi' && (
                <View style={styles.dropdownList}>
                  {accounts.map((acc) => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[styles.dropdownItem, selectedPaymentAccount === acc.id && styles.dropdownItemActive]}
                      onPress={() => { setSelectedPaymentAccount(acc.id); setShowPaymentDropdown(false); }}
                    >
                      <Text style={[styles.dropdownItemText, selectedPaymentAccount === acc.id && styles.dropdownItemTextActive]}>
                        {acc.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {showPaymentDropdown && paymentMode === 'card' && (
                <View style={styles.dropdownList}>
                  {cards.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.dropdownItem, selectedPaymentAccount === c.id && styles.dropdownItemActive]}
                      onPress={() => { setSelectedPaymentAccount(c.id); setShowPaymentDropdown(false); }}
                    >
                      <Text style={[styles.dropdownItemText, selectedPaymentAccount === c.id && styles.dropdownItemTextActive]}>
                        {c.name} (•• {c.endingWith})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Date & Time Picker */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>DATE & TIME</Text>
            <TouchableOpacity
              style={styles.datePickerTrigger}
              onPress={() => setShowDateTimePicker(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.datePickerText}>
                {selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
              <Ionicons name="time-outline" size={16} color={colors.onSurfaceVariant} style={{ marginLeft: 'auto' }} />
              <Text style={styles.datePickerText}>
                {selectedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notes */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>NOTES (EXTRA INFO)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Add optional extra description..."
              placeholderTextColor={colors.onSurfaceVariant}
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </ScrollView>

        {/* Floating bottom action — Windfall-style add button */}
        <View style={styles.floatingBar}>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle" size={20} color={colors.textPrimary} />
            <Text style={styles.submitButtonText}>Log Transaction</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <DateTimePicker
        visible={showDateTimePicker}
        selected={selectedDate}
        onSelect={(d) => { setSelectedDate(d); setShowDateTimePicker(false); }}
        onClose={() => setShowDateTimePicker(false)}
      />

      {/* Paste SMS modal — paste a bank alert, parser fills the form */}
      <Modal visible={smsModalVisible} transparent animationType="slide" onRequestClose={() => setSmsModalVisible(false)}>
        <View style={styles.smsModalOverlay}>
          <View style={styles.smsModalCard}>
            <Text style={styles.smsModalTitle}>Paste bank SMS</Text>
            <Text style={styles.smsModalSubtitle}>
              Paste a bank alert like “Rs.5,000 debited from HDFC Bank on 12-Mar-25 via UPI” — we'll fill the form for you to review.
            </Text>
            <TextInput
              style={styles.smsTextInput}
              multiline
              numberOfLines={5}
              placeholder="Paste SMS text here…"
              placeholderTextColor={colors.onSurfaceVariant}
              value={smsText}
              onChangeText={setSmsText}
            />
            <View style={styles.smsModalActions}>
              <TouchableOpacity style={styles.smsCancelBtn} onPress={() => { setSmsModalVisible(false); setSmsText(''); }} activeOpacity={0.8}>
                <Text style={styles.smsCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smsParseBtn} onPress={applySmsParse} activeOpacity={0.8}>
                <Ionicons name="sparkles" size={14} color={colors.textPrimary} />
                <Text style={styles.smsParseText}>Parse</Text>
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
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  keyboardView: { flex: 1 },
  scrollContent: { padding: spacing.containerPadding, gap: spacing.stackGapLg, paddingBottom: 24 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: { padding: 8, borderRadius: rounded.full },
  appBarTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  smartPanel: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 12,
    gap: 8,
  },
  smartInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 46,
  },
  smartInput: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: '500',
  },
  smartGoBtn: {
    backgroundColor: colors.primaryContainer,
    width: 30,
    height: 30,
    borderRadius: rounded.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartHint: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  smartHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.primary}14`,
    borderRadius: rounded.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  smsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  smsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.containerPadding,
  },
  smsModalCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    padding: spacing.containerPadding,
    gap: 10,
  },
  smsModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  smsModalSubtitle: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 17,
  },
  smsTextInput: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: rounded.DEFAULT,
    padding: 12,
    minHeight: 110,
    color: colors.onSurface,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  smsModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  smsCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: rounded.DEFAULT,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  smsCancelText: {
    color: colors.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '600',
  },
  smsParseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: rounded.DEFAULT,
    backgroundColor: colors.primaryContainer,
  },
  smsParseText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  reviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reviewChipLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  reviewChipValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  currencySymbol: { fontSize: 48, fontWeight: '700', color: colors.primary },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.onSurface,
    minWidth: 120,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: rounded.DEFAULT,
  },
  toggleActiveExpense: { backgroundColor: colors.errorContainer },
  toggleActiveIncome: { backgroundColor: colors.successContainer },
  toggleText: { fontSize: 14, fontWeight: '600', color: colors.onSurfaceVariant },
  toggleTextActive: { color: colors.textPrimary },
  formSection: { gap: 10 },
  inputLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  textInput: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    height: 48,
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: '500',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  autoDetectBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detectedLabel: { fontSize: 11, fontWeight: '600' },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  categoryText: { fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    height: 44,
    paddingHorizontal: 14,
  },
  datePickerText: { fontSize: 14, color: colors.onSurface, fontWeight: '600' },
  floatingBar: {
    paddingHorizontal: spacing.containerPadding,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 6,
    backgroundColor: colors.background,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 16,
    borderRadius: rounded.lg,
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  cancelButton: { alignItems: 'center', paddingVertical: 8 },
  cancelButtonText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '500' },
  dropdownList: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: 4,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemActive: {
    backgroundColor: `${colors.primary}15`,
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.onSurface,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
