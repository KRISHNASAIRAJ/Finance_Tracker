/**
 * FinanceHomeScreen — the Finance tab.
 *
 * Restyled to the Meridian v2 reference: a net-worth hero with a trend
 * chart, a tile grid, a budget gauge, a credit-card bill panel, a weekly
 * spend bar chart and the top categories. Every existing destination
 * (balance summary, monthly spend, credit cards, bank accounts, lent and
 * borrowed, fixed expenses, wallet loads, reports, all transactions) is
 * still reachable.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  BarChart,
  Card,
  CountUp,
  Label,
  LineChart,
  PressScale,
  ProgressBar,
  RangeChips,
  Rise,
  Screen,
  SemicircleGauge,
  StatTile,
} from '../../../shared/components/meridian';
import DrawerTrigger from '../../../shared/components/DrawerTrigger';
import ExpandableTransactionCard from '../../../shared/components/ExpandableTransactionCard';
import { useFinanceStore, getMinBalanceForAccount } from '../store';
import { useGarageStore } from '../../garage/store';
import { useInvestmentsStore } from '../../equity/store';
import { useAuth } from '../../../services/AuthProvider';
import { processSyncQueue } from '../../../services/syncQueue';

type Nav = NativeStackNavigationProp<any>;

const CATEGORY_COLORS = [mc.red, mc.amber, mc.sky, mc.violet, mc.mint, mc.redSoft];

export default function FinanceHomeScreen() {
  const navigation = useNavigation<Nav>();
  const {
    transactions,
    cards,
    receivables,
    accounts,
    wallets,
    fixedExpenses,
    notifications,
    monthlyBudget,
    getTotalBalance,
    getWalletTotal,
    getMonthlyExpenses,
    deleteTransaction,
  } = useFinanceStore();
  const garageFills = useGarageStore((s) => s.fills);
  const snapshots = useInvestmentsStore((s) => s.snapshots);
  const todayPnL = useInvestmentsStore((s) => s.getTodayPnL());
  const { user } = useAuth();

  useFocusEffect(
    React.useCallback(() => {
      processSyncQueue();
    }, [])
  );

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  // ---- Donut entrance (kept from the original screen) ----
  const donutAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(donutAnim, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [donutAnim]);
  const donutRotate = donutAnim.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] });
  const donutOpacity = donutAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  // ---- Money ----
  const totalBalance = getTotalBalance();
  const totalMinBalance = accounts.reduce(
    (sum: number, acc: any) => sum + getMinBalanceForAccount(acc.title),
    0
  );
  const effectiveBalance = totalBalance - totalMinBalance;
  const monthlyExpenses = getMonthlyExpenses();
  const walletTotal = getWalletTotal();
  const accountsTotal = totalBalance - walletTotal;

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const chartMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalLent = receivables
    .filter((r: any) => r.type === 'lent')
    .reduce((acc: number, r: any) => acc + (r.amount - (r.paidAmount || 0)), 0);
  const totalBorrowed = receivables
    .filter((r: any) => r.type === 'borrowed')
    .reduce((acc: number, r: any) => acc + (r.amount - (r.paidAmount || 0)), 0);
  const cardOutstandingTotal = cards.reduce((acc: number, c: any) => acc + c.balance, 0);
  const unpaidFixedExpensesTotal = fixedExpenses
    .filter((f: any) => f.lastPaidMonth !== currentMonthStr)
    .reduce((sum: number, f: any) => sum + f.amount, 0);

  const payzappMonthlyLoad = transactions
    .filter(
      (tx: any) =>
        tx.type === 'expense' &&
        (tx.category?.toLowerCase() === 'wallet loads' ||
          tx.category?.toLowerCase() === 'wallet load' ||
          tx.notes?.toLowerCase().includes('payzapp wallet'))
    )
    .filter((tx: any) => new Date(tx.date) >= new Date(now.getFullYear(), now.getMonth(), 1))
    .reduce((sum: number, tx: any) => sum + tx.amount, 0);

  // User Formula: bank balance - min. balances + lent - borrow - fixed expenses - credit card bills
  const totalNetWorth =
    effectiveBalance + totalLent - totalBorrowed - unpaidFixedExpensesTotal - cardOutstandingTotal;

  // ---- Portfolio trend (real snapshots) ----
  const [range, setRange] = useState('1M');
  const trendSeries = useMemo(() => {
    if (snapshots.length === 0) return [] as number[];
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const days = range === '1W' ? 7 : range === '1M' ? 30 : range === '3M' ? 90 : 365;
    const cutoff = Date.now() - days * 86400000;
    const filtered = sorted.filter((s) => new Date(s.date).getTime() >= cutoff);
    const picked = filtered.length > 1 ? filtered : sorted.slice(-2);
    return picked.map((s) => s.totalValue / 100);
  }, [snapshots, range]);

  // ---- Weekly spend (real transactions, wallet loads excluded) ----
  const weekData = useMemo(() => {
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const excluded = new Set([
      'rent',
      'sip',
      'investments',
      'housing',
      'wallet loads',
      'wallet load',
      ...fixedExpenses.map((f: any) => String(f.name).toLowerCase()),
    ]);
    const buckets = new Array(7).fill(0);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
    for (const tx of transactions) {
      if (tx.type !== 'expense' && tx.type !== 'vehicle_service') continue;
      if (excluded.has((tx.category || '').toLowerCase())) continue;
      const t = new Date(tx.date).getTime();
      if (t < start) continue;
      const dayIdx = Math.floor((t - start) / 86400000);
      if (dayIdx < 0 || dayIdx > 6) continue;
      buckets[dayIdx] += tx.amount / 100;
    }
    return buckets.map((value, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i);
      return { label: labels[d.getDay()], value, isToday: i === 6 };
    });
  }, [transactions, now.getTime(), fixedExpenses]);
  const weekTotal = weekData.reduce((s, d) => s + d.value, 0);

  // ---- Dynamic category calculations for the expense distribution ----
  const EXCLUDED_CHART_CATEGORIES = [
    'Rent', 'SIP', 'Investments', 'Housing', 'Wallet Loads', 'Wallet Load',
    ...fixedExpenses.map((f: any) => f.name),
  ];
  const monthStart = new Date(chartMonth.getFullYear(), chartMonth.getMonth(), 1);
  const nextMonthStart = new Date(chartMonth.getFullYear(), chartMonth.getMonth() + 1, 1);
  const expenseTxs = transactions.filter(
    (tx: any) =>
      (tx.type === 'expense' || tx.type === 'vehicle_service') &&
      tx.type !== 'fixed_expense' &&
      !EXCLUDED_CHART_CATEGORIES.some(
        (cat) => cat.toLowerCase() === (tx.category || '').toLowerCase()
      ) &&
      new Date(tx.date) >= monthStart &&
      new Date(tx.date) < nextMonthStart
  );
  const fuelFillAmount = garageFills
    .filter((f) => new Date(f.date) >= monthStart && new Date(f.date) < nextMonthStart)
    .reduce((sum: number, f: any) => sum + f.amount, 0);
  const totalExpense =
    expenseTxs.reduce((sum: number, tx: any) => sum + tx.amount, 0) + fuelFillAmount;

  const categoryTotals: { [key: string]: number } = {};
  expenseTxs.forEach((tx: any) => {
    categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
  });
  if (fuelFillAmount > 0) {
    categoryTotals['Fuel'] = (categoryTotals['Fuel'] || 0) + fuelFillAmount;
  }

  const categoriesSorted = Object.keys(categoryTotals)
    .map((cat: string) => ({
      name: cat,
      amount: categoryTotals[cat],
      percentage: totalExpense > 0 ? (categoryTotals[cat] / totalExpense) * 100 : 0,
    }))
    .sort((a: any, b: any) => b.amount - a.amount);

  // ---- Credit cards ----
  const nextCard = cards
    .filter((c: any) => c.dueDate)
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  const totalLimit = cards.reduce((s: number, c: any) => s + (c.cardLimit ?? 0), 0);
  const cardUtilPct = totalLimit > 0 ? Math.min(1, cardOutstandingTotal / totalLimit) : 0;
  const cardDaysLeft = nextCard
    ? Math.max(
        0,
        Math.ceil((new Date(nextCard.dueDate).getTime() - Date.now()) / 86400000)
      )
    : 0;

  // ---- Budget ----
  const budgetPaise = (monthlyBudget ?? 0) * 100;
  const budgetPct = budgetPaise > 0 ? Math.min(1, monthlyExpenses / budgetPaise) : 0;

  const formatCurrency = (paise: number) => {
    const rupees = paise / 100;
    return `₹${rupees.toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  const formatCurrencyDetailed = (paise: number) => {
    const rupees = paise / 100;
    return `₹${rupees.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  };

  const formatCompact = (paise: number) => {
    const rupees = paise / 100;
    if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(1)}Cr`;
    if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
    if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`;
    return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
  };

  const donutSegments = categoriesSorted.slice(0, 6);

  return (
    <Screen
      bottomInset={120}
      floating={
        /* Add expense — floating action button, pinned above the tab bar */
        <PressScale
          onPress={() => navigation.navigate('AddExpense')}
          scale={0.95}
          wrapStyle={styles.fabWrap}
          style={styles.fab}
          accessibilityLabel="Add expense"
        >
          <Ionicons name="add" size={26} color={mc.white} />
        </PressScale>
      }
    >
      {/* Top bar */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <View style={styles.appBarSide}>
            <DrawerTrigger />
          </View>
          <Text style={styles.appBarTitle}>Finance</Text>
          <TouchableOpacity
            style={styles.appBarBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.8}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color={mc.text} />
            {unreadCount > 0 ? <View style={styles.notifDot} /> : null}
          </TouchableOpacity>
        </View>
      </Rise>

      {/* Total net worth */}
      <Rise index={1}>
        <PressScale onPress={() => navigation.navigate('BalanceSummary')} scale={0.99}>
          <Card>
            <Label>TOTAL NET WORTH</Label>
            <View style={styles.heroRow}>
              <CountUp
                value={totalNetWorth / 100}
                format={(n) => `₹${Math.round(n).toLocaleString('en-IN')}`}
                style={styles.heroValue}
              />
              <View style={styles.heroChip}>
                <Ionicons
                  name={todayPnL >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={11}
                  color={todayPnL >= 0 ? mc.mint : mc.redSoft}
                />
                <Text style={[styles.heroChipText, { color: todayPnL >= 0 ? mc.mint : mc.redSoft }]}>
                  {formatCompact(Math.abs(todayPnL))} today
                </Text>
              </View>
            </View>
            {trendSeries.length > 1 ? (
              <>
                <LineChart
                  data={trendSeries}
                  width={280}
                  height={80}
                  color={mc.red}
                  area
                  style={styles.heroChart}
                />
                <RangeChips
                  options={['1W', '1M', '3M', '1Y']}
                  value={range}
                  onChange={setRange}
                />
              </>
            ) : null}
          </Card>
        </PressScale>
      </Rise>

      {/* Money tiles */}
      <View style={styles.tileGrid}>
        <Rise index={2}>
          <StatTile
            icon="business-outline"
            color={mc.sky}
            value={formatCompact(accountsTotal)}
            label="BANK"
            onPress={() => navigation.navigate('BankAccounts')}
          />
        </Rise>
        <Rise index={3}>
          <StatTile
            icon="wallet-outline"
            color={mc.violet}
            value={formatCompact(payzappMonthlyLoad)}
            label="WALLET LOAD"
            onPress={() => navigation.navigate('PayzappWallet')}
          />
        </Rise>
        <Rise index={4}>
          <StatTile
            icon="people-outline"
            color={mc.amber}
            value={formatCompact(totalLent)}
            label="LENT"
            onPress={() => navigation.navigate('LentBorrowed')}
          />
        </Rise>
        <Rise index={5}>
          <StatTile
            icon="receipt-outline"
            color={mc.mint}
            value={formatCompact(unpaidFixedExpensesTotal)}
            label="FIXED"
            onPress={() => navigation.navigate('FixedExpenses')}
          />
        </Rise>
      </View>

      {/* Budget + credit card bills */}
      <View style={styles.twoUp}>
        <Rise index={6} style={styles.flexCell}>
          <PressScale onPress={() => navigation.navigate('MonthlySpend')} scale={0.98}>
            <Card style={styles.gaugeCard}>
              <Label>BUDGET</Label>
              <View style={styles.gaugeWrap}>
                <SemicircleGauge
                  progress={budgetPct}
                  width={132}
                  height={72}
                  stroke={11}
                  color={budgetPct >= 1 ? mc.red : mc.amber}
                  trackColor={mc.track}
                >
                  <Text style={styles.gaugeValue}>{formatCompact(monthlyExpenses)}</Text>
                </SemicircleGauge>
              </View>
              <Text style={styles.gaugeFoot}>
                {budgetPaise > 0
                  ? `of ${formatCompact(budgetPaise)} spent`
                  : 'No budget set'}
              </Text>
            </Card>
          </PressScale>
        </Rise>

        <Rise index={7} style={styles.flexCell}>
          <PressScale onPress={() => navigation.navigate('CreditCards')} scale={0.98}>
            <Card style={styles.gaugeCard}>
              <Label>CC BILLS</Label>
              <Text style={styles.billValue}>{formatCompact(cardOutstandingTotal)}</Text>
              <Text style={styles.billFoot}>
                {nextCard ? `Next due ${new Date(nextCard.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'No card due'}
              </Text>
              {totalLimit > 0 ? (
                <>
                  <ProgressBar
                    value={cardUtilPct}
                    color={cardUtilPct >= 0.9 ? mc.redSoft : cardUtilPct >= 0.7 ? mc.amber : mc.mint}
                    height={8}
                    style={styles.billBar}
                  />
                  <Text style={styles.billFootSmall}>
                    {`${Math.round(cardUtilPct * 100)}% of limit · ${cardDaysLeft > 0 ? `${cardDaysLeft} days left` : 'due now'}`}
                  </Text>
                </>
              ) : (
                <Text style={styles.billFootSmall}>
                  {cardDaysLeft > 0 ? `${cardDaysLeft} days left` : 'due now'}
                </Text>
              )}
            </Card>
          </PressScale>
        </Rise>
      </View>

      {/* This week */}
      <Rise index={8}>
        <Card>
          <View style={styles.rowBetween}>
            <Label>THIS WEEK</Label>
            <Text style={styles.rowValue}>{formatCurrency(Math.round(weekTotal * 100))}</Text>
          </View>
          <BarChart
            data={weekData.map((d) => ({
              label: d.label,
              value: d.value,
              color: d.isToday ? mc.red : mc.barDim,
            }))}
            width={300}
            height={96}
            style={styles.weekChart}
          />
          <View style={styles.weekLabels}>
            {weekData.map((d, i) => (
              <Text key={`${d.label}-${i}`} style={[styles.weekLabel, d.isToday && styles.weekLabelToday]}>
                {d.label}
              </Text>
            ))}
          </View>
        </Card>
      </Rise>

      {/* Top categories + the expense donut */}
      <Rise index={9}>
        <PressScale onPress={() => navigation.navigate('FinanceReports')} scale={0.99}>
          <Card>
            <Label>TOP CATEGORIES</Label>
            {categoriesSorted.length === 0 ? (
              <Text style={styles.emptyText}>No spending recorded this month yet.</Text>
            ) : (
              <>
                <View style={styles.donutRow}>
                  <View style={styles.donutWrap}>
                    <Animated.View style={{ opacity: donutOpacity, transform: [{ rotate: donutRotate }] }}>
                      <Svg width={116} height={116} viewBox="0 0 100 100">
                        <Defs>
                          {CATEGORY_COLORS.map((c, i) => (
                            <LinearGradient key={c} id={`finGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                              <Stop offset="0" stopColor={c} stopOpacity="0.95" />
                              <Stop offset="1" stopColor={c} stopOpacity="0.55" />
                            </LinearGradient>
                          ))}
                        </Defs>
                        <Circle cx="50" cy="50" r="40" fill="none" stroke={mc.track} strokeWidth="8" />
                        {(() => {
                          const circumference = 2 * Math.PI * 40;
                          let offset = 0;
                          return donutSegments.map((cat, i) => {
                            const pct = totalExpense > 0 ? cat.amount / totalExpense : 0;
                            const segLen = Math.max(circumference * pct - 2.5, 0.8);
                            const el = (
                              <Circle
                                key={cat.name + i}
                                cx="50"
                                cy="50"
                                r="40"
                                fill="none"
                                stroke={`url(#finGrad${i})`}
                                strokeWidth="8"
                                strokeDasharray={`${segLen} ${circumference}`}
                                strokeDashoffset={-offset}
                              />
                            );
                            offset += segLen + 2.5;
                            return el;
                          });
                        })()}
                      </Svg>
                    </Animated.View>
                    <View style={styles.donutCenter}>
                      <Text style={styles.donutTotal}>{formatCompact(totalExpense)}</Text>
                      <Text style={styles.donutCaption}>this month</Text>
                    </View>
                  </View>
                </View>
                {categoriesSorted.slice(0, 4).map((cat: any, i: number) => (
                  <View key={cat.name} style={styles.catRow}>
                    <Text style={styles.catName} numberOfLines={1}>
                      {cat.name}
                    </Text>
                    <View style={styles.catTrack}>
                      <View
                        style={[
                          styles.catFill,
                          {
                            width: `${Math.max(3, cat.percentage)}%`,
                            backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.catPct}>{Math.round(cat.percentage)}%</Text>
                  </View>
                ))}
              </>
            )}
          </Card>
        </PressScale>
      </Rise>

      {/* Recent transactions */}
      <Rise index={10}>
        <Card pad={false}>
          <View style={styles.listPanel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>RECENT TRANSACTIONS</Text>
              {transactions.length > 5 ? (
                <TouchableOpacity onPress={() => navigation.navigate('AllTransactions')} activeOpacity={0.7}>
                  <Text style={styles.viewAllBtn}>View all</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.cardRows}>
              {(() => {
                const filteredTxs = transactions.filter(
                  (tx: any) =>
                    tx.category !== 'Wallet Loads' &&
                    tx.category !== 'Wallet Load' &&
                    tx.type !== 'fuel_purchase' &&
                    tx.type !== 'credit_card_bill'
                );
                const fuelPseudoTxs: any[] = garageFills.map((f) => ({
                  id: `fill-${f.id}`,
                  type: 'expense',
                  amount: f.amount,
                  category: 'Fuel',
                  notes: `${Number(f.liters).toFixed(2)}L Fuel`,
                  date: f.date,
                  source: 'manual',
                }));
                const combined = [...filteredTxs, ...fuelPseudoTxs]
                  .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5);

                // Group by day — TODAY / YESTERDAY / "12 NOV" — each with its own total
                const dayStartOf = (d: Date) =>
                  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                const todayStart = dayStartOf(new Date());
                const yesterdayStart = todayStart - 86400000;
                const groups: { key: string; label: string; total: number; items: any[] }[] = [];
                for (const tx of combined) {
                  const txDay = new Date(tx.date);
                  const txStart = dayStartOf(txDay);
                  const key = String(txStart);
                  let group = groups.find((g) => g.key === key);
                  if (!group) {
                    const label =
                      txStart === todayStart
                        ? 'TODAY'
                        : txStart === yesterdayStart
                          ? 'YESTERDAY'
                          : txDay
                              .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                              .toUpperCase();
                    group = { key, label, total: 0, items: [] };
                    groups.push(group);
                  }
                  group.items.push(tx);
                  if (tx.type === 'expense' || tx.type === 'vehicle_service') {
                    group.total += tx.amount;
                  }
                }

                const renderTx = (tx: any) => (
                  <ExpandableTransactionCard
                    key={tx.id}
                    tx={tx}
                    formatAmount={formatCurrencyDetailed}
                    onPressEdit={() => {
                      if (tx.id?.startsWith('fill-')) {
                        navigation.navigate('GarageTab' as any, {
                          screen: 'EditFuelFill',
                          params: { fillId: tx.id.replace('fill-', '') },
                        });
                      } else {
                        navigation.navigate('EditTransaction', { transactionId: tx.id });
                      }
                    }}
                    onPressDelete={() => {
                      const isFill = tx.id?.startsWith('fill-');
                      const { useGarageStore: garageStore } = require('../../garage/store');
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
                                garageStore
                                  .getState()
                                  .deleteFuelFill(tx.id.replace('fill-', ''), user?.id);
                              } else {
                                deleteTransaction(tx.id, user?.id);
                              }
                            },
                          },
                        ]
                      );
                    }}
                  />
                );

                return groups.map((group) => (
                  <View key={group.key} style={styles.recentGroup}>
                    <View style={styles.recentGroupHead}>
                      <Text style={styles.recentGroupLabel}>{group.label}</Text>
                      <Text style={styles.recentGroupTotal}>
                        {`₹${Math.round(group.total / 100).toLocaleString('en-IN')}`}
                      </Text>
                    </View>
                    {group.items.map(renderTx)}
                  </View>
                ));
              })()}
            </View>
          </View>
        </Card>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 52,
  },
  appBarSide: {
    width: 38,
    height: 38,
  },
  fabWrap: {
    position: 'absolute',
    bottom: 92,
    right: 18,
    width: 56,
    height: 56,
  },
  fab: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#EB0028',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  appBarTitle: {
    fontSize: 26,
    fontWeight: '500',
    color: mc.text,
  },
  appBarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: mc.red,
  },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '500',
    color: mc.text,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: mc.mintDim,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroChart: {
    marginTop: 8,
    alignSelf: 'stretch',
  },

  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  twoUp: {
    flexDirection: 'row',
    gap: 10,
  },
  flexCell: {
    flex: 1,
  },

  gaugeCard: {
    minHeight: 148,
    justifyContent: 'flex-start',
  },
  gaugeWrap: {
    marginTop: 6,
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: 20,
    fontWeight: '500',
    color: mc.text,
  },
  gaugeFoot: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 8,
    textAlign: 'center',
  },

  billValue: {
    fontSize: 22,
    fontWeight: '500',
    color: mc.redSoft,
    marginVertical: 6,
  },
  billFoot: {
    fontSize: 12,
    color: mc.textDim,
  },
  billBar: {
    marginTop: 12,
  },
  billFootSmall: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 6,
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
  weekChart: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  weekLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  weekLabel: {
    fontSize: 11,
    color: mc.textDim,
  },
  weekLabelToday: {
    color: mc.redSoft,
    fontWeight: '600',
  },

  donutRow: {
    alignItems: 'center',
    marginTop: 8,
  },
  donutWrap: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutTotal: {
    fontSize: 16,
    fontWeight: '500',
    color: mc.text,
  },
  donutCaption: {
    fontSize: 11,
    color: mc.textDim,
  },

  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 11,
  },
  catName: {
    width: 68,
    fontSize: 13,
    color: mc.text,
  },
  catTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: mc.track,
    overflow: 'hidden',
  },
  catFill: {
    height: 8,
    borderRadius: 4,
  },
  catPct: {
    width: 34,
    textAlign: 'right',
    fontSize: 13,
    color: mc.textDim,
  },
  emptyText: {
    fontSize: 13,
    color: mc.textDim,
    marginTop: 10,
  },

  listPanel: {
    paddingTop: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  panelTitle: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '500',
    color: mc.textDim,
  },
  viewAllBtn: {
    fontSize: 12,
    color: mc.redSoft,
    fontWeight: '600',
  },
  cardRows: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  recentGroup: {
    marginTop: 10,
  },
  recentGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  recentGroupLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.2,
    color: mc.textDim,
  },
  recentGroupTotal: {
    fontSize: 12,
    fontWeight: '500',
    color: mc.textDim,
  },
});
