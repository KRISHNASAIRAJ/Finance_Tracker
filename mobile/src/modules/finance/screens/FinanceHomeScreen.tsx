/**
 * FinanceHomeScreen — finance home tab: net-worth hero, spend/card stats,
 * expense-distribution donut and recent transactions.
 */
import React, { useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G as SvgG, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors } from '../../../shared/theme/colors';
import { useFinanceStore, getMinBalanceForAccount } from '../store';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import { getCategoryColor } from '../../../shared/categoryMap';
import CategoryIcon from '../../../shared/CategoryIcon';
import { scheduleAllReminders } from '../../../services/notificationService';
import { useGarageStore } from '../../garage/store';
import { processSyncQueue } from '../../../services/syncQueue';
import { useFinanceSync } from '../hooks/useFinanceSync';
import DraggableFab from '../../../shared/components/DraggableFab';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'FinanceHome'>;

export default function FinanceHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const garageFills = useGarageStore((s) => s.fills);
  // Mounts the finance sync hook — pulls cloud data into the store on mount
  // (critical on fresh installs, where the local store is empty)
  useFinanceSync();
  const {
    transactions,
    cards,
    receivables,
    accounts,
    fixedExpenses,
    notifications,
    getTotalBalance,
    getMonthlyExpenses,
  } = useFinanceStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  useFocusEffect(
    useCallback(() => {
      processSyncQueue().catch((e: Error) => console.warn('[FinanceHome] syncQueue flush failed:', e));
    }, [])
  );

  useEffect(() => {
    scheduleAllReminders();
  }, []);

  const totalBalance = getTotalBalance();
  const totalMinBalance = accounts.reduce((sum: number, acc: any) => sum + getMinBalanceForAccount(acc.title), 0);
  const effectiveBalance = totalBalance - totalMinBalance;
  const monthlyExpenses = getMonthlyExpenses();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const chartMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Dynamic calculations from user backup lists
  const totalLent = receivables.filter((r: any) => r.type === 'lent').reduce((acc: number, r: any) => acc + (r.amount - (r.paidAmount || 0)), 0);
  const totalBorrowed = receivables.filter((r: any) => r.type === 'borrowed').reduce((acc: number, r: any) => acc + (r.amount - (r.paidAmount || 0)), 0);
  const cardOutstandingTotal = cards.reduce((acc: number, c: any) => acc + c.balance, 0);
  const unpaidFixedExpensesTotal = fixedExpenses
    .filter((f: any) => f.lastPaidMonth !== currentMonthStr)
    .reduce((sum: number, f: any) => sum + f.amount, 0);

  const payzappMonthlyLoad = transactions
    .filter((tx: any) =>
      tx.type === 'expense' &&
      (tx.category?.toLowerCase() === 'wallet loads' || tx.category?.toLowerCase() === 'wallet load' ||
       tx.notes?.toLowerCase().includes('payzapp wallet'))
    )
    .filter((tx: any) => new Date(tx.date) >= new Date(now.getFullYear(), now.getMonth(), 1))
    .reduce((sum: number, tx: any) => sum + tx.amount, 0);
  const PAYZAPP_MONTHLY_CAP = 40_000 * 100;

  // User Formula: bank balance - min. balances + lent - borrow - fixed expenses - credit card bills
  const totalNetWorth = effectiveBalance + totalLent - totalBorrowed - unpaidFixedExpensesTotal - cardOutstandingTotal;

  // Dynamic category calculations for Expense Distribution
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
      !EXCLUDED_CHART_CATEGORIES.some(cat =>
        cat.toLowerCase() === (tx.category || '').toLowerCase()
      ) &&
      new Date(tx.date) >= monthStart &&
      new Date(tx.date) < nextMonthStart
  );
  const fuelFillAmount = garageFills
    .filter((f: any) => new Date(f.date) >= monthStart && new Date(f.date) < nextMonthStart)
    .reduce((sum: number, f: any) => sum + f.amount, 0);
  const totalExpense = expenseTxs.reduce((sum: number, tx: any) => sum + tx.amount, 0) + fuelFillAmount;

  const categoryTotals: { [key: string]: number } = {};
  expenseTxs.forEach((tx: any) => {
    categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
  });

  if (fuelFillAmount > 0) {
    categoryTotals['Fuel'] = (categoryTotals['Fuel'] || 0) + fuelFillAmount;
  }

  const categoriesSorted = Object.keys(categoryTotals).map((cat: string) => ({
    name: cat,
    amount: categoryTotals[cat],
    percentage: totalExpense > 0 ? (categoryTotals[cat] / totalExpense) * 100 : 0,
  })).sort((a: any, b: any) => b.amount - a.amount); 

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



  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top App Bar */}
        <View style={styles.appBar}>
          <View style={styles.appBarSide} />
          <Text style={styles.appBarTitle}>MERIDIAN</Text>
          <TouchableOpacity
            style={styles.appBarBtn}
            onPress={() => (navigation as any).navigate('Notifications')}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.onSurface} />
            {unreadCount > 0 && <View style={styles.notifDot} />}
          </TouchableOpacity>
        </View>

        {/* Hero Section: Total Net Worth */}
        <TouchableOpacity
          style={styles.heroPanel}
          onPress={() => navigation.navigate('BalanceSummary')}
          activeOpacity={0.9}
        >
          <Text style={styles.heroLabel}>TOTAL NET WORTH</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroValue}>{formatCurrency(totalNetWorth)}</Text>
          </View>
        </TouchableOpacity>

        {/* Primary Cards Grid */}
        <View style={styles.grid2}>
          <TouchableOpacity
            style={[styles.glassPanel, styles.statCard]}
            onPress={() => navigation.navigate('MonthlySpend')}
            activeOpacity={0.85}
          >
            <Ionicons name="pricetags-outline" size={26} color="#ffb2b9" />
            <Text style={styles.statValue}>{formatCompact(monthlyExpenses)}</Text>
            <Text style={styles.statLabel}>Monthly Spends</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.glassPanel, styles.statCard]}
            onPress={() => navigation.navigate('CreditCards')}
            activeOpacity={0.85}
          >
            <Ionicons name="receipt-outline" size={26} color="#5ee6ff" />
            <Text style={styles.statValue}>{formatCompact(cardOutstandingTotal)}</Text>
            <Text style={styles.statLabel}>CC Bills</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.glassPanel, styles.statCard]}
            onPress={() => navigation.navigate('BankAccounts')}
            activeOpacity={0.85}
          >
            <Ionicons name="business-outline" size={26} color="#ea6479" />
            <Text style={styles.statValue}>{formatCompact(totalBalance)}</Text>
            <Text style={styles.statLabel}>Bank Acc</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.glassPanel, styles.statCard]}
            onPress={() => navigation.navigate('LentBorrowed')}
            activeOpacity={0.85}
          >
            <Ionicons name="people-outline" size={26} color="#d0bcff" />
            <Text style={styles.statValue}>{formatCompact(totalLent)}</Text>
            <Text style={styles.statLabel}>Net Lent/Debit</Text>
          </TouchableOpacity>
        </View>

        {/* Fixed Exp + Wallets */}
        <View style={styles.grid2}>
          <TouchableOpacity
            style={[styles.glassPanel, styles.statCard]}
            onPress={() => navigation.navigate('FixedExpenses')}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-closed-outline" size={26} color="#ffdadc" />
            <Text style={styles.statValue}>{formatCompact(unpaidFixedExpensesTotal)}</Text>
            <Text style={styles.statLabel}>Fixed Exp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.glassPanel, styles.statCard]}
            onPress={() => navigation.navigate('PayzappWallet')}
            activeOpacity={0.85}
          >
            <Ionicons name="wallet" size={26} color="#00cbe6" />
            <Text style={styles.statValue}>{formatCompact(payzappMonthlyLoad)}</Text>
            <Text style={styles.statLabel}>Wallets</Text>
          </TouchableOpacity>
        </View>

        {/* Expense Distribution */}
        <TouchableOpacity
          style={[styles.glassPanel, styles.distributionPanel]}
          onPress={() => navigation.navigate('FinanceReports')}
          activeOpacity={0.95}
        >
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Expense Distribution</Text>
          </View>

          <View style={styles.distributionContent}>
            <View style={styles.donutSvgWrap}>
              <Svg width={140} height={140} viewBox="0 0 100 100">
                <Defs>
                  <LinearGradient id="gradPink" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#ffb2b9" />
                    <Stop offset="100%" stopColor="#d0bcff" />
                  </LinearGradient>
                  <LinearGradient id="gradTeal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#5ee6ff" />
                    <Stop offset="100%" stopColor="#00cbe6" />
                  </LinearGradient>
                  <LinearGradient id="gradOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#ea6479" />
                    <Stop offset="100%" stopColor="#ffdadc" />
                  </LinearGradient>
                </Defs>

                {/* Background track */}
                <Circle
                  cx={50}
                  cy={50}
                  r={40}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={8}
                  fill="none"
                />

                {categoriesSorted.length > 0 && (() => {
                  const R = 40;
                  const strokeW = 8;
                  const cx = 50;
                  const cy = 50;
                  const circumference = 2 * Math.PI * R;
                  const gap = 2.5;
                  const gradients = ['url(#gradPink)', 'url(#gradTeal)', 'url(#gradOrange)'];
                  let cumulativeDeg = 0;
                  return categoriesSorted.map((cat, i) => {
                    const pct = cat.percentage / 100;
                    const segLen = Math.max(pct * circumference - gap, 0.8);
                    const deg = cumulativeDeg;
                    cumulativeDeg += pct * 360;
                    return (
                      <SvgG key={cat.name} rotation={deg} origin={`${cx}, ${cy}`}>
                        <Circle
                          cx={cx}
                          cy={cy}
                          r={R}
                          stroke={gradients[i % gradients.length]}
                          strokeWidth={strokeW}
                          strokeDasharray={`${segLen} ${circumference - segLen}`}
                          strokeDashoffset={circumference * 0.25}
                          fill="none"
                          strokeLinecap="round"
                        />
                      </SvgG>
                    );
                  });
                })()}
              </Svg>
              {categoriesSorted.length > 0 ? (
                <View style={styles.donutCenter}>
                  <Text
                    style={styles.donutVal}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {formatCurrency(totalExpense)}
                  </Text>
                  <Text style={styles.donutSub}>TOTAL</Text>
                </View>
              ) : (
                <View style={styles.donutCenter}>
                  <Text style={styles.donutSub}>NO DATA</Text>
                </View>
              )}
            </View>

            {categoriesSorted.length > 0 && (
              <View style={styles.legendContainer}>
                {categoriesSorted.slice(0, 3).map((cat, i) => {
                  const gradientColors = ['#ffb2b9', '#5ee6ff', '#ea6479'];
                  return (
                    <View key={cat.name} style={styles.legendItem}>
                      <View style={styles.legendLeft}>
                        <View style={[styles.legendDot, { backgroundColor: gradientColors[i % gradientColors.length] }]} />
                        <Text style={styles.legendName} numberOfLines={1}>{cat.name}</Text>
                      </View>
                      <Text style={styles.legendPct}>{cat.percentage.toFixed(0)}%</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Recent Transactions */}
        <View style={[styles.glassPanel, styles.listPanel]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Recent Transactions</Text>
            {transactions.length > 5 && (
              <TouchableOpacity onPress={() => navigation.navigate('AllTransactions')} activeOpacity={0.7}>
                <Text style={styles.viewAllBtn}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.cardRows}>
            {(() => {
              const filteredTxs = transactions.filter(
                (tx: any) => tx.category !== 'Wallet Loads' && tx.category !== 'Wallet Load' && tx.type !== 'fuel_purchase'
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
                .slice(0, 4);

              return combined.map((tx: any) => {
                const isIncome = tx.type === 'income';
                const catColor = getCategoryColor(tx.category, isIncome);
                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={styles.cardRow}
                    onPress={() => {
                      if (tx.id?.startsWith('fill-')) {
                        navigation.navigate('GarageTab' as any, { screen: 'EditFuelFill', params: { fillId: tx.id.replace('fill-', '') } });
                      } else {
                        navigation.navigate('EditTransaction', { transactionId: tx.id });
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.cardRowIcon, styles.txIcon, { backgroundColor: `${catColor}15` }]}>
                      <CategoryIcon category={tx.category} size={16} color={catColor} />
                    </View>
                    <View style={styles.cardRowDetails}>
                      <Text style={styles.cardRowName}>{tx.notes || tx.category}</Text>
                      <Text style={styles.cardRowDue}>
                        {tx.category} • {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <Text style={styles.cardRowAmount}>
                      {isIncome ? '+' : '-'}{formatCurrencyDetailed(tx.amount)}
                    </Text>
                  </TouchableOpacity>
                );
              });
            })()}
          </View>
        </View>
      </ScrollView>

      {/* Floating AI Button — draggable */}
      <DraggableFab
        icon="sparkles"
        color={colors.textPrimary}
        storageKey="meridian-fab-home"
        onPress={() => navigation.navigate('CardChat')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
    gap: 16,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  appBarSide: {
    width: 40,
    height: 40,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  appBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  heroPanel: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 32,
    padding: 24,
    overflow: 'hidden',
  },
heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  heroValue: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    flexShrink: 1,
    textAlign: 'center',
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  glassPanel: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 32,
    overflow: 'hidden',
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 8,
    aspectRatio: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  statSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -4,
  },
  listPanel: {
    padding: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  viewAllBtn: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  cardRows: {
    gap: 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  cardRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txIcon: {
    borderRadius: 20,
  },
  cardRowDetails: {
    flex: 1,
    gap: 2,
  },
  cardRowName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  cardRowNumber: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '400',
  },
  cardRowDue: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  cardRowAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
},
  distributionPanel: {
    padding: 16,
    marginTop: 8,
  },
  distributionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  donutSvgWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 96,
    paddingHorizontal: 4,
  },
  donutSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
    marginTop: 2,
  },
  donutVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    textAlign: 'center',
  },
  legendContainer: {
    flex: 1,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
  },
  legendPct: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
});
