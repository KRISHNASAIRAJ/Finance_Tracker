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
import { useFinanceStore, getMinBalanceForAccount } from '../store';

const ordinalSuffix = (n: number): string => {
  if (n >= 11 && n <= 13) return 'th';
  const last = n % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
};

const formatDueDate = (isoDate?: string): string => {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  return `Due ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
};

export default function BalanceSummaryScreen() {
  const navigation = useNavigation();
  const { transactions, cards, receivables, accounts, fixedExpenses } = useFinanceStore();

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.amount, 0);
  const totalMinBalance = accounts.reduce((sum, acc) => sum + getMinBalanceForAccount(acc.title), 0);
  const effectiveBalance = totalBalance - totalMinBalance;
  const totalLent = receivables.filter((r) => r.type === 'lent').reduce((sum, r) => sum + r.amount, 0);
  const totalBorrowed = receivables.filter((r) => r.type === 'borrowed').reduce((sum, r) => sum + r.amount, 0);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const unpaidFixedExpensesTotal = fixedExpenses
    .filter((f) => f.lastPaidMonth !== currentMonthStr)
    .reduce((sum, f) => sum + f.amount, 0);
  const cardOutstandingTotal = cards.reduce((sum, c) => sum + c.balance, 0);
  const deficitsSum = accounts.reduce((sum, acc) => {
    const min = getMinBalanceForAccount(acc.title);
    return sum + (acc.amount < min ? min - acc.amount : 0);
  }, 0);
  const totalNetWorth = effectiveBalance + totalLent - totalBorrowed - unpaidFixedExpensesTotal - cardOutstandingTotal;

  // Monthly expenses
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthlyTxns = transactions
    .filter((tx) => new Date(tx.date) >= startOfMonth && (tx.type === 'expense' || tx.type === 'fuel_purchase' || tx.type === 'vehicle_service'));
  const monthlyExpenses = monthlyTxns.reduce((sum, tx) => sum + tx.amount, 0);
  const monthlyTxCount = monthlyTxns.length;

  const formatCurrency = (paise: number) => {
    const rupees = paise / 100;
    return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
  };

  const sections = [
    {
      title: 'Bank Balances',
      icon: 'business-outline',
      color: '#10b981',
      items: accounts.map((acc) => ({
        label: acc.title,
        value: acc.amount,
        subtitle: acc.amount < getMinBalanceForAccount(acc.title)
          ? `Below min ₹${(getMinBalanceForAccount(acc.title) / 100).toLocaleString('en-IN')}`
          : '',
        alert: acc.amount < getMinBalanceForAccount(acc.title),
      })),
      total: totalBalance,
      totalLabel: 'Total Bank Balance',
    },
    {
      title: 'Credit Card Bills',
      icon: 'card-outline',
      color: '#f59e0b',
      items: cards.filter((c) => c.balance > 0).map((c) => ({
        label: `${c.name} •••• ${c.endingWith}`,
        value: c.balance,
        subtitle: formatDueDate(c.dueDate),
        alert: false,
      })),
      total: cardOutstandingTotal,
      totalLabel: 'Total Card Bills',
    },
    {
      title: 'Lent Money',
      icon: 'arrow-up-circle-outline',
      color: '#3b82f6',
      items: receivables.filter((r) => r.type === 'lent').map((r) => ({
        label: r.personName,
        value: r.amount,
        subtitle: formatDueDate(r.dueDate),
        alert: false,
      })),
      total: totalLent,
      totalLabel: 'Total Lent',
    },
    {
      title: 'Borrowed Money',
      icon: 'arrow-down-circle-outline',
      color: '#ef4444',
      items: receivables.filter((r) => r.type === 'borrowed').map((r) => ({
        label: r.personName,
        value: r.amount,
        subtitle: formatDueDate(r.dueDate),
        alert: false,
      })),
      total: totalBorrowed,
      totalLabel: 'Total Borrowed',
    },
    {
      title: 'Fixed Expenses (Unpaid)',
      icon: 'lock-closed-outline',
      color: '#6366f1',
      items: fixedExpenses.filter((f) => f.lastPaidMonth !== currentMonthStr).map((f) => ({
        label: f.name,
        value: f.amount,
        subtitle: `Due ${f.billingDay}${ordinalSuffix(f.billingDay)} of month`,
        alert: false,
      })),
      total: unpaidFixedExpensesTotal,
      totalLabel: 'Total Unpaid Fixed',
    },
    {
      title: 'Monthly Spends',
      icon: 'wallet-outline',
      color: colors.primary,
      items: monthlyTxns
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3)
        .map((tx) => ({
          label: tx.notes || tx.category || 'Expense',
          value: tx.amount,
          subtitle: new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          alert: false,
        })),
      total: monthlyExpenses,
      totalLabel: 'This Month',
      showViewAll: monthlyTxCount > 3,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Balance Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Net Worth Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total Net Worth</Text>
          <Text style={styles.heroValue}>{formatCurrency(totalNetWorth)}</Text>
          <View style={styles.heroBreakdown}>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>Banks</Text>
              <Text style={styles.heroChipValue}>{formatCurrency(effectiveBalance)}</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>Lent</Text>
              <Text style={[styles.heroChipValue, { color: '#3b82f6' }]}>+{formatCurrency(totalLent)}</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>Cards</Text>
              <Text style={[styles.heroChipValue, { color: '#f59e0b' }]}>-{formatCurrency(cardOutstandingTotal)}</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>Fixed</Text>
              <Text style={[styles.heroChipValue, { color: '#6366f1' }]}>-{formatCurrency(unpaidFixedExpensesTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: `${section.color}20` }]}>
                <Ionicons name={section.icon as any} size={18} color={section.color} />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={[styles.sectionTotal, { color: section.color }]}>{formatCurrency(section.total)}</Text>
            </View>
            {section.items.length > 0 && (
              <View style={styles.sectionBody}>
                {section.items.map((item, idx) => (
                  <View key={idx} style={[styles.itemRow, idx === section.items.length - 1 && !(section as any).showViewAll && { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                      {item.subtitle && (
                        <Text style={[styles.itemSubtitle, item.alert && { color: '#ef4444' }]}>{item.subtitle}</Text>
                      )}
                    </View>
                    <Text style={[styles.itemValue, item.alert && { color: '#ef4444' }]}>{formatCurrency(item.value)}</Text>
                  </View>
                ))}
                {(section as any).showViewAll && (
                  <TouchableOpacity
                    style={styles.viewAllBtn}
                    onPress={() => navigation.navigate('MonthlySpend' as never)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewAllText}>View All ({monthlyTxCount} total)</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            {section.items.length === 0 && (
              <View style={styles.sectionBody}>
                <Text style={styles.emptyText}>No entries</Text>
              </View>
            )}
          </View>
        ))}

        {deficitsSum > 0 && (
          <View style={styles.deficitBanner}>
            <Ionicons name="warning" size={16} color="#f59e0b" />
            <Text style={styles.deficitText}>
              Bank balance deficits: {formatCurrency(deficitsSum)} below minimum required
            </Text>
          </View>
        )}
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
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    gap: 8,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -1,
  },
  heroBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    justifyContent: 'center',
  },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 72,
  },
  heroChipLabel: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
    marginBottom: 2,
  },
  heroChipValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  section: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  sectionTotal: {
    fontSize: 14,
    fontWeight: '800',
  },
  sectionBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.03)',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  itemSubtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  itemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  emptyText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: 16,
  },
  deficitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: rounded.DEFAULT,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  deficitText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
    flex: 1,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.03)',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
