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
import SlideToUnlock from '../../../shared/components/SlideToUnlock';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'AddExpense'>;

export default function AddExpenseScreen() {
  const navigation = useNavigation<NavigationProp>();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const accounts = useFinanceStore((state) => state.accounts);
  const cards = useFinanceStore((state) => state.cards);
  const categoryBudgets = useFinanceStore((state) => state.categoryBudgets);
  const transactions = useFinanceStore((state) => state.transactions);
  const { user } = useAuth();

  const [amount, setAmount] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [notes, setNotes] = useState('');
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [selectedCategory, setSelectedCategory] = useState(EXPENSE_CATEGORIES[0].name);
  const [isManualCategory, setIsManualCategory] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'upi' | 'card'>('card');
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState<string>('');
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  // Default to the Slice card when available (or the first card)
  const defaultCardId = cards.find((c) => c.name.toLowerCase().includes('slice'))?.id
    ?? cards[0]?.id
    ?? '';
  const effectiveCardId = selectedPaymentAccount || defaultCardId;

  const categoriesList = transactionType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const VISIBLE_CATEGORIES = 6;
  const shownCategories = categoriesExpanded ? categoriesList : categoriesList.slice(0, VISIBLE_CATEGORIES);

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
    const accountName = paymentMode === 'upi'
      ? (accounts.find(a => a.id === selectedPaymentAccount)?.title || 'UPI')
      : (cards.find(c => c.id === effectiveCardId)?.name || 'Card');
    const newId = addTransaction({
      type: transactionType,
      amount: amountInPaise,
      currency: 'INR',
      category: selectedCategory,
      notes: expenseName.trim() + (notes.trim() ? ` — ${notes.trim()}` : ''),
      source: 'manual',
      date: selectedDate.toISOString(),
      paymentMode: paymentMode === 'upi' ? `upi:${accountName}` : `card:${accountName}`,
    }, user?.id);

    navigation.replace('ExpenseConfirmation', { transactionId: newId });
  };

  const selectedCatObj = categoriesList.find((c) => c.name === selectedCategory) || categoriesList[0];

  // Category limit warning — spent this month + this amount vs the set limit
  const budgetForCategory = categoryBudgets.find((b) => b.category === selectedCategory);
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const spentThisMonth = transactions
    .filter((tx) => tx.type === 'expense' && tx.category === selectedCategory && tx.date.startsWith(monthKey))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const newAmountPaise = isNaN(parseFloat(amount)) ? 0 : Math.round(parseFloat(amount) * 100);
  const limitWarning = budgetForCategory
    ? spentThisMonth + newAmountPaise > budgetForCategory.amountPaise
    : false;

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

          {/* Large Amount Input — compact & up top */}
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

          {/* Payment Mode */}
          {transactionType === 'expense' && (
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>PAYMENT MODE</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleButton, paymentMode === 'upi' && styles.toggleActiveExpense]}
                  onPress={() => setPaymentMode('upi')}
                >
                  <Text style={[styles.toggleText, paymentMode === 'upi' && styles.toggleTextActive]}>UPI</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, paymentMode === 'card' && styles.toggleActiveExpense]}
                  onPress={() => setPaymentMode('card')}
                >
                  <Text style={[styles.toggleText, paymentMode === 'card' && styles.toggleTextActive]}>Card</Text>
                </TouchableOpacity>
              </View>

              {paymentMode === 'upi' && accounts.length > 0 && (
                <TouchableOpacity
                  style={styles.datePickerTrigger}
                  onPress={() => setShowPaymentDropdown(!showPaymentDropdown)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="wallet-outline" size={18} color={colors.primary} />
                  <Text style={styles.datePickerText}>
                    {selectedPaymentAccount
                      ? (accounts.find(a => a.id === selectedPaymentAccount)?.title || 'Select Account')
                      : 'UPI (no account selected)'}
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
                    {cards.find(c => c.id === effectiveCardId)?.name || 'Select Card'}
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
                      style={[styles.dropdownItem, effectiveCardId === c.id && styles.dropdownItemActive]}
                      onPress={() => { setSelectedPaymentAccount(c.id); setShowPaymentDropdown(false); }}
                    >
                      <Text style={[styles.dropdownItemText, effectiveCardId === c.id && styles.dropdownItemTextActive]}>
                        {c.name} (•• {c.endingWith})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

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
                        {/* Collapsed: horizontal scroll of recent categories + View all at the end */}
            {!categoriesExpanded && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {shownCategories.map((cat) => {
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
                {categoriesList.length > VISIBLE_CATEGORIES && (
                  <TouchableOpacity
                    style={styles.categoryExpandChip}
                    onPress={() => setCategoriesExpanded(true)}
                  >
                    <View style={styles.categoryExpandIcon}>
                      <Ionicons name="chevron-down" size={14} color={colors.textPrimary} />
                    </View>
                    <Text style={styles.categoryExpandText}>
                      View all ({categoriesList.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}

            {/* Expanded: all categories wrapped below, full grid */}
            {categoriesExpanded && (
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
                <TouchableOpacity
                  style={styles.categoryExpandChip}
                  onPress={() => setCategoriesExpanded(false)}
                >
                  <View style={styles.categoryExpandIcon}>
                    <Ionicons name="chevron-up" size={14} color={colors.textPrimary} />
                  </View>
                  <Text style={styles.categoryExpandText}>Show less</Text>
                </TouchableOpacity>
              </View>
            )}
            {limitWarning && budgetForCategory && (
              <View style={styles.limitWarning}>
                <Ionicons name="warning" size={14} color={colors.error} />
                <Text style={styles.limitWarningText}>
                  This exceeds your {selectedCategory} limit of ₹
                  {(budgetForCategory.amountPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} —
                  {((spentThisMonth + newAmountPaise) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} spent
                  this month vs the limit.
                </Text>
              </View>
            )}
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

          {/* Type Toggle — moved to bottom, compact */}
          <View style={[styles.toggleRow, styles.typeToggleBottom]}>
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
        </ScrollView>

        {/* Floating bottom action — Windfall-style add button */}
        <View style={styles.floatingBar}>
          <SlideToUnlock onComplete={handleSubmit} label="Add transaction" completeLabel="Adding…" />
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
    paddingVertical: 6,
    gap: 6,
  },
  currencySymbol: { fontSize: 26, fontWeight: '700', color: colors.primary },
  amountInput: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.onSurface,
    minWidth: 100,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    padding: 4,
  },
  typeToggleBottom: {
    marginTop: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: rounded.DEFAULT,
  },
  toggleActiveExpense: { backgroundColor: colors.errorContainer },
  toggleActiveIncome: { backgroundColor: colors.successContainer },
  toggleText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
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
  limitWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${colors.error}14`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.error}30`,
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  limitWarningText: {
    flex: 1,
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
    lineHeight: 16,
  },
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
  categoryExpandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: rounded.full,
    backgroundColor: `${colors.primary}14`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}30`,
  },
  categoryExpandChipBlock: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  categoryExpandIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryExpandText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
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
