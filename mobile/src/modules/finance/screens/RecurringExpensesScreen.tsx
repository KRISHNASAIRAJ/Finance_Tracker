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

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  const r = n % 10;
  if (r === 1) return `${n}st`;
  if (r === 2) return `${n}nd`;
  if (r === 3) return `${n}rd`;
  return `${n}th`;
}

function isVariable(name: string): boolean {
  return name.toLowerCase().includes('electricity');
}

export default function RecurringExpensesScreen() {
  const navigation = useNavigation();
  const { cards, fixedExpenses, markFixedExpensePaid, unmarkFixedExpensePaid } = useFinanceStore();
  const { user } = useAuth();

  const totalOutstanding = cards.reduce((sum, c) => sum + c.balance, 0);

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  const isPaid = (item: typeof fixedExpenses[0]) => {
    if (!item.lastPaidMonth) return false;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return item.lastPaidMonth >= currentMonth;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Recurring & Dues</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Outstanding Dues */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL CREDIT CARD OUTSTANDING</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalOutstanding)}</Text>
        </View>

        {/* Credit Card Dues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIVE CARD BILLS</Text>
          <View style={styles.listContainer}>
            {cards.map((card) => (
              <View key={card.id} style={styles.rowItem}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: `${colors.error}15` }]}>
                    <Ionicons name="card-outline" size={18} color={colors.error} />
                  </View>
                  <View>
                    <Text style={styles.itemTitle}>{card.name} (•• {card.endingWith})</Text>
                    <Text style={styles.itemSubtitle}>Billing day: {card.billingDay}th</Text>
                  </View>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemAmount}>
                    {formatCurrency(card.billAmount ? Math.max(0, card.billAmount - (card.paidAmount || 0)) : card.balance)}
                  </Text>
                  <Text style={styles.dueDateText}>
                    Due {new Date(card.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* SIP & Investments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MONTHLY RECURRING SIPs</Text>
          <View style={styles.listContainer}>
            {fixedExpenses
              .filter((f) => f.category === 'Investments')
              .map((sip) => {
                const paid = isPaid(sip);
                return (
                  <View key={sip.id} style={styles.rowItem}>
                    <View style={styles.itemLeft}>
                      <View style={[styles.iconWrapper, { backgroundColor: paid ? `${colors.success}15` : `${colors.primary}15` }]}>
                        <Ionicons name="trending-up-outline" size={18} color={paid ? colors.success : colors.primary} />
                      </View>
                      <View>
                        <Text style={styles.itemTitle}>{sip.name}</Text>
                        <Text style={styles.itemSubtitle}>
                          Triggers every {ordinal(sip.billingDay)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={[styles.itemAmount, { color: paid ? colors.success : colors.primary }]}>
                        {formatCurrency(sip.amount)}
                      </Text>
                      <Text style={[styles.dueDateText, { color: paid ? colors.success : colors.error }]}>
                        {paid ? 'Paid' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            {fixedExpenses.filter((f) => f.category === 'Investments').length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="trending-up-outline" size={28} color={colors.outline} />
                <Text style={styles.emptyText}>No SIPs added</Text>
              </View>
            )}
          </View>
        </View>

        {/* Fixed Expenses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FIXED COST DUES</Text>
          <View style={styles.listContainer}>
            {fixedExpenses
              .filter((f) => f.category !== 'Investments')
              .map((fee) => {
                const paid = isPaid(fee);
                return (
                  <View key={fee.id} style={styles.rowItem}>
                    <View style={styles.itemLeft}>
                      <View style={[styles.iconWrapper, { backgroundColor: paid ? `${colors.success}15` : `${colors.error}15` }]}>
                        <Ionicons
                          name={isVariable(fee.name) ? 'flash-outline' : fee.category === 'Housing' ? 'home-outline' : 'receipt-outline'}
                          size={18}
                          color={paid ? colors.success : colors.error}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{fee.name}</Text>
                        <Text style={styles.itemSubtitle}>
                          {isVariable(fee.name)
                            ? 'Variable amount — set monthly in Fixed Expenses'
                            : `Due on ${ordinal(fee.billingDay)} of every month`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={styles.itemAmount}>
                        {formatCurrency(fee.amount)}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          paid
                            ? unmarkFixedExpensePaid(fee.id, user?.id)
                            : markFixedExpensePaid(fee.id, user?.id)
                        }
                        style={[
                          styles.statusPill,
                          { backgroundColor: paid ? `${colors.success}15` : `${colors.error}15` },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            { color: paid ? colors.success : colors.error },
                          ]}
                        >
                          {paid ? 'Paid (tap to undo)' : 'Pay'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            {fixedExpenses.filter((f) => f.category !== 'Investments').length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={28} color={colors.outline} />
                <Text style={styles.emptyText}>No fixed expenses</Text>
              </View>
            )}
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
    color: colors.onSurface,
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
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  dueDateText: {
    fontSize: 11,
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
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: rounded.full,
    marginTop: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
