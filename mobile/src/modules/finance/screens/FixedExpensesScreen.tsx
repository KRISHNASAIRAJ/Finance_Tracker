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
import { useFinanceStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';

export default function FixedExpensesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { fixedExpenses, markFixedExpensePaid, unmarkFixedExpensePaid } = useFinanceStore();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const pendingExpenses = fixedExpenses.filter((item) => item.lastPaidMonth !== currentMonthStr);
  const totalPending = pendingExpenses.reduce((sum, item) => sum + item.amount, 0);

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Fixed Expenses</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL PENDING THIS MONTH</Text>
          <Text style={[styles.summaryValue, { color: totalPending > 0 ? colors.error : colors.success }]}>
            {formatCurrency(totalPending)}
          </Text>
        </View>

        {/* List of obligations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MONTHLY OBLIGATIONS</Text>
          <View style={styles.listContainer}>
            {fixedExpenses.map((item) => {
              const isPaid = item.lastPaidMonth === currentMonthStr;

              return (
                <View key={item.id} style={styles.rowItem}>
                  <View style={styles.itemLeft}>
                    <View
                      style={[
                        styles.iconWrapper,
                        { backgroundColor: isPaid ? `${colors.success}15` : `${colors.error}15` },
                      ]}
                    >
                      <Ionicons
                        name={item.category === 'Housing' ? 'home-outline' : 'trending-up-outline'}
                        size={18}
                        color={isPaid ? colors.success : colors.error}
                      />
                    </View>
                    <View>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.itemSubtitle}>
                        {isPaid
                          ? `Paid · Next due ${new Date(item.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                          : `Due on ${item.billingDay}th of month`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
                    {isPaid ? (
                      <TouchableOpacity
                        style={styles.paidBadge}
                        onPress={() => unmarkFixedExpensePaid(item.id, user?.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-circle" size={12} color={colors.textPrimary} />
                        <Text style={styles.paidBadgeText}>Paid</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.payButton}
                        onPress={() => markFixedExpensePaid(item.id, user?.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.payButtonText}>Pay</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
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
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
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
    gap: 6,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  payButton: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: rounded.DEFAULT,
  },
  payButtonText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  unpayButton: {
    backgroundColor: `${colors.error}14`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.error}28`,
  },
  unpayButtonText: {
    color: colors.error,
    fontSize: 11,
    fontWeight: '600',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rounded.full,
    gap: 4,
  },
  paidBadgeText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
});
