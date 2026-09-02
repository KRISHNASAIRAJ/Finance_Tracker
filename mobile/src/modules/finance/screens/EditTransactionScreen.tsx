/**
 * EditTransactionScreen — form to edit an existing transaction's amount,
 * category, date and notes.
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
  Modal,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../../shared/categoryMap';
import CalendarPicker from '../../../shared/components/CalendarPicker';
import CategoryIcon from '../../../shared/CategoryIcon';

type EditTransactionRouteProp = RouteProp<FinanceStackParamList, 'EditTransaction'>;
type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'EditTransaction'>;
export default function EditTransactionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EditTransactionRouteProp>();
  const { transactionId } = route.params;

  const { transactions, editTransaction, deleteTransaction, accounts, cards } = useFinanceStore();
  const { user } = useAuth();
  const tx = transactions.find((t) => t.id === transactionId);

  if (!tx) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>Transaction not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const [amount, setAmount] = useState((tx.amount / 100).toString());
  const [description, setDescription] = useState(tx.notes || '');
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>(
    tx.type === 'income' ? 'income' : 'expense'
  );
  const [selectedCategory, setSelectedCategory] = useState(tx.category);
  const [txDate, setTxDate] = useState(new Date(tx.date));
  const [calendarVisible, setCalendarVisible] = useState(false);

  const categoriesList = transactionType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const parsePaymentMode = () => {
    const pm = tx.paymentMode || 'bank';
    if (pm === 'cash') return { mode: 'cash' as const, account: '' };
    if (pm.startsWith('upi:')) return { mode: 'upi' as const, account: pm.replace('upi:', '') };
    if (pm.startsWith('card:')) return { mode: 'card' as const, account: pm.replace('card:', '') };
    return { mode: 'bank' as const, account: '' };
  };
  const initialPayment = parsePaymentMode();
  const [paymentMode, setPaymentMode] = useState<'upi' | 'card' | 'cash' | 'bank'>(initialPayment.mode);
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState(initialPayment.account);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);

  const handleDelete = () => {
    Alert.alert('Delete Transaction', 'Are you sure you want to delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTransaction(tx.id, user?.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleSubmit = () => {
    const rawVal = parseFloat(amount);
    if (isNaN(rawVal) || rawVal <= 0) { alert('Please enter a valid amount'); return; }
    if (!description.trim()) { alert('Please enter a description'); return; }

    const accountName = paymentMode === 'upi' ? (accounts.find(a => a.id === selectedPaymentAccount)?.title || 'UPI') :
      paymentMode === 'card' ? (cards.find(c => c.id === selectedPaymentAccount)?.name || 'Card') : '';
    const pmValue = paymentMode === 'cash' ? 'cash' : paymentMode === 'bank' ? 'bank' : `${paymentMode}:${accountName}`;

    editTransaction(tx.id, {
      type: transactionType,
      amount: Math.round(rawVal * 100),
      category: selectedCategory,
      notes: description.trim(),
      date: txDate.toISOString(),
      paymentMode: pmValue,
    }, user?.id);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.formHeader}>
            <View style={styles.rowBetween}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Edit Transaction</Text>
              <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount */}
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
              onPress={() => { setTransactionType('expense'); setSelectedCategory(EXPENSE_CATEGORIES[0].name); }}
            >
              <Text style={[styles.toggleText, transactionType === 'expense' && styles.toggleTextActive]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, transactionType === 'income' && styles.toggleActiveIncome]}
              onPress={() => { setTransactionType('income'); setSelectedCategory(INCOME_CATEGORIES[0].name); }}
            >
              <Text style={[styles.toggleText, transactionType === 'income' && styles.toggleTextActive]}>Income</Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>TRANSACTION NAME</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Swiggy lunch, Salary"
              placeholderTextColor={colors.onSurfaceVariant}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Payment Mode (for expenses) */}
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
                <TouchableOpacity
                  style={[styles.toggleButton, paymentMode === 'bank' && styles.toggleActiveExpense]}
                  onPress={() => { setPaymentMode('bank'); setSelectedPaymentAccount(''); setShowPaymentDropdown(false); }}
                >
                  <Text style={[styles.toggleText, paymentMode === 'bank' && styles.toggleTextActive]}>Bank</Text>
                </TouchableOpacity>
              </View>

              {paymentMode === 'upi' && (
                <TouchableOpacity style={styles.dateTrigger} onPress={() => setShowPaymentDropdown(!showPaymentDropdown)} activeOpacity={0.8}>
                  <Ionicons name="wallet-outline" size={18} color={colors.primary} />
                  <Text style={styles.dateText}>
                    {selectedPaymentAccount ? (accounts.find(a => a.id === selectedPaymentAccount)?.title || 'Select Account') : 'Select Account'}
                  </Text>
                  <Ionicons name={showPaymentDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              )}

              {paymentMode === 'card' && (
                <TouchableOpacity style={styles.dateTrigger} onPress={() => setShowPaymentDropdown(!showPaymentDropdown)} activeOpacity={0.8}>
                  <Ionicons name="card-outline" size={18} color={colors.primary} />
                  <Text style={styles.dateText}>
                    {selectedPaymentAccount ? (cards.find(c => c.id === selectedPaymentAccount)?.name || 'Select Card') : 'Select Card'}
                  </Text>
                  <Ionicons name={showPaymentDropdown ? 'chevron-up' : 'chevron-down'} size={16} color={colors.onSurfaceVariant} />
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

          {/* Date Picker */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>DATE</Text>
            <TouchableOpacity
              style={styles.dateTrigger}
              onPress={() => setCalendarVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.dateText}>
                {txDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' })}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Categories Grid */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>CATEGORY</Text>
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
                    onPress={() => setSelectedCategory(cat.name)}
                  >
                    <CategoryIcon category={cat.name} size={13} color={isSelected ? cat.color : colors.onSurfaceVariant} />
                    <Text style={[styles.categoryText, isSelected && { color: cat.color, fontWeight: '700' }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={20} color={colors.textPrimary} />
              <Text style={styles.submitButtonText}>Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CalendarPicker
        visible={calendarVisible}
        selected={txDate}
        onSelect={setTxDate}
        onClose={() => setCalendarVisible(false)}
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
  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  errorText: { fontSize: 16, color: colors.error, fontWeight: '600' },
  backButton: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: rounded.DEFAULT,
  },
  backButtonText: { color: colors.textPrimary, fontWeight: '600' },
  scrollContent: { padding: spacing.containerPadding, gap: spacing.stackGapLg, paddingBottom: 40 },
  formHeader: { marginBottom: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { padding: 8, borderRadius: rounded.full },
  deleteBtn: { padding: 8, borderRadius: rounded.full, backgroundColor: `${colors.error}15` },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
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
  toggleButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: rounded.DEFAULT },
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
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}30`,
    height: 48,
    paddingHorizontal: 14,
  },
  dateText: { flex: 1, fontSize: 14, color: colors.onSurface, fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  buttonContainer: { gap: 10, paddingTop: 8 },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 16,
    borderRadius: rounded.lg,
    elevation: 6,
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  cancelButton: { alignItems: 'center', paddingVertical: 12 },
  cancelButtonText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '500' },
  // Category chip styles (legacy — kept for old chip-scroll layout)
  categoryScroll: { gap: 8, paddingVertical: 4 },
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

