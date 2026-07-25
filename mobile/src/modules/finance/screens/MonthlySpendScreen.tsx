import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore, Transaction } from '../store';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import { getCategoryIcon, getCategoryColor } from '../../../shared/categoryMap';
import { useAuth } from '../../../services/AuthProvider';
import { useGarageStore } from '../../garage/store';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'MonthlySpend'>;

export default function MonthlySpendScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { transactions, monthlyBudget, setMonthlyBudget, fixedExpenses } = useFinanceStore();
  const { fills: garageFills } = useGarageStore();

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
    .filter((tx) => !EXCLUDED_CATEGORIES.some(cat =>
      cat.toLowerCase() === (tx.category || '').toLowerCase()
    ))
    .filter((tx) => tx.type === 'expense' || tx.type === 'vehicle_service');

  const monthGarageFills = garageFills.filter((f) => new Date(f.date) >= startOfMonth);
  const fuelFillAmount = monthGarageFills.reduce((sum, f) => sum + f.amount, 0);
  const totalSpend = expenseTxs.reduce((sum, tx) => sum + tx.amount, 0) + fuelFillAmount;

  const budgetPaise = (monthlyBudget || 0) * 100;
  const budgetExceeded = budgetPaise > 0 && totalSpend > budgetPaise;
  const remaining = budgetPaise > 0 ? Math.max(0, budgetPaise - totalSpend) : 0;
  const daysLeft = lastDay - now.getDate() + 1;
  const safePerDay = daysLeft > 0 && budgetPaise > 0 ? Math.round(remaining / daysLeft) : 0;

  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointPress = (idx: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setSelectedDay(idx);
    hideTimer.current = setTimeout(() => setSelectedDay(null), 10000);
  };

  useEffect(() => {
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const monthlyTxs = transactions
    .filter((tx) => new Date(tx.date) >= startOfMonth)
    .filter((tx) => tx.type !== 'fixed_expense')
    .filter((tx) => tx.type !== 'fuel_purchase')
    .filter((tx) => !EXCLUDED_CATEGORIES.some(cat =>
      cat.toLowerCase() === (tx.category || '').toLowerCase()
    ));

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

  const allMonthTxs = [...monthlyTxs, ...monthFuelPseudoTxs]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
  };

  const formatCurrencyDetailed = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  };

  // Daily cumulative spend chart
  const CHART_W = Dimensions.get('window').width - 64;
  const CHART_H = 130;
  const padX = 10;
  const padY = 35;

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

  const chartMax = dailySums.length > 0 ? Math.max(...dailySums, 1) : 1;

  const points = dailySums.map((val, i) => {
    const x = padX + (i / Math.max(dailySums.length - 1, 1)) * (CHART_W - 2 * padX);
    const y = CHART_H - padY - (val / chartMax) * (CHART_H - 2 * padY - 5);
    return { x, y, val };
  });

  let pathD = '';
  let fillD = '';
  if (points.length > 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cpX1 = curr.x + (next.x - curr.x) / 2;
      const cpY1 = curr.y;
      const cpX2 = curr.x + (next.x - curr.x) / 2;
      const cpY2 = next.y;
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
    }
    fillD = `${pathD} L ${points[points.length - 1].x} ${CHART_H - padY} L ${points[0].x} ${CHART_H - padY} Z`;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Monthly Spend</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Spend + Budget */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL MONTH SPEND</Text>
          <Text style={[styles.summaryValue, { color: budgetExceeded ? colors.attention : colors.error }]}>
            {formatCurrency(totalSpend)}
          </Text>

          {budgetPaise > 0 ? (
            <View style={styles.budgetInfo}>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>Budget</Text>
                <Text style={styles.budgetVal}>{formatCurrency(budgetPaise)}</Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${Math.min(100, (totalSpend / budgetPaise) * 100)}%`, backgroundColor: budgetExceeded ? colors.attention : colors.chartreuse }]} />
              </View>
              {budgetExceeded ? (
                <View style={styles.budgetWarning}>
                  <Ionicons name="warning" size={14} color={colors.attention} />
                  <Text style={styles.budgetWarningText}>Budget crossed by {formatCurrency(totalSpend - budgetPaise)}</Text>
                
                </View>
              ) : (
                <View style={styles.safeInfo}>
                  <Text style={styles.safeLabel}>Safe to spend</Text>
                  <Text style={styles.safeVal}>{formatCurrency(safePerDay)}/day</Text>
                  <Text style={styles.safeLabel}>({daysLeft} days left)</Text>
                </View>
              )}
              <TouchableOpacity style={styles.editBudgetBtn} onPress={() => { setBudgetInput((monthlyBudget || '').toString()); setBudgetModalVisible(true); }}>
                <Text style={styles.editBudgetText}>{budgetPaise > 0 ? 'Edit Budget' : 'Set Budget'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.setBudgetBtn} onPress={() => { setBudgetInput(''); setBudgetModalVisible(true); }}>
              <Ionicons name="wallet-outline" size={16} color={colors.primary} />
              <Text style={styles.setBudgetText}>Set Monthly Budget</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Area Graph */}
        {dailySums.some((v) => v > 0) && (
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>DAILY SPEND</Text>
            <View style={{ position: 'relative' }}>
              <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} pointerEvents="none">
                <Defs>
                  <LinearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colors.attention} stopOpacity="0.3" />
                    <Stop offset="1" stopColor={colors.attention} stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                {fillD ? <Path d={fillD} fill="url(#spendGrad)" /> : null}
                {pathD ? <Path d={pathD} stroke={colors.attention} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {selectedDay !== null && selectedDay < points.length && (
                  <>
                    <Line
                      x1={points[selectedDay].x} y1={points[selectedDay].y}
                      x2={points[selectedDay].x} y2={CHART_H - padY}
                      stroke={colors.attention} strokeWidth={1} strokeDasharray="3,3"
                    />
                    <Circle cx={points[selectedDay].x} cy={points[selectedDay].y} r={4} fill={colors.attention} />
                  </>
                )}
              </Svg>

              {selectedDay !== null && selectedDay < points.length && (
                <View style={[styles.tooltip, {
                  left: Math.max(0, Math.min(points[selectedDay].x - 35, CHART_W - 85)),
                  top: Math.max(0, points[selectedDay].y - 28),
                }]}>
                  <Text style={styles.tooltipText}>
                      {currentMonthName} {selectedDay + 1}: {formatCurrency(dailySums[selectedDay])}
                  </Text>
                </View>
              )}

              <View style={styles.touchOverlay}>
                {points.map((_, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.touchSlice}
                    onPress={() => handlePointPress(idx)}
                    activeOpacity={1}
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Budget Modal */}
        <Modal visible={budgetModalVisible} transparent animationType="fade" onRequestClose={() => setBudgetModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Monthly Budget</Text>
              <View style={styles.inpGrp}>
                <Text style={styles.inpLabel}>BUDGET (₹)</Text>
                <TextInput style={styles.inp} value={budgetInput} onChangeText={setBudgetInput} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.outline} autoFocus />
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setBudgetModalVisible(false)}><Text style={styles.modalCancelTxt}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={() => { const v = parseFloat(budgetInput); setMonthlyBudget(isNaN(v) ? 0 : Math.max(0, Math.round(v)), user?.id); setBudgetModalVisible(false); }}><Text style={styles.modalSaveTxt}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Transactions List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TRANSACTIONS THIS MONTH</Text>
          <View style={styles.listContainer}>
            {monthlyTxs.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={32} color={colors.outline} />
                <Text style={styles.emptyText}>No transactions logged this month</Text>
              </View>
            ) : (
              allMonthTxs.slice(0, 5).map((tx: any) => {
                const isIncome = tx.type === 'income';
                const catColor = getCategoryColor(tx.category, isIncome);
                const isFuelFill = tx.id?.startsWith('fill-');
                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={styles.rowItem}
                    onPress={() => {
                      if (isFuelFill) {
                        navigation.navigate('GarageTab' as any, { screen: 'EditFuelFill', params: { fillId: (tx.id as string).replace('fill-', '') } });
                      } else {
                        navigation.navigate('EditTransaction', { transactionId: tx.id });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.itemLeft}>
                      <View style={[styles.iconWrapper, { backgroundColor: `${catColor}15` }]}>
                        <Ionicons name={getCategoryIcon(tx.category)} size={18} color={catColor} />
                      </View>
                      <View>
                        <Text style={styles.itemTitle}>{tx.notes || tx.category}</Text>
                        <Text style={styles.itemSubtitle}>{tx.category}{isFuelFill ? ' · Garage' : ''}</Text>
                      </View>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={[styles.itemAmount, { color: catColor }]}>
                        {isIncome ? '+' : '-'}{formatCurrencyDetailed(tx.amount)}
                      </Text>
                      <Text style={styles.itemDate}>
                        {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            {allMonthTxs.length > 5 && (
              <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('AllTransactions')} activeOpacity={0.8}>
                <Text style={styles.viewAllText}>View All ({allMonthTxs.length - 5} more)</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddExpense')} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.textPrimary} />
      </TouchableOpacity>
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
  logoText: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  iconButton: { padding: 8, borderRadius: rounded.full },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 120,
  },
  summaryCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 1 },
  summaryValue: { fontSize: 30, fontWeight: '800' },
  budgetInfo: { gap: 8, marginTop: 8, width: '100%' },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLabel: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500' },
  budgetVal: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  barBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  budgetWarning: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  budgetWarningText: { fontSize: 12, fontWeight: '600', color: colors.attention },
  safeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  safeLabel: { fontSize: 11, color: colors.onSurfaceVariant },
  safeVal: { fontSize: 14, fontWeight: '700', color: colors.chartreuse },
  editBudgetBtn: { alignItems: 'center', paddingVertical: 6 },
  editBudgetText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  setBudgetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 8 },
  setBudgetText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  chartCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 16,
    gap: 10,
    overflow: 'hidden',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.attention,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tooltipText: { fontSize: 9, fontWeight: '700', color: colors.textPrimary },
  touchOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
  },
  touchSlice: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 24, gap: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  inpGrp: { gap: 6 },
  inpLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  inp: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, height: 44, paddingHorizontal: 12, color: colors.onSurface, fontSize: 14, fontWeight: '500' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: rounded.DEFAULT, alignItems: 'center' },
  modalCancelTxt: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
  modalSave: { flex: 1, paddingVertical: 12, borderRadius: rounded.DEFAULT, backgroundColor: colors.primaryContainer, alignItems: 'center' },
  modalSaveTxt: { fontSize: 14, color: colors.textPrimary, fontWeight: '700' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  listContainer: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrapper: { width: 32, height: 32, borderRadius: rounded.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  itemSubtitle: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 14, fontWeight: '700' },
  itemDate: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 2 },
  emptyState: { padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500' },
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border,
  },
  viewAllText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: rounded.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
