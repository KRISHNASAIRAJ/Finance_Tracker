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
import { FinanceStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'AddExpense'>;

// ──────────────────────────────────────────────
// 25-category master list
// ──────────────────────────────────────────────
export interface Category {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export const EXPENSE_CATEGORIES: Category[] = [
  { name: 'Food & Dining',        icon: 'restaurant-outline',       color: '#fbbf24' },
  { name: 'Grocery',              icon: 'basket-outline',            color: '#84cc16' },
  { name: 'Fuel',                 icon: 'car-outline',               color: '#ef4444' },
  { name: 'Travel',               icon: 'airplane-outline',          color: '#38bdf8' },
  { name: 'Shopping',             icon: 'bag-outline',               color: '#a855f7' },
  { name: 'Bills & Recharge',     icon: 'receipt-outline',           color: '#f97316' },
  { name: 'Rent',                 icon: 'home-outline',              color: '#3b82f6' },
  { name: 'EMI',                  icon: 'repeat-outline',            color: '#6366f1' },
  { name: 'Entertainment',        icon: 'film-outline',              color: '#ec4899' },
  { name: 'OTT',                  icon: 'tv-outline',                color: '#8b5cf6' },
  { name: 'Youtube Premium',      icon: 'logo-youtube',              color: '#dc2626' },
  { name: 'Education',            icon: 'school-outline',            color: '#0ea5e9' },
  { name: 'Medical',              icon: 'medkit-outline',            color: '#22c55e' },
  { name: 'Health & Wellness',    icon: 'fitness-outline',           color: '#10b981' },
  { name: 'Insurance',            icon: 'shield-checkmark-outline',  color: '#059669' },
  { name: 'SIP',                  icon: 'trending-up-outline',       color: '#06b6d4' },
  { name: 'Equity Investment',    icon: 'bar-chart-outline',         color: '#0284c7' },
  { name: 'Card Annual Charges',  icon: 'card-outline',              color: '#7c3aed' },
  { name: 'Interest',             icon: 'calculator-outline',        color: '#b45309' },
  { name: 'Family',               icon: 'heart-outline',             color: '#f43f5e' },
  { name: 'Friends',              icon: 'people-outline',            color: '#14b8a6' },
  { name: 'Cash Withdrawal',      icon: 'cash-outline',              color: '#d97706' },
  { name: 'Wallet Loads',         icon: 'wallet-outline',            color: '#7c3aed' },
  { name: 'Professional Service', icon: 'briefcase-outline',         color: '#475569' },
  { name: 'Others',               icon: 'ellipsis-horizontal-outline', color: '#64748b' },
];

export const INCOME_CATEGORIES: Category[] = [
  { name: 'Salary',       icon: 'cash-outline',          color: '#22c55e' },
  { name: 'Freelance',    icon: 'briefcase-outline',     color: '#10b981' },
  { name: 'Investment',   icon: 'trending-up-outline',   color: '#06b6d4' },
  { name: 'Others',       icon: 'ellipsis-horizontal-outline', color: '#64748b' },
];

export const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
  const name = category.toLowerCase().trim();
  const found = EXPENSE_CATEGORIES.find(c => c.name.toLowerCase() === name) || INCOME_CATEGORIES.find(c => c.name.toLowerCase() === name);
  return found ? found.icon : 'receipt-outline';
};

export const getCategoryColor = (category: string, isIncome?: boolean): string => {
  const name = category.toLowerCase().trim();
  const found = isIncome 
    ? (INCOME_CATEGORIES.find(c => c.name.toLowerCase() === name) || EXPENSE_CATEGORIES.find(c => c.name.toLowerCase() === name))
    : (EXPENSE_CATEGORIES.find(c => c.name.toLowerCase() === name) || INCOME_CATEGORIES.find(c => c.name.toLowerCase() === name));
  return found ? found.color : '#64748b'; // default grey
};

// ──────────────────────────────────────────────
// Smart auto-detection
// ──────────────────────────────────────────────
export const autoDetectCategory = (name: string, type: 'expense' | 'income'): string => {
  const n = name.toLowerCase().trim();
  if (!n) return type === 'expense' ? EXPENSE_CATEGORIES[0].name : INCOME_CATEGORIES[0].name;

  if (type === 'income') {
    if (n.includes('salary') || n.includes('paycheck')) return 'Salary';
    if (n.includes('freelance') || n.includes('project') || n.includes('consulting')) return 'Freelance';
    return 'Others';
  }

  // Expense detection
  if (n.includes('swiggy') || n.includes('zomato') || n.includes('restaurant') || n.includes('food') ||
      n.includes('pizza') || n.includes('burger') || n.includes('cafe') || n.includes('tiffin') ||
      n.includes('lunch') || n.includes('dinner') || n.includes('breakfast')) return 'Food & Dining';

  if (n.includes('zepto') || n.includes('blinkit') || n.includes('grocery') || n.includes('kirana') ||
      n.includes('vegetables') || n.includes('market')) return 'Grocery';

  if (n.includes('petrol') || n.includes('fuel') || n.includes('diesel') || n.includes('hp') ||
      n.includes('bpcl') || n.includes('ioc')) return 'Fuel';

  if (n.includes('rent') || n.includes('pg') || n.includes('apartment') || n.includes('flat')) return 'Rent';

  if (n.includes('amazon') || n.includes('flipkart') || n.includes('myntra') || n.includes('shopping') ||
      n.includes('mall') || n.includes('fashion')) return 'Shopping';

  if (n.includes('sip') || n.includes('mutual fund') || n.includes('mf')) return 'SIP';

  if (n.includes('equity') || n.includes('stock') || n.includes('share') || n.includes('zerodha') ||
      n.includes('kite') || n.includes('nse') || n.includes('bse')) return 'Equity Investment';

  if (n.includes('netflix') || n.includes('prime') || n.includes('hotstar') || n.includes('zee5') ||
      n.includes('sonyliv') || n.includes('jio cinema') || n.includes('ott')) return 'OTT';

  if (n.includes('youtube')) return 'Youtube Premium';

  if (n.includes('electricity') || n.includes('mobile') || n.includes('broadband') || n.includes('recharge') ||
      n.includes('bill') || n.includes('postpaid')) return 'Bills & Recharge';

  if (n.includes('emi') || n.includes('loan')) return 'EMI';

  if (n.includes('doctor') || n.includes('hospital') || n.includes('medicine') || n.includes('pharmacy') ||
      n.includes('clinic')) return 'Medical';

  if (n.includes('gym') || n.includes('health') || n.includes('wellness') || n.includes('yoga')) return 'Health & Wellness';

  if (n.includes('insurance') || n.includes('lic') || n.includes('policy')) return 'Insurance';

  if (n.includes('travel') || n.includes('flight') || n.includes('train') || n.includes('bus') ||
      n.includes('irctc') || n.includes('rapido') || n.includes('ola') || n.includes('uber') ||
      n.includes('metro')) return 'Travel';

  if (n.includes('movie') || n.includes('bookmyshow') || n.includes('pvr') || n.includes('inox') ||
      n.includes('entertainment')) return 'Entertainment';

  if (n.includes('card') && (n.includes('annual') || n.includes('fee') || n.includes('charge'))) return 'Card Annual Charges';

  if (n.includes('education') || n.includes('course') || n.includes('udemy') || n.includes('book') ||
      n.includes('school') || n.includes('college')) return 'Education';

  if (n.includes('atm') || n.includes('withdraw') || n.includes('cash')) return 'Cash Withdrawal';

  if (n.includes('paytm') || n.includes('phonepe') || n.includes('gpay') || n.includes('wallet')) return 'Wallet Loads';

  return 'Others';
};

export default function AddExpenseScreen() {
  const navigation = useNavigation<NavigationProp>();
  const addTransaction = useFinanceStore((state) => state.addTransaction);

  const [amount, setAmount] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [notes, setNotes] = useState('');
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [selectedCategory, setSelectedCategory] = useState(EXPENSE_CATEGORIES[0].name);
  const [isManualCategory, setIsManualCategory] = useState(false);

  const categoriesList = transactionType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

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
    const newId = addTransaction({
      type: transactionType,
      amount: amountInPaise,
      currency: 'INR',
      category: selectedCategory,
      notes: expenseName.trim() + (notes.trim() ? ` — ${notes.trim()}` : ''),
      source: 'manual',
    });

    navigation.navigate('ExpenseConfirmation', { transactionId: newId });
  };

  const selectedCatObj = categoriesList.find((c) => c.name === selectedCategory) || categoriesList[0];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* AppBar */}
          <View style={styles.appBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.appBarTitle}>Add Transaction</Text>
            <View style={{ width: 40 }} />
          </View>

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
              autoFocus
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
                    <Ionicons name={cat.icon} size={14} color={isSelected ? cat.color : colors.onSurfaceVariant} />
                    <Text style={[styles.categoryText, isSelected && { color: cat.color, fontWeight: '700' }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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

          {/* Submit */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Log Transaction</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: { padding: spacing.containerPadding, gap: spacing.stackGapLg, paddingBottom: 40 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: { padding: 8, borderRadius: rounded.full },
  appBarTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
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
  toggleTextActive: { color: '#fff' },
  formSection: { gap: 10 },
  inputLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  textInput: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  categoryText: { fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant },
  buttonContainer: { gap: 10, paddingTop: 8 },
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
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelButton: { alignItems: 'center', paddingVertical: 12 },
  cancelButtonText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '500' },
});
