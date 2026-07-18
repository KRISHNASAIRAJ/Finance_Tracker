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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore, Transaction } from '../store';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import { getCategoryIcon, getCategoryColor } from './AddExpenseScreen';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'MonthlySpend'>;

export default function MonthlySpendScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { transactions } = useFinanceStore();

  // Filter transactions for the current calendar month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyTxs = transactions.filter((tx) => new Date(tx.date) >= startOfMonth);
  const totalSpend = monthlyTxs
    .filter((tx) => tx.type === 'expense' || tx.type === 'fuel_purchase' || tx.type === 'vehicle_service')
    .reduce((sum, tx) => sum + tx.amount, 0);

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
        <Text style={styles.logoText}>Monthly Spend</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Spend */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL MONTH SPEND</Text>
          <Text style={[styles.summaryValue, { color: colors.error }]}>{formatCurrency(totalSpend)}</Text>
        </View>

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
              monthlyTxs.map((tx) => {
                const isIncome = tx.type === 'income';
                const catColor = getCategoryColor(tx.category, isIncome);
                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={styles.rowItem}
                    onPress={() => navigation.navigate('EditTransaction', { transactionId: tx.id })}
                    activeOpacity={0.8}
                  >
                    <View style={styles.itemLeft}>
                      <View
                        style={[
                          styles.iconWrapper,
                          { backgroundColor: `${catColor}15` },
                        ]}
                      >
                        <Ionicons
                          name={getCategoryIcon(tx.category)}
                          size={18}
                          color={catColor}
                        />
                      </View>
                      <View>
                        <Text style={styles.itemTitle}>{tx.notes || tx.category}</Text>
                        <Text style={styles.itemSubtitle}>{tx.category}</Text>
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
          </View>
        </View>
      </ScrollView>

      {/* FAB - Moved here from main Finance screen! */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddExpense')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
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
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
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
    paddingBottom: 120, // offset for FAB
  },
  summaryCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: '800',
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
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  itemSubtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemDate: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
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
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
  },
});
