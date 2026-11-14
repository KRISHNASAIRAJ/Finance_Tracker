/**
 * MonthlySpendScreen — what the month has cost so far.
 *
 * Restyled to the Meridian v2 reference: the spend headline against the
 * budget, a daily-spend bar chart, the category limits and the month's
 * transactions.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  BarChart,
  Card,
  Label,
  PressScale,
  ProgressBar,
  Rise,
  Screen,
} from '../../../shared/components/meridian';
import ExpandableTransactionCard from '../../../shared/components/ExpandableTransactionCard';
import { getCategoryColor } from '../../../shared/categoryMap';
import CategoryIcon from '../../../shared/CategoryIcon';
import { useFinanceStore } from '../store';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import { useGarageStore } from '../../garage/store';
import { useAuth } from '../../../services/AuthProvider';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'MonthlySpend'>;

export default function MonthlySpendScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    transactions,
    monthlyBudget,
    setMonthlyBudget,
    fixedExpenses,
    categoryBudgets,
    deleteTransaction,
  } = useFinanceStore();
  const garageFills = useGarageStore((s) => s.fills);
  const { user } = useAuth();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonthName = monthNames[now.getMonth()];

  const EXCLUDED_CATEGORIES = [
    'Rent', 'SIP', 'Investments', 'Housing', 'Wallet Loads', 'Wallet Load',
    ...fixedExpenses.map((f: any) => f.name),
  ];
  const expenseTxs = transactions
    .filter((tx) => new Date(tx.date) >= startOfMonth)
    .filter((tx) => tx.type !== 'fixed_expense')
    .filter((tx) => tx.type !== 'fuel_purchase')
    .filter(
      (tx) =>
        !EXCLUDED_CATEGORIES.some(
          (cat) => cat.toLowerCase() === (tx.category || '').toLowerCase()
        )
    )
    .filter((tx) => tx.type === 'expense' || tx.type === 'vehicle_service');

  const monthGarageFills = garageFills.filter((f) => new Date(f.date) >= startOfMonth);
  const fuelFillAmount = monthGarageFills.reduce((sum, f) => sum + f.amount, 0);
  const totalSpend = expenseTxs.reduce((sum, tx) => sum + tx.amount, 0) + fuelFillAmount;

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const spentByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === 'income' || tx.type === 'credit_card_bill' || tx.type === 'fixed_expense') continue;
    // Fuel is counted from garage fills below (single source of truth — avoids double count)
    if (tx.type === 'fuel_purchase') continue;
    // Wallet loads are transfers, not spend — keep them out of the category bars
    if (
      EXCLUDED_CATEGORIES.some(
        (cat) => cat.toLowerCase() === (tx.category || '').toLowerCase()
      )
    )
      continue;
    if (tx.type !== 'expense' && tx.type !== 'vehicle_service') continue;
    if (!tx.date.startsWith(monthKey)) continue;
    spentByCategory.set(tx.category, (spentByCategory.get(tx.category) ?? 0) + tx.amount);
  }
  // Include garage fuel fills so the Fuel category bar reflects fills even when
  // the linked fuel_purchase transaction is missing (e.g. added while signed out)
  for (const f of garageFills) {
    if (!f.date || !f.date.startsWith(monthKey)) continue;
    spentByCategory.set('Fuel', (spentByCategory.get('Fuel') ?? 0) + f.amount);
  }

  const budgetPaise = (monthlyBudget || 0) * 100;
  const budgetExceeded = budgetPaise > 0 && totalSpend > budgetPaise;
  const remaining = budgetPaise > 0 ? Math.max(0, budgetPaise - totalSpend) : 0;
  const daysLeft = lastDay - now.getDate() + 1;
  const safePerDay = daysLeft > 0 && budgetPaise > 0 ? Math.round(remaining / daysLeft) : 0;
  const budgetUsedPct = budgetPaise > 0 ? Math.min(1, totalSpend / budgetPaise) : 0;

  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const monthlyTxs = transactions
    .filter((tx) => new Date(tx.date) >= startOfMonth)
    .filter((tx) => tx.type !== 'fixed_expense')
    .filter((tx) => tx.type !== 'fuel_purchase')
    .filter((tx) => tx.type !== 'credit_card_bill')
    .filter(
      (tx) =>
        !EXCLUDED_CATEGORIES.some(
          (cat) => cat.toLowerCase() === (tx.category || '').toLowerCase()
        )
    );

  const monthFuelPseudoTxs: any[] = monthGarageFills.map((f) => ({
    id: `fill-${f.id}`,
    type: 'expense',
    amount: f.amount,
    currency: 'INR',
    category: 'Fuel',
    notes: `${Number(f.liters).toFixed(2)}L Fuel`,
    date: f.date,
    source: 'manual',
  }));

  const allMonthTxs = [...monthlyTxs, ...monthFuelPseudoTxs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  const formatCurrencyDetailed = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  };

  // Daily spend for every day of the month so far.
  const todayDate = now.getDate();
  const dailySums: number[] = Array(todayDate).fill(0);
  expenseTxs.forEach((tx) => {
    const day = new Date(tx.date).getDate() - 1;
    if (day >= 0 && day < todayDate) dailySums[day] += tx.amount;
  });
  monthGarageFills.forEach((f) => {
    const day = new Date(f.date).getDate() - 1;
    if (day >= 0 && day < todayDate) dailySums[day] += f.amount;
  });

  const peakSpend = dailySums.length ? Math.max(...dailySums) : 0;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  return (
    <Screen
      bottomInset={110}
      floating={
        /* Floating action button — stays pinned to the screen, above the scroll content */
        <Rise index={5}>
          <PressScale
            onPress={() => navigation.navigate('AddExpense')}
            scale={0.95}
            style={styles.fab}
            accessibilityLabel="Add expense"
          >
            <Ionicons name="add" size={26} color={mc.white} />
          </PressScale>
        </Rise>
      }
    >
      {/* Header */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale onPress={() => navigation.goBack()} scale={0.9} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <Text style={styles.logoText}>Monthly spend</Text>
          <View style={styles.appBarSpacer} />
        </View>
      </Rise>

      {/* Spend vs budget */}
      <Rise index={1}>
        <Card>
          <View style={styles.summaryTop}>
            <View>
              <Label>SPENT THIS MONTH</Label>
              <Text style={[styles.summaryValue, { color: budgetExceeded ? mc.redSoft : mc.text }]}>
                {formatCurrency(totalSpend)}
              </Text>
            </View>
            {budgetPaise > 0 ? (
              <View style={styles.budgetAside}>
                <Text style={styles.budgetAsideText}>of {formatCurrency(budgetPaise)}</Text>
                <Text
                  style={[
                    styles.budgetAsidePct,
                    { color: budgetExceeded ? mc.redSoft : mc.amber },
                  ]}
                >
                  {Math.round(budgetUsedPct * 100)}% used
                </Text>
              </View>
            ) : null}
          </View>

          {budgetPaise > 0 ? (
            <>
              <ProgressBar
                value={budgetUsedPct}
                color={budgetExceeded ? mc.redSoft : mc.amber}
                height={10}
                style={styles.budgetBar}
              />
              <View style={styles.safeRow}>
                {budgetExceeded ? (
                  <View style={styles.safeChipWarn}>
                    <Ionicons name="warning" size={13} color={mc.redSoft} />
                    <Text style={[styles.safeChipText, { color: mc.redSoft }]}>
                      Over by {formatCurrency(totalSpend - budgetPaise)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.safeChip}>
                    <Text style={[styles.safeChipText, { color: mc.sky }]}>
                      Safe to spend {formatCurrency(safePerDay)}/day
                    </Text>
                  </View>
                )}
                <Text style={styles.daysLeft}>{daysLeft} days left</Text>
              </View>
              <View style={styles.budgetActions}>
                <PressScale
                  onPress={() => {
                    setBudgetInput((monthlyBudget || '').toString());
                    setBudgetModalVisible(true);
                  }}
                  scale={0.96}
                  style={styles.budgetBtn}
                >
                  <Text style={styles.budgetBtnText}>Edit budget</Text>
                </PressScale>
                <PressScale
                  onPress={() => navigation.navigate('CategoryBudgets')}
                  scale={0.96}
                  style={styles.budgetBtn}
                >
                  <Text style={styles.budgetBtnText}>Category limits</Text>
                </PressScale>
              </View>
            </>
          ) : (
            <PressScale
              onPress={() => {
                setBudgetInput('');
                setBudgetModalVisible(true);
              }}
              scale={0.97}
              style={styles.setBudgetBtn}
            >
              <Ionicons name="wallet-outline" size={16} color={mc.text} />
              <Text style={styles.setBudgetText}>Set monthly budget</Text>
            </PressScale>
          )}
        </Card>
      </Rise>

      {/* Daily spend */}
      {dailySums.some((v) => v > 0) ? (
        <Rise index={2}>
          <Card>
            <View style={styles.rowBetween}>
              <Label>DAILY SPEND</Label>
              <Text style={styles.rowValue}>Peak {formatCurrency(peakSpend)}</Text>
            </View>
            <BarChart
              data={dailySums.map((v, i) => ({
                label: String(i + 1),
                value: v / 100,
                color: i === (selectedDay ?? todayDate - 1) ? mc.red : mc.barDim,
              }))}
              width={300}
              height={104}
              onSelect={(i) => setSelectedDay(i)}
              selectedIndex={selectedDay ?? todayDate - 1}
              style={styles.chart}
            />
            <View style={styles.chartFoot}>
              <Text style={styles.chartFootText}>
                1 {currentMonthName}
              </Text>
              <Text style={styles.chartFootText}>
                {selectedDay !== null
                  ? `${currentMonthName} ${selectedDay + 1}: ${formatCurrency(dailySums[selectedDay])}`
                  : `Tap a bar to see its spend`}
              </Text>
              <Text style={[styles.chartFootText, { color: mc.redSoft }]}>
                {todayDate} {currentMonthName}
              </Text>
            </View>
          </Card>
        </Rise>
      ) : null}

      {/* Category limits */}
      {categoryBudgets.length > 0 ? (
        <Rise index={3}>
          <Card>
            <View style={styles.rowBetween}>
              <Label>CATEGORY LIMITS</Label>
              <PressScale
                onPress={() => navigation.navigate('CategoryBudgets')}
                scale={0.95}
              >
                <Text style={styles.manageLink}>Manage</Text>
              </PressScale>
            </View>
            {categoryBudgets.map((budget) => {
              const spent = spentByCategory.get(budget.category) ?? 0;
              const pct = budget.amountPaise > 0 ? Math.min(100, (spent / budget.amountPaise) * 100) : 0;
              const over = spent > budget.amountPaise;
              const catColor = getCategoryColor(budget.category, false);
              return (
                <View key={budget.category} style={styles.catLimitRow}>
                  <CategoryIcon category={budget.category} size={15} color={catColor} />
                  <Text
                    style={[styles.catLimitName, over && { color: mc.redSoft }]}
                    numberOfLines={1}
                  >
                    {budget.category}
                  </Text>
                  <View style={styles.catLimitTrack}>
                    <View
                      style={[
                        styles.catLimitFill,
                        {
                          width: `${Math.max(3, pct)}%`,
                          backgroundColor: over ? mc.redSoft : mc.amber,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.catLimitSpent}>{formatCurrency(spent)}</Text>
                </View>
              );
            })}
          </Card>
        </Rise>
      ) : null}

      {/* Transactions */}
      <Rise index={4}>
        <Label style={styles.sectionTitle}>TRANSACTIONS THIS MONTH</Label>
        <Card pad={false}>
          {allMonthTxs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={30} color={mc.textGhost} />
              <Text style={styles.emptyText}>No transactions logged this month</Text>
            </View>
          ) : (
            <>
              {allMonthTxs.slice(0, 5).map((tx: any) => (
                <ExpandableTransactionCard
                  key={tx.id}
                  tx={tx}
                  formatAmount={formatCurrencyDetailed}
                  onPressEdit={() => {
                    if (tx.id?.startsWith('fill-')) {
                      navigation.navigate('GarageTab' as any, {
                        screen: 'EditFuelFill',
                        params: { fillId: (tx.id as string).replace('fill-', '') },
                      });
                    } else {
                      navigation.navigate('EditTransaction', { transactionId: tx.id });
                    }
                  }}
                  onPressDelete={() => {
                    const isFill = tx.id?.startsWith('fill-');
                    Alert.alert(
                      'Delete Transaction',
                      `Delete "${tx.notes || tx.category}" for ${formatCurrencyDetailed(tx.amount)}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            if (isFill) {
                              useGarageStore
                                .getState()
                                .deleteFuelFill((tx.id as string).replace('fill-', ''), user?.id);
                            } else {
                              deleteTransaction(tx.id, user?.id);
                            }
                          },
                        },
                      ]
                    );
                  }}
                />
              ))}
              {allMonthTxs.length > 5 ? (
                <PressScale
                  onPress={() => navigation.navigate('AllTransactions')}
                  scale={0.97}
                  style={styles.viewAllBtn}
                >
                  <Text style={styles.viewAllText}>
                    View all ({allMonthTxs.length - 5} more)
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={mc.redSoft} />
                </PressScale>
              ) : null}
            </>
          )}
        </Card>
      </Rise>

      {/* Budget Modal */}
      <Modal
        visible={budgetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBudgetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Monthly budget</Text>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>BUDGET (₹)</Text>
              <TextInput
                style={styles.inp}
                value={budgetInput}
                onChangeText={setBudgetInput}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={mc.textFaint}
                autoFocus
              />
            </View>
            <View style={styles.modalBtns}>
              <PressScale onPress={() => setBudgetModalVisible(false)} scale={0.96}>
                <Text style={styles.modalCancelTxt}>Cancel</Text>
              </PressScale>
              <PressScale
                onPress={() => {
                  const v = parseFloat(budgetInput);
                  setMonthlyBudget(isNaN(v) ? 0 : Math.max(0, Math.round(v)), user?.id);
                  setBudgetModalVisible(false);
                }}
                scale={0.96}
              >
                <Text style={styles.modalSaveTxt}>Save</Text>
              </PressScale>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    flex: 1,
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },
  appBarSpacer: {
    width: 38,
  },

  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  summaryValue: {
    fontSize: 34,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  budgetAside: {
    alignItems: 'flex-end',
  },
  budgetAsideText: {
    fontSize: 12,
    color: mc.textDim,
  },
  budgetAsidePct: {
    fontSize: 13,
    marginTop: 2,
  },
  budgetBar: {
    marginVertical: 12,
  },
  safeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  safeChip: {
    backgroundColor: mc.skyDim,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  safeChipWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.redDim,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  safeChipText: {
    fontSize: 13,
  },
  daysLeft: {
    fontSize: 12,
    color: mc.textDim,
  },
  budgetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  budgetBtn: {
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  budgetBtnText: {
    fontSize: 12,
    color: mc.textDim,
    fontWeight: '600',
  },
  setBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: mc.raised,
    borderRadius: 22,
    paddingVertical: 12,
    marginTop: 12,
  },
  setBudgetText: {
    fontSize: 14,
    color: mc.text,
    fontWeight: '500',
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 12,
    color: mc.textDim,
  },
  chart: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  chartFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  chartFootText: {
    fontSize: 11,
    color: mc.textDim,
  },
  manageLink: {
    fontSize: 12,
    color: mc.redSoft,
    fontWeight: '600',
  },

  catLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 11,
  },
  catLimitName: {
    width: 58,
    fontSize: 13,
    color: mc.text,
  },
  catLimitTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: mc.track,
    overflow: 'hidden',
  },
  catLimitFill: {
    height: 8,
    borderRadius: 4,
  },
  catLimitSpent: {
    width: 62,
    textAlign: 'right',
    fontSize: 13,
    color: mc.text,
  },

  sectionTitle: {
    marginTop: 6,
    marginBottom: 8,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 13,
    color: mc.textDim,
    marginTop: 8,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  viewAllText: {
    fontSize: 13,
    color: mc.redSoft,
    fontWeight: '600',
  },

  fab: {
    position: 'absolute',
    bottom: 32,
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: mc.card,
    borderRadius: mr.card,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: mc.text,
  },
  inpGrp: {
    gap: 6,
  },
  inpLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: mc.textFaint,
  },
  inp: {
    backgroundColor: mc.raised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: mc.text,
    fontSize: 15,
  },
  modalBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 18,
    marginTop: 4,
  },
  modalCancelTxt: {
    fontSize: 14,
    color: mc.textDim,
  },
  modalSaveTxt: {
    fontSize: 14,
    color: mc.redSoft,
    fontWeight: '600',
  },
});
