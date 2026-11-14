/**
 * AddExpenseScreen — the Add transaction screen (expense and income).
 *
 * Redesigned to the Meridian v2 reference: expense/income segmented control,
 * a 48sp amount entry with quick-add chips, a name field with recent names,
 * sky/mint date-time fields, payment mode (UPI / Card, or account for
 * income), per-category tinted chips, notes and the slide-to-add track with
 * a red knob. All transaction logic is unchanged.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr, alpha } from '../../../shared/theme/meridian';
import {
  IconTile,
  Label,
  PressScale,
  Rise,
  Screen,
  TopBar,
} from '../../../shared/components/meridian';
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
import useReducedMotion from '../../../shared/components/meridian/useReducedMotion';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'AddExpense'>;

const QUICK_ADD = {
  expense: [100, 500, 1000],
  income: [500, 1000, 5000],
} as const;

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

  const reduced = useReducedMotion();
  const caretBlink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caretBlink, { toValue: 0, duration: 500, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(caretBlink, { toValue: 1, duration: 500, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, caretBlink]);

  const isExpense = transactionType === 'expense';
  const accent = isExpense ? mc.red : mc.mint;
  const iconAccent = isExpense ? mc.sky : mc.mint;

  // Default to the Slice card when available (or the first card)
  const defaultCardId = cards.find((c) => c.name.toLowerCase().includes('slice'))?.id
    ?? cards[0]?.id
    ?? '';
  const effectiveCardId = selectedPaymentAccount || defaultCardId;
  const selectedCard = cards.find((c) => c.id === effectiveCardId);
  const daysUntilDue = selectedCard?.dueDate
    ? Math.max(0, Math.ceil((new Date(selectedCard.dueDate).getTime() - Date.now()) / 86400000))
    : null;
  const primaryAccount =
    accounts.find((a) => a.id === selectedPaymentAccount) ?? accounts[0];

  const categoriesList = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
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

  const handleQuickAdd = (add: number) => {
    const cur = parseFloat(amount);
    const next = (isNaN(cur) ? 0 : cur) + add;
    setAmount(String(Number(next.toFixed(2))));
  };

  // Recent names — the three most-used expense names, newest as tiebreak.
  // Derived on-device from your own transaction history.
  const recentNames = useMemo(() => {
    const counts = new Map<string, { count: number; last: number }>();
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const name = (tx.notes ?? '').split(' — ')[0].trim();
      if (name.length < 2 || name.length > 24) continue;
      const cur = counts.get(name) ?? { count: 0, last: 0 };
      cur.count += 1;
      cur.last = Math.max(cur.last, new Date(tx.date).getTime() || 0);
      counts.set(name, cur);
    }
    return [...counts.entries()]
      .sort((a, b) => (b[1].count - a[1].count) || (b[1].last - a[1].last))
      .slice(0, 3)
      .map(([name]) => name);
  }, [transactions]);

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

  const renderCategoryChip = (cat: (typeof categoriesList)[number]) => {
    const isSelected = selectedCategory === cat.name;
    return (
      <PressScale
        key={cat.name}
        onPress={() => handleCategorySelect(cat.name)}
        scale={0.95}
        style={[
          styles.categoryChip,
          isSelected && { backgroundColor: alpha(cat.color, 0.12), borderColor: alpha(cat.color, 0.45) },
        ]}
        accessibilityLabel={`Category ${cat.name}`}
      >
        <CategoryIcon category={cat.name} size={15} color={cat.color} />
        <Text numberOfLines={1} style={[styles.categoryText, isSelected && { color: cat.color, fontWeight: '600' }]}>
          {cat.name}
        </Text>
      </PressScale>
    );
  };

  return (
    <Screen scroll={false} bottomInset={0}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TopBar
          title="Add transaction"
          variant="center"
          onBack={() => navigation.goBack()}
          right={<View style={styles.topBarSpacer} />}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Expense / income segmented control */}
          <Rise index={0}>
            <View style={styles.segmented}>
              {(['expense', 'income'] as const).map((t) => {
                const active = transactionType === t;
                const isExp = t === 'expense';
                return (
                  <PressScale
                    key={t}
                    onPress={() => handleTypeChange(t)}
                    scale={0.97}
                    wrapStyle={{ flex: 1 }}
                    style={[styles.segment, active && { backgroundColor: isExp ? mc.redDim : mc.mintDim }]}
                    accessibilityLabel={isExp ? 'Expense' : 'Income'}
                  >
                    <View style={styles.segmentInner}>
                      <Ionicons
                        name={isExp ? 'arrow-up' : 'arrow-down'}
                        size={15}
                        color={active ? (isExp ? mc.redSoft : mc.mint) : mc.textDim}
                      />
                      <Text style={[styles.segmentText, active && { color: isExp ? mc.redSoft : mc.mint, fontWeight: '500' }]}>
                        {isExp ? 'Expense' : 'Income'}
                      </Text>
                    </View>
                  </PressScale>
                );
              })}
            </View>
          </Rise>

          {/* Amount — 48sp, ₹ prefix, blinking caret */}
          <Rise index={1}>
            <View style={styles.amountBlock}>
              <View style={styles.amountRow}>
                <Text style={[styles.rupee, { color: isExpense ? mc.text : mc.mint }]}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor={mc.textGhost}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  autoFocus={false}
                  accessibilityLabel="Amount"
                />
                <Animated.View style={[styles.caret, { opacity: caretBlink, backgroundColor: accent }]} pointerEvents="none" />
              </View>
              <View style={styles.quickRow}>
                {QUICK_ADD[transactionType].map((v) => (
                  <PressScale
                    key={v}
                    onPress={() => handleQuickAdd(v)}
                    scale={0.95}
                    style={styles.quickChip}
                    accessibilityLabel={`Add ${v} rupees`}
                  >
                    <Text style={styles.quickChipText}>+₹{v.toLocaleString('en-IN')}</Text>
                  </PressScale>
                ))}
              </View>
            </View>
          </Rise>

          {/* Name */}
          <Rise index={2}>
            <View style={styles.formSection}>
              <Label style={styles.fieldLabel}>{isExpense ? 'EXPENSE NAME' : 'INCOME NAME'}</Label>
              <TextInput
                style={styles.textInput}
                placeholder={isExpense ? 'e.g. Swiggy, Rent, Petrol' : 'e.g. Salary, Cashback, Refund'}
                placeholderTextColor={mc.textGhost}
                value={expenseName}
                onChangeText={handleNameChange}
                accessibilityLabel={isExpense ? 'Expense name' : 'Income name'}
              />
              {isExpense && recentNames.length > 0 && (
                <View style={styles.recentRow}>
                  {recentNames.map((name) => (
                    <PressScale
                      key={name}
                      onPress={() => handleNameChange(name)}
                      scale={0.95}
                      style={styles.recentChip}
                    >
                      <Ionicons name="time-outline" size={12} color={mc.textDim} />
                      <Text style={styles.recentChipText}>{name}</Text>
                    </PressScale>
                  ))}
                </View>
              )}
            </View>
          </Rise>

          {/* Date & time */}
          <Rise index={3}>
            <View style={styles.formSection}>
              <Label style={styles.fieldLabel}>DATE AND TIME</Label>
              <View style={styles.dateTimeRow}>
                <PressScale
                  style={[styles.dateTrigger, { flex: 1.35 }]}
                  wrapStyle={{ flex: 1.35 }}
                  onPress={() => setShowDateTimePicker(true)}
                  scale={0.98}
                  accessibilityLabel="Choose date and time"
                >
                  <Ionicons name="calendar-outline" size={17} color={iconAccent} />
                  <Text style={styles.dateTriggerText}>
                    {selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </PressScale>
                <PressScale
                  style={[styles.dateTrigger, { flex: 1 }]}
                  wrapStyle={{ flex: 1 }}
                  onPress={() => setShowDateTimePicker(true)}
                  scale={0.98}
                  accessibilityLabel="Choose date and time"
                >
                  <Ionicons name="time-outline" size={17} color={iconAccent} />
                  <Text style={styles.dateTriggerText}>
                    {selectedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </Text>
                </PressScale>
              </View>
            </View>
          </Rise>

          {/* Payment mode (expense) / received in (income) */}
          <Rise index={4}>
            <View style={styles.formSection}>
              {isExpense ? (
                <>
                  <Label style={styles.fieldLabel}>PAYMENT MODE</Label>
                  <View style={styles.segmented}>
                    {(['upi', 'card'] as const).map((m) => {
                      const active = paymentMode === m;
                      return (
                        <PressScale
                          key={m}
                          onPress={() => setPaymentMode(m)}
                          scale={0.97}
                          wrapStyle={{ flex: 1 }}
                          style={[styles.segment, active && styles.segmentActive]}
                          accessibilityLabel={m === 'upi' ? 'Pay with UPI' : 'Pay with card'}
                        >
                          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                            {m === 'upi' ? 'UPI' : 'Card'}
                          </Text>
                        </PressScale>
                      );
                    })}
                  </View>

                  {paymentMode === 'upi' && accounts.length > 0 && (
                    <PressScale style={styles.accountRow} scale={0.99} onPress={() => setShowPaymentDropdown((v) => !v)} accessibilityLabel="Choose account">
                      <IconTile icon="wallet-outline" color={mc.violet} background={mc.violetDim} size={38} />
                      <View style={styles.accountMain}>
                        <Text style={styles.accountName} numberOfLines={1}>
                          {selectedPaymentAccount
                            ? (accounts.find(a => a.id === selectedPaymentAccount)?.title || 'Select account')
                            : 'UPI (no account selected)'}
                        </Text>
                        {selectedPaymentAccount ? (
                          <Text style={styles.accountSub}>
                            Balance ₹{((accounts.find(a => a.id === selectedPaymentAccount)?.amount ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name={showPaymentDropdown ? 'chevron-up' : 'chevron-down'} size={17} color={mc.textDim} />
                    </PressScale>
                  )}

                  {paymentMode === 'card' && (
                    <PressScale style={styles.accountRow} scale={0.99} onPress={() => setShowPaymentDropdown((v) => !v)} accessibilityLabel="Choose card">
                      <IconTile icon="card-outline" color={mc.redSoft} background={mc.redDim} size={38} />
                      <View style={styles.accountMain}>
                        <Text style={styles.accountName} numberOfLines={1}>
                          {selectedCard?.name ?? 'Select card'}
                        </Text>
                        {selectedCard ? (
                          <Text style={styles.accountSub}>
                            •••• {selectedCard.endingWith}
                            {daysUntilDue !== null ? ` · due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}` : ''}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name={showPaymentDropdown ? 'chevron-up' : 'chevron-down'} size={17} color={mc.textDim} />
                    </PressScale>
                  )}
                </>
              ) : (
                <>
                  <Label style={styles.fieldLabel}>RECEIVED IN</Label>
                  {accounts.length > 0 ? (
                    <PressScale
                      style={styles.accountRow}
                      scale={0.99}
                      onPress={() => {
                        setPaymentMode('upi');
                        setShowPaymentDropdown((v) => !v);
                      }}
                      accessibilityLabel="Choose account"
                    >
                      <IconTile icon="business-outline" color={mc.sky} background={mc.skyDim} size={38} />
                      <View style={styles.accountMain}>
                        <Text style={styles.accountName} numberOfLines={1}>
                          {primaryAccount?.title ?? 'Select account'}
                        </Text>
                        {primaryAccount ? (
                          <Text style={styles.accountSub}>
                            Balance ₹{(primaryAccount.amount / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name={showPaymentDropdown ? 'chevron-up' : 'chevron-down'} size={17} color={mc.textDim} />
                    </PressScale>
                  ) : null}
                </>
              )}

              {/* Dropdown — same list for UPI / card / income */}
              {showPaymentDropdown && isExpense && paymentMode === 'upi' && (
                <View style={styles.dropdown}>
                  {accounts.map((acc) => {
                    const active = selectedPaymentAccount === acc.id;
                    return (
                      <PressScale
                        key={acc.id}
                        style={[styles.dropdownRow, active && styles.dropdownRowActive]}
                        onPress={() => { setSelectedPaymentAccount(acc.id); setShowPaymentDropdown(false); }}
                        scale={0.99}
                      >
                        <Text style={[styles.dropdownText, active && { color: mc.redSoft }]}>{acc.title}</Text>
                        <Text style={styles.dropdownMeta}>
                          ₹{(acc.amount / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                      </PressScale>
                    );
                  })}
                </View>
              )}
              {showPaymentDropdown && isExpense && paymentMode === 'card' && (
                <View style={styles.dropdown}>
                  {cards.map((c) => {
                    const active = effectiveCardId === c.id;
                    return (
                      <PressScale
                        key={c.id}
                        style={[styles.dropdownRow, active && styles.dropdownRowActive]}
                        onPress={() => { setSelectedPaymentAccount(c.id); setShowPaymentDropdown(false); }}
                        scale={0.99}
                      >
                        <Text style={[styles.dropdownText, active && { color: mc.redSoft }]}>
                          {c.name} (•• {c.endingWith})
                        </Text>
                      </PressScale>
                    );
                  })}
                </View>
              )}
              {showPaymentDropdown && !isExpense && (
                <View style={styles.dropdown}>
                  {accounts.map((acc) => {
                    const active = selectedPaymentAccount === acc.id;
                    return (
                      <PressScale
                        key={acc.id}
                        style={[styles.dropdownRow, active && styles.dropdownRowActive]}
                        onPress={() => { setSelectedPaymentAccount(acc.id); setShowPaymentDropdown(false); }}
                        scale={0.99}
                      >
                        <Text style={[styles.dropdownText, active && { color: mc.mint }]}>{acc.title}</Text>
                        <Text style={styles.dropdownMeta}>
                          ₹{(acc.amount / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                      </PressScale>
                    );
                  })}
                </View>
              )}
            </View>
          </Rise>

          {/* Category chips */}
          <Rise index={5}>
            <View style={styles.formSection}>
              <View style={styles.categoryHeader}>
                <Label style={styles.fieldLabel}>CATEGORY</Label>
                {!isManualCategory && expenseName.trim() !== '' && (
                  <View style={styles.autoDetectBadge}>
                    <Ionicons name="flash" size={10} color={selectedCatObj.color} />
                    <Text style={[styles.detectedLabel, { color: selectedCatObj.color }]}>Auto-detected</Text>
                  </View>
                )}
              </View>

              {!categoriesExpanded && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {shownCategories.map(renderCategoryChip)}
                  {categoriesList.length > VISIBLE_CATEGORIES && (
                    <PressScale
                      style={styles.categoryExpandChip}
                      onPress={() => setCategoriesExpanded(true)}
                      scale={0.95}
                    >
                      <Ionicons name="chevron-down" size={13} color={mc.textDim} />
                      <Text style={styles.categoryExpandText}>View all ({categoriesList.length})</Text>
                    </PressScale>
                  )}
                </ScrollView>
              )}

              {categoriesExpanded && (
                <View style={styles.categoryGrid}>
                  {categoriesList.map(renderCategoryChip)}
                  <PressScale
                    style={styles.categoryExpandChip}
                    onPress={() => setCategoriesExpanded(false)}
                    scale={0.95}
                  >
                    <Ionicons name="chevron-up" size={13} color={mc.textDim} />
                    <Text style={styles.categoryExpandText}>Show less</Text>
                  </PressScale>
                </View>
              )}

              {limitWarning && budgetForCategory && (
                <View style={styles.limitWarning}>
                  <Ionicons name="warning" size={14} color={mc.redSoft} />
                  <Text style={styles.limitWarningText}>
                    This exceeds your {selectedCategory} limit of ₹
                    {(budgetForCategory.amountPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} —
                    {((spentThisMonth + newAmountPaise) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} spent
                    this month vs the limit.
                  </Text>
                </View>
              )}
            </View>
          </Rise>

          {/* Notes */}
          <Rise index={6}>
            <View style={styles.formSection}>
              <Label style={styles.fieldLabel}>NOTES</Label>
              <TextInput
                style={styles.textInput}
                placeholder="Add an optional note"
                placeholderTextColor={mc.textGhost}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </Rise>
        </ScrollView>

        {/* Slide to add + cancel */}
        <Rise index={7} style={styles.floatingBar}>
          <SlideToUnlock
            onComplete={handleSubmit}
            label={isExpense ? 'Slide to add' : 'Slide to add income'}
            completeLabel="Adding…"
            fillColor={accent}
            knobIconColor={isExpense ? mc.white : mc.ink}
          />
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} accessibilityLabel="Cancel">
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </Rise>
      </KeyboardAvoidingView>

      <DateTimePicker
        visible={showDateTimePicker}
        selected={selectedDate}
        onSelect={(d) => { setSelectedDate(d); setShowDateTimePicker(false); }}
        onClose={() => setShowDateTimePicker(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 24,
    gap: 14,
  },
  topBarSpacer: {
    width: 38,
  },

  // Segmented control
  segmented: {
    flexDirection: 'row',
    backgroundColor: mc.card,
    borderRadius: 20,
    padding: 4,
    gap: 2,
  },
  segment: {
    paddingVertical: 9,
    borderRadius: 16,
    alignItems: 'center',
  },
  segmentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  segmentActive: {
    backgroundColor: mc.redDim,
  },
  segmentText: {
    fontSize: 14,
    color: mc.textDim,
  },
  segmentTextActive: {
    color: mc.redSoft,
    fontWeight: '500',
  },

  // Amount
  amountBlock: {
    alignItems: 'stretch',
    marginTop: 2,
    gap: 12,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  rupee: {
    fontSize: 44,
    fontWeight: '500',
    marginRight: 8,
  },
  amountInput: {
    width: 222,
    fontSize: 48,
    fontWeight: '500',
    color: mc.text,
    padding: 0,
  },
  caret: {
    width: 2,
    height: 40,
    borderRadius: 1,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  quickChip: {
    backgroundColor: mc.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: mc.mint,
  },

  // Fields
  formSection: {
    gap: 8,
  },
  fieldLabel: {
    paddingHorizontal: 4,
  },
  textInput: {
    backgroundColor: mc.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: mc.text,
  },

  // Recent names (expense)
  recentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recentChipText: {
    fontSize: 13,
    color: mc.text,
  },

  // Date & time
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateTriggerText: {
    fontSize: 15,
    color: mc.text,
  },

  // Payment mode / received in
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: mc.card,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  accountMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  accountName: {
    fontSize: 15,
    color: mc.text,
  },
  accountSub: {
    fontSize: 12,
    color: mc.textDim,
  },
  dropdown: {
    backgroundColor: mc.raised,
    borderRadius: 18,
    marginTop: 6,
    paddingVertical: 4,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  dropdownRowActive: {
    backgroundColor: alpha(mc.red, 0.08),
  },
  dropdownText: {
    fontSize: 15,
    color: mc.text,
    flexShrink: 1,
  },
  dropdownMeta: {
    fontSize: 13,
    color: mc.textDim,
  },

  // Category
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: mc.card,
    borderColor: 'transparent',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryText: {
    fontSize: 13,
    color: '#C8C8CE',
  },
  categoryExpandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryExpandText: {
    fontSize: 13,
    color: mc.textDim,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  autoDetectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detectedLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Limit warning
  limitWarning: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: mc.redDim,
    borderRadius: 14,
    padding: 12,
  },
  limitWarningText: {
    flex: 1,
    fontSize: 12,
    color: mc.redSoft,
    lineHeight: 18,
  },

  // Floating bar (slide track + cancel)
  floatingBar: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
    backgroundColor: mc.canvas,
    gap: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelButtonText: {
    fontSize: 14,
    color: mc.textDim,
  },
});
