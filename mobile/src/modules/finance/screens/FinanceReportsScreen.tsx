/**
 * FinanceReportsScreen — monthly finance reports: category spend chart,
 * fixed expenses and garage fuel totals with a month picker.
 *
 * Restyled to the Meridian v2 reference (s24): a "TOTAL LOGGED" hero with a
 * month pill and a share-of-spend donut, then the tap-to-filter category
 * rows with thin bars and their transactions below.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { mc, mr, alpha } from '../../../shared/theme/meridian';
import { Card, EmptyState, Label, PressScale, Screen, TopBar } from '../../../shared/components/meridian';
import { useFinanceStore } from '../store';
import { getCategoryColor } from '../../../shared/categoryMap';

import { useGarageStore } from '../../garage/store';
import { useAuth } from '../../../services/AuthProvider';
import MonthPickerModal from '../components/MonthPickerModal';
import ExpandableTransactionCard from '../../../shared/components/ExpandableTransactionCard';

const DONUT_R = 44;
const DONUT_C = 2 * Math.PI * DONUT_R;

export default function FinanceReportsScreen() {
  const navigation = useNavigation<any>();
  const { transactions, fixedExpenses, deleteTransaction } = useFinanceStore();
  const garageFills = useGarageStore((s) => s.fills);
  const { user } = useAuth();
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

  // Donut segments — top 6, the rest fold into one "Others" wedge
  const donutSegments = (() => {
    const top = categories.slice(0, 6);
    const topTotal = top.reduce((s, c) => s + c.amount, 0);
    const rest = totalExpense - topTotal;
    const segs = top.map((c) => ({
      key: c.name,
      fraction: totalExpense > 0 ? c.amount / totalExpense : 0,
      color: getCategoryColor(c.name),
    }));
    if (rest > 0.5 && categories.length > 6) {
      segs.push({ key: 'Others', fraction: rest / totalExpense, color: mc.textGhost });
    }
    return segs;
  })();

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

  const topCategory = categories[0];
  let donutOffset = 0;

  return (
    <Screen bottomInset={36}>
      <TopBar
        title="Expense distribution"
        onBack={() => navigation.goBack()}
        variant="left"
      />

      {/* Total logged + month picker */}
      <Card>
        <View style={styles.summaryHeader}>
          <Label>TOTAL LOGGED</Label>
          <PressScale
            style={styles.monthPill}
            onPress={() => setChartMonthPickerVisible(true)}
            scale={0.96}
            accessibilityLabel="Choose month"
          >
            <Text style={styles.monthPillText}>
              {chartMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </Text>
            <Ionicons name="chevron-down" size={13} color={mc.textDim} />
          </PressScale>
        </View>

        <View style={styles.summaryRow}>
          <Svg width={118} height={118} viewBox="0 0 112 112">
            <Circle cx={56} cy={56} r={DONUT_R} fill="none" stroke={mc.track} strokeWidth={13} />
            {totalExpense > 0
              ? donutSegments.map((seg) => {
                  const len = Math.max(seg.fraction * DONUT_C - 2, 0.5);
                  const el = (
                    <Circle
                      key={seg.key}
                      cx={56}
                      cy={56}
                      r={DONUT_R}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={13}
                      strokeDasharray={`${len} ${DONUT_C}`}
                      strokeDashoffset={-donutOffset}
                      transform="rotate(-90 56 56)"
                    />
                  );
                  donutOffset += len + 2;
                  return el;
                })
              : null}
          </Svg>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryValue}>{formatCurrency(totalExpense)}</Text>
            <Text style={styles.summaryCaption}>
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </Text>
            {topCategory ? (
              <Text style={styles.summaryTop}>
                Top: {topCategory.name} {Math.round(topCategory.percentage)}%
              </Text>
            ) : null}
          </View>
        </View>
      </Card>

      {selectedCategory ? (
        <PressScale
          style={styles.clearFilter}
          onPress={() => setSelectedCategory(null)}
          scale={0.96}
          accessibilityLabel="Clear filter"
        >
          <Ionicons name="close-circle" size={15} color={mc.redSoft} />
          <Text style={styles.clearFilterText}>Clear “{selectedCategory}” filter</Text>
        </PressScale>
      ) : null}

      {/* Categories breakdown */}
      <Text style={styles.sectionTitle}>BY CATEGORY (TAP TO FILTER)</Text>
      <Card pad={false} style={styles.listCard}>
        {categories.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title="No expenses logged yet" />
        ) : (
          categories.map((cat, index) => {
            const color = getCategoryColor(cat.name);
            const isActive = selectedCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.name}
                style={[styles.categoryRow, index > 0 && styles.rowDivider, isActive && { backgroundColor: alpha(color, 0.09) }]}
                onPress={() => setSelectedCategory(isActive ? null : cat.name)}
                activeOpacity={0.75}
                accessibilityLabel={`Filter by ${cat.name}`}
              >
                <View style={styles.rowBetween}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    <Text style={[styles.catName, isActive && { color }]} numberOfLines={1}>
                      {cat.name}
                    </Text>
                    {isActive && <Ionicons name="funnel" size={12} color={color} style={{ marginLeft: 2 }} />}
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.catAmount, isActive && { color }]}>
                      {formatCurrency(cat.amount)}
                    </Text>
                    <Text style={styles.catPercent}>{Math.round(cat.percentage)}%</Text>
                  </View>
                </View>
                <View style={styles.barBg}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: color,
                        width: `${Math.max(cat.percentage, cat.amount > 0 ? 2.5 : 0)}%`,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </Card>

      {/* Filtered transactions sub-ledger */}
      {selectedCategory && (() => {
        const allFiltered = [...filteredTxs, ...filteredFuelPseudoTxs]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (allFiltered.length === 0) {
          return (
            <Text style={styles.sectionEmpty}>No transactions for {selectedCategory} in this month.</Text>
          );
        }
        return (
          <>
            <Text style={styles.sectionTitle}>
              {selectedCategory.toUpperCase()} TRANSACTIONS ({allFiltered.length})
            </Text>
            <Card pad={false} style={styles.listCard}>
              {allFiltered.map((tx: any) => (
                <ExpandableTransactionCard
                  key={tx.id}
                  tx={tx}
                  formatAmount={formatCurrencyDetailed}
                  onPressEdit={() => {
                    if (tx.id?.startsWith('fill-')) {
                      navigation.navigate('GarageTab' as any, { screen: 'EditFuelFill', params: { fillId: (tx.id as string).replace('fill-', '') } });
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
                              useGarageStore.getState().deleteFuelFill((tx.id as string).replace('fill-', ''), user?.id);
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
            </Card>
          </>
        );
      })()}

      <MonthPickerModal
        visible={chartMonthPickerVisible}
        selected={chartMonth}
        maxMonth={new Date(now.getFullYear(), now.getMonth(), 1)}
        onSelect={setChartMonth}
        onClose={() => setChartMonthPickerVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.raised,
    borderRadius: mr.chip,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  monthPillText: {
    fontSize: 13,
    color: mc.text,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summaryRight: {
    flex: 1,
    gap: 2,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: '500',
    color: mc.text,
  },
  summaryCaption: {
    fontSize: 12,
    color: mc.textDim,
  },
  summaryTop: {
    fontSize: 12,
    color: mc.amber,
    marginTop: 4,
  },
  clearFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: mc.redDim,
    borderRadius: mr.chip,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
  },
  clearFilterText: {
    fontSize: 13,
    color: mc.redSoft,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.2,
    color: mc.textDim,
    marginLeft: 4,
    marginTop: 4,
  },
  sectionEmpty: {
    fontSize: 13,
    color: mc.textDim,
    marginLeft: 4,
    marginTop: 8,
  },
  listCard: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  categoryRow: {
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderRadius: mr.tag,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  catName: {
    fontSize: 14,
    color: mc.text,
    flexShrink: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  catAmount: {
    fontSize: 14,
    color: mc.text,
    fontWeight: '500',
  },
  catPercent: {
    fontSize: 12,
    color: mc.textDim,
    minWidth: 32,
    textAlign: 'right',
  },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: mc.track,
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
});
