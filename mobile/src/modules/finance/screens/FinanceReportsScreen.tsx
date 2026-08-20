import React, { useState } from 'react';
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
import { useFinanceStore } from '../store';
import { getCategoryIcon, getCategoryColor } from '../../../shared/categoryMap';
import { useGarageStore } from '../../garage/store';
import MonthPickerModal from '../components/MonthPickerModal';

export default function FinanceReportsScreen() {
  const navigation = useNavigation();
  const { transactions, fixedExpenses } = useFinanceStore();
  const garageFills = useGarageStore((s) => s.fills);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [chartMonth, setChartMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [chartMonthPickerVisible, setChartMonthPickerVisible] = useState(false);

  const EXCLUDED_CATEGORIES = [
    'Rent', 'SIP', 'Investments', 'Housing', 'Wallet Loads', 'Wallet Load',
    ...fixedExpenses.map((f: any) => f.name),
  ];

  const now = new Date();
  const monthStart = new Date(chartMonth.getFullYear(), chartMonth.getMonth(), 1);
  const nextMonthStart = new Date(chartMonth.getFullYear(), chartMonth.getMonth() + 1, 1);

  const expenseTxs = transactions.filter(
    (tx: any) =>
      (tx.type === 'expense' || tx.type === 'vehicle_service') &&
      new Date(tx.date) >= monthStart &&
      new Date(tx.date) < nextMonthStart &&
      !EXCLUDED_CATEGORIES.some(cat =>
        cat.toLowerCase() === (tx.category || '').toLowerCase()
      )
  );

  const fuelFillAmount = garageFills
    .filter((f: any) => new Date(f.date) >= monthStart && new Date(f.date) < nextMonthStart)
    .reduce((sum: number, f: any) => sum + f.amount, 0);
  const totalExpense = expenseTxs.reduce((sum, tx) => sum + tx.amount, 0) + fuelFillAmount;

  // Group by category
  const categoryTotals: { [key: string]: number } = {};
  expenseTxs.forEach((tx) => {
    categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
  });

  if (fuelFillAmount > 0) {
    categoryTotals['Fuel'] = (categoryTotals['Fuel'] || 0) + fuelFillAmount;
  }

  const categories = Object.keys(categoryTotals).map((cat) => ({
    name: cat,
    amount: categoryTotals[cat],
    percentage: totalExpense > 0 ? (categoryTotals[cat] / totalExpense) * 100 : 0,
  })).sort((a, b) => b.amount - a.amount);

  // Filtered transactions for selected category
  const filteredTxs = selectedCategory
    ? transactions
        .filter((tx) => tx.category === selectedCategory && tx.type !== 'fuel_purchase' && new Date(tx.date) >= monthStart)
    : [];

  const filteredFuelPseudoTxs = selectedCategory === 'Fuel'
    ? garageFills
        .filter((f) => new Date(f.date) >= monthStart)
        .map((f) => ({
        id: `fill-${f.id}`,
        type: 'expense',
        amount: f.amount,
        currency: 'INR',
        category: 'Fuel',
        notes: `${Number(f.liters).toFixed(2)}L Fuel`,
        date: f.date,
        source: 'manual',
      }))
    : [];

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

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Expense Distribution</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Spend */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>TOTAL EXPENSES LOGGED</Text>
            <TouchableOpacity
              style={styles.monthDropdown}
              onPress={() => setChartMonthPickerVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.monthDropdownText}>
                {chartMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.summaryValue}>{formatCurrency(totalExpense)}</Text>
          {selectedCategory && (
            <TouchableOpacity
              style={styles.clearFilter}
              onPress={() => setSelectedCategory(null)}
            >
              <Ionicons name="close-circle" size={16} color={colors.primary} />
              <Text style={styles.clearFilterText}>Clear filter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Categories breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SPENDING BY CATEGORY (TAP TO FILTER)</Text>
          <View style={styles.listContainer}>
            {categories.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No expenses logged yet</Text>
              </View>
            ) : (
              categories.map((cat) => {
                const color = getCategoryColor(cat.name);
                const isActive = selectedCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[styles.categoryRow, isActive && { backgroundColor: `${color}10` }]}
                    onPress={() =>
                      setSelectedCategory(isActive ? null : cat.name)
                    }
                    activeOpacity={0.75}
                  >
                    <View style={styles.rowBetween}>
                      <View style={styles.row}>
                        <View style={[styles.dot, { backgroundColor: color }]} />
                        <Text style={[styles.catName, isActive && { color: color, fontWeight: '700' }]}>
                          {cat.name}
                        </Text>
                        {isActive && (
                          <Ionicons name="funnel" size={12} color={color} style={{ marginLeft: 4 }} />
                        )}
                      </View>
                      <View style={styles.rowRight}>
                        <Text style={[styles.catAmount, isActive && { color: color }]}>
                          {formatCurrency(cat.amount)}
                        </Text>
                        <Text style={styles.catPercent}>{cat.percentage.toFixed(0)}%</Text>
                      </View>
                    </View>
                    <View style={styles.barBg}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            backgroundColor: color,
                            width: `${cat.percentage}%`,
                            opacity: isActive ? 1 : 0.6,
                          },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        {/* Filtered transactions sub-ledger */}
        {selectedCategory && (() => {
          const allFiltered = [...filteredTxs, ...filteredFuelPseudoTxs]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          if (allFiltered.length === 0) return null;
          return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {selectedCategory.toUpperCase()} TRANSACTIONS ({allFiltered.length})
            </Text>
            <View style={styles.listContainer}>
              {allFiltered.map((tx: any) => {
                const isIncome = tx.type === 'income';
                const catColor = getCategoryColor(tx.category);
                return (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={styles.txLeft}>
                      <View style={[styles.txIcon, { backgroundColor: `${catColor}15` }]}>
                        <Ionicons
                          name={getCategoryIcon(tx.category)}
                          size={16}
                          color={catColor}
                        />
                      </View>
                      <View>
                        <Text style={styles.txTitle}>{tx.notes || tx.category}</Text>
                        <Text style={styles.txDate}>
                          {new Date(tx.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.txAmount, { color: catColor }]}>
                      {isIncome ? '+' : '-'}{formatCurrencyDetailed(tx.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
          );
        })()}
      </ScrollView>

      <MonthPickerModal
        visible={chartMonthPickerVisible}
        selected={chartMonth}
        maxMonth={new Date(now.getFullYear(), now.getMonth(), 1)}
        onSelect={setChartMonth}
        onClose={() => setChartMonthPickerVisible(false)}
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
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    alignItems: 'center',
    gap: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  monthDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: rounded.full,
    backgroundColor: `${colors.primary}15`,
  },
  monthDropdownText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.onSurface,
  },
  clearFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: rounded.full,
    backgroundColor: `${colors.primary}15`,
  },
  clearFilterText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  listContainer: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    overflow: 'hidden',
  },
  categoryRow: {
    padding: spacing.cardPadding,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  catPercent: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    minWidth: 32,
    textAlign: 'right',
  },
  barBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  // Filtered tx styles
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  txIcon: {
    width: 32,
    height: 32,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  txDate: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
});
