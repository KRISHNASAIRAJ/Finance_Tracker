import React from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore, getMinBalanceForAccount } from '../../finance/store';
import { useGarageStore } from '../../garage/store';
import { useInvestmentsStore } from '../../equity/store';

export default function CombinedReportScreen() {
  const navigation = useNavigation();

  const { transactions, cards, receivables, accounts, fixedExpenses, expectedIncomes } = useFinanceStore();
  const { fills } = useGarageStore();
  const portfolioValue = useInvestmentsStore.getState().getPortfolioValue?.() ?? 0;

  const formatCurrency = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // ---- Bank ----
  const totalBankBalance = accounts.reduce((sum, a) => sum + a.amount, 0);
  const totalMinBalance = accounts.reduce((sum, a) => sum + getMinBalanceForAccount(a.title), 0);
  const effectiveBalance = totalBankBalance - totalMinBalance;
  const totalLent = receivables.filter((r) => r.type === 'lent').reduce((sum, r) => sum + r.amount, 0);
  const totalBorrowed = receivables.filter((r) => r.type === 'borrowed').reduce((sum, r) => sum + r.amount, 0);

  // ---- Expected incomes ----
  const totalExpectedIncome = expectedIncomes.reduce((sum, ei) => sum + ei.amount, 0);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const unpaidFixed = fixedExpenses
    .filter((f) => f.lastPaidMonth !== currentMonthStr)
    .reduce((sum, f) => sum + f.amount, 0);
  const cardOutstanding = cards.reduce((sum, c) => sum + c.balance, 0);

  const netWorth =
    effectiveBalance + portfolioValue + totalLent + totalExpectedIncome - totalBorrowed - unpaidFixed - cardOutstanding;

  // ---- Monthly spend ----
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const WL_EXCLUDE = ['Wallet Loads', 'Wallet Load'];
  const monthlyExpenses = transactions
    .filter(
      (tx) =>
        new Date(tx.date) >= startOfMonth &&
        (tx.type === 'expense' || tx.type === 'vehicle_service') &&
        !WL_EXCLUDE.includes(tx.category)
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  const monthlyFuel = fills.reduce(
    (sum, f) => sum + (new Date(f.date) >= startOfMonth ? f.amount : 0),
    0
  );

  // ---- Category breakdown ----
  const catMap: Record<string, number> = {};
  transactions
    .filter(
      (tx) =>
        new Date(tx.date) >= startOfMonth &&
        (tx.type === 'expense' || tx.type === 'vehicle_service') &&
        !WL_EXCLUDE.includes(tx.category)
    )
    .forEach((tx) => {
      catMap[tx.category] = (catMap[tx.category] || 0) + tx.amount;
    });
  if (monthlyFuel > 0) {
    catMap['Fuel'] = (catMap['Fuel'] || 0) + monthlyFuel;
  }
  const topCategories = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // ---- Asset allocation ----
  const bankPct = totalBankBalance > 0 && netWorth > 0 ? (totalBankBalance / (totalBankBalance + portfolioValue)) * 100 : 0;
  const equityPct = portfolioValue > 0 && netWorth > 0 ? (portfolioValue / (totalBankBalance + portfolioValue)) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Combined Report</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Net Worth Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>NET WORTH</Text>
          <Text style={styles.heroValue}>{formatCurrency(netWorth)}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Portfolio</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(portfolioValue)}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Card Bills</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(cardOutstanding)}</Text>
            </View>
          </View>
        </View>

        {/* Monthly Spend */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>THIS MONTH</Text>
          <View style={styles.monthRow}>
            <View style={styles.monthStat}>
              <Ionicons name="wallet-outline" size={16} color={colors.error} />
              <Text style={styles.monthStatLabel}>Total Spend</Text>
              <Text style={styles.monthStatValue}>{formatCurrency(monthlyExpenses)}</Text>
            </View>
            <View style={styles.monthStat}>
              <Ionicons name="water-outline" size={16} color={colors.primary} />
              <Text style={styles.monthStatLabel}>Fuel</Text>
              <Text style={styles.monthStatValue}>{formatCurrency(monthlyFuel)}</Text>
            </View>
          </View>

          {/* Top categories */}
          {topCategories.length > 0 && (
            <View style={styles.catSection}>
              <Text style={styles.subLabel}>TOP CATEGORIES</Text>
              {topCategories.map(([cat, amt]) => (
                <View key={cat} style={styles.catRow}>
                  <Text style={styles.catName}>{cat}</Text>
                  <View style={styles.catBarTrack}>
                    <View
                      style={[
                        styles.catBarFill,
                        {
                          width: `${Math.min(100, (amt / (monthlyExpenses + monthlyFuel)) * 100)}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.catAmt}>{formatCurrency(amt)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Financial Position */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>POSITION</Text>
          <View style={styles.posRow}>
            <Text style={styles.posLabel}>Lent</Text>
            <Text style={[styles.posValue, { color: '#3b82f6' }]}>{formatCurrency(totalLent)}</Text>
          </View>
          <View style={styles.posRow}>
            <Text style={styles.posLabel}>Expected Income</Text>
            <Text style={[styles.posValue, { color: '#84CC16' }]}>{formatCurrency(totalExpectedIncome)}</Text>
          </View>
          <View style={styles.posRow}>
            <Text style={styles.posLabel}>Borrowed</Text>
            <Text style={[styles.posValue, { color: '#f59e0b' }]}>{formatCurrency(totalBorrowed)}</Text>
          </View>
          <View style={styles.posRow}>
            <Text style={styles.posLabel}>Credit Card Outstanding</Text>
            <Text style={[styles.posValue, { color: '#ef4444' }]}>{formatCurrency(cardOutstanding)}</Text>
          </View>
          <View style={styles.posRow}>
            <Text style={styles.posLabel}>Unpaid Fixed Expenses</Text>
            <Text style={[styles.posValue, { color: '#6366f1' }]}>{formatCurrency(unpaidFixed)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.posRow}>
            <Text style={[styles.posLabel, { fontWeight: '700', color: colors.onSurface }]}>
              Net Worth
            </Text>
            <Text style={[styles.posValue, { fontWeight: '800', fontSize: 18, color: netWorth >= 0 ? '#10b981' : '#ef4444' }]}>
              {formatCurrency(netWorth)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: { padding: 8, borderRadius: rounded.full },
  appBarTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  scroll: { padding: spacing.containerPadding, gap: 16, paddingBottom: 40 },
  heroCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  heroLabel: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 1 },
  heroValue: { fontSize: 32, fontWeight: '800', color: colors.onSurface },
  heroRow: { flexDirection: 'row', gap: 16 },
  heroStat: { flex: 1, gap: 2 },
  heroStatLabel: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '500' },
  heroStatValue: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  sectionCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.8 },
  allocationRow: { gap: 8 },
  allocBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
  allocFill: { height: '100%' },
  allocLegends: { flexDirection: 'row', gap: 16 },
  allocLegend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  allocDot: { width: 8, height: 8, borderRadius: 4 },
  allocText: { fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant },
  monthRow: { flexDirection: 'row', gap: 16 },
  monthStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: rounded.DEFAULT, padding: 12, gap: 4 },
  monthStatLabel: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '500' },
  monthStatValue: { fontSize: 18, fontWeight: '700', color: colors.onSurface, marginTop: 2 },
  subLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginTop: 4 },
  catSection: { gap: 8 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catName: { fontSize: 12, fontWeight: '500', color: colors.onSurfaceVariant, width: 100 },
  catBarTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  catAmt: { fontSize: 12, fontWeight: '600', color: colors.onSurface, width: 80, textAlign: 'right' },
  posRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  posLabel: { fontSize: 13, fontWeight: '500', color: colors.onSurfaceVariant },
  posValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
});
