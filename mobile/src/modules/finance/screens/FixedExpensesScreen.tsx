/**
 * FixedExpensesScreen — the monthly obligations list.
 *
 * Restyled to the Meridian v2 reference: a completion ring with the pending
 * total, a monthly-total breakdown bar and the upcoming due dates.
 */
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  Chip,
  IconTile,
  Label,
  PressScale,
  Ring,
  Rise,
  Screen,
  StackedShareBar,
  type ShareSegment,
} from '../../../shared/components/meridian';
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

function getIcon(name: string, category: string): keyof typeof Ionicons.glyphMap {
  if (category === 'Housing') return 'home-outline';
  if (category === 'Investments') return 'trending-up-outline';
  if (isVariable(name)) return 'flash-outline';
  return 'receipt-outline';
}

/** The bucket an obligation falls into — drives the colour and the split. */
function bucketOf(name: string, category: string): 'bills' | 'sips' | 'other' {
  const n = name.toLowerCase();
  const c = (category || '').toLowerCase();
  if (c === 'investments' || n.includes('sip') || n.includes('flexi') || n.includes('invesco') || n.includes('motilal')) {
    return 'sips';
  }
  if (c === 'housing' || n.includes('rent') || n.includes('electricity') || n.includes('bill')) {
    return 'bills';
  }
  return 'other';
}

export default function FixedExpensesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { fixedExpenses, payFixedExpenseWithAmount, unmarkFixedExpensePaid } = useFinanceStore();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const ORDER = ['rent', 'electricity', 'flexi', 'invesco', 'motilal', 'midcap', 'mid cap', 'small cap'];
  const orderedExpenses = [...fixedExpenses].sort((a, b) => {
    const rank = (name: string) => {
      const n = name.toLowerCase();
      const idx = ORDER.findIndex((k) => n.includes(k));
      return idx === -1 ? ORDER.length : idx;
    };
    return rank(a.name) - rank(b.name);
  });

  const pendingExpenses = orderedExpenses.filter((item) => item.lastPaidMonth !== currentMonthStr);
  const totalPending = pendingExpenses.reduce((sum, item) => sum + item.amount, 0);
  const paidCount = orderedExpenses.length - pendingExpenses.length;
  const totalMonthly = orderedExpenses.reduce((sum, item) => sum + item.amount, 0);

  // The split of the monthly total by bucket — real data, real totals.
  const buckets = orderedExpenses.reduce(
    (acc, item) => {
      const b = bucketOf(item.name, item.category);
      acc[b] += item.amount;
      return acc;
    },
    { bills: 0, sips: 0, other: 0 }
  );
  const segments: ShareSegment[] = [
    { key: 'bills', value: buckets.bills, color: mc.sky },
    { key: 'sips', value: buckets.sips, color: mc.violet },
    { key: 'other', value: buckets.other, color: mc.amber },
  ].filter((s) => s.value > 0);

  const [amountInputs, setAmountInputs] = React.useState<Record<string, string>>({});

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  return (
    <Screen bottomInset={40}>
      {/* Header */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale onPress={() => navigation.goBack()} scale={0.9} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <Text style={styles.logoText}>Fixed expenses</Text>
          <View style={styles.appBarSpacer} />
        </View>
      </Rise>

      {/* Pending this month */}
      <Rise index={1}>
        <Card>
          <View style={styles.summaryRow}>
            <Ring
              progress={orderedExpenses.length ? paidCount / orderedExpenses.length : 0}
              size={84}
              stroke={9}
              color={pendingExpenses.length === 0 ? mc.mint : mc.amber}
            >
              <Text style={styles.ringText}>
                {paidCount}/{orderedExpenses.length}
              </Text>
            </Ring>
            <View style={styles.summaryMain}>
              <Label>PENDING THIS MONTH</Label>
              <Text
                style={[
                  styles.summaryValue,
                  { color: pendingExpenses.length === 0 ? mc.mint : mc.amber },
                ]}
              >
                {formatCurrency(totalPending)}
              </Text>
              <Text style={styles.summarySub}>
                {pendingExpenses.length === 0
                  ? 'All obligations paid'
                  : `${pendingExpenses.length} of ${orderedExpenses.length} still due`}
              </Text>
            </View>
          </View>
        </Card>
      </Rise>

      {/* Monthly total */}
      {totalMonthly > 0 ? (
        <Rise index={2}>
          <Card>
            <View style={styles.rowBetween}>
              <Label>MONTHLY TOTAL</Label>
              <Text style={styles.rowValue}>{formatCurrency(totalMonthly)}</Text>
            </View>
            <StackedShareBar segments={segments} height={12} style={styles.splitBar} />
            <View style={styles.splitLegend}>
              {buckets.bills > 0 ? (
                <View style={styles.splitItem}>
                  <View style={[styles.splitDot, { backgroundColor: mc.sky }]} />
                  <Text style={styles.splitLabel}>Rent and bills {formatCurrency(buckets.bills)}</Text>
                </View>
              ) : null}
              {buckets.sips > 0 ? (
                <View style={styles.splitItem}>
                  <View style={[styles.splitDot, { backgroundColor: mc.violet }]} />
                  <Text style={styles.splitLabel}>SIPs {formatCurrency(buckets.sips)}</Text>
                </View>
              ) : null}
              {buckets.other > 0 ? (
                <View style={styles.splitItem}>
                  <View style={[styles.splitDot, { backgroundColor: mc.amber }]} />
                  <Text style={styles.splitLabel}>Other {formatCurrency(buckets.other)}</Text>
                </View>
              ) : null}
            </View>
          </Card>
        </Rise>
      ) : null}

      {/* Upcoming due dates */}
      <Rise index={3}>
        <Label style={styles.sectionTitle}>UPCOMING DUE DATES</Label>
        <Card pad={false}>
          {orderedExpenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No fixed expenses yet.</Text>
            </View>
          ) : (
            orderedExpenses.map((item, idx) => {
              const isPaid = item.lastPaidMonth === currentMonthStr;
              const variable = isVariable(item.name);
              const inputKey = `amt_${item.id}`;
              const inputVal = amountInputs[inputKey] ?? (item.amount / 100).toString();
              const bucket = bucketOf(item.name, item.category);
              const accent =
                bucket === 'sips' ? mc.violet : bucket === 'bills' ? mc.sky : mc.amber;

              return (
                <View key={item.id} style={[styles.rowItem, idx > 0 && styles.rowItemDivider]}>
                  <IconTile icon={getIcon(item.name, item.category)} color={accent} size={38} radius={13} />
                  <View style={styles.itemMain}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemSubtitle}>
                      {isPaid
                        ? `Paid · Next due ${new Date(item.dueDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}`
                        : item.billingDay === 31
                          ? 'Due on the last day of every month'
                          : `Due on ${ordinal(item.billingDay)} of every month`}
                    </Text>
                  </View>
                  <View style={styles.itemRight}>
                    {variable && !isPaid ? (
                      <View style={styles.variableWrap}>
                        <TextInput
                          style={styles.amountInput}
                          value={inputVal}
                          onChangeText={(v) =>
                            setAmountInputs((prev) => ({ ...prev, [inputKey]: v }))
                          }
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={mc.textFaint}
                        />
                        <PressScale
                          onPress={() => {
                            const val = parseFloat(inputVal);
                            if (isNaN(val) || val <= 0) {
                              alert('Enter a valid amount');
                              return;
                            }
                            payFixedExpenseWithAmount(item.id, Math.round(val * 100), user?.id);
                          }}
                          scale={0.95}
                          style={styles.payButton}
                        >
                          <Text style={styles.payButtonText}>Pay</Text>
                        </PressScale>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
                        {isPaid ? (
                          <PressScale
                            onPress={() => unmarkFixedExpensePaid(item.id, user?.id)}
                            scale={0.95}
                          >
                            <Chip size="sm" variant="solid" color={mc.mint} icon="checkmark">
                              Paid
                            </Chip>
                          </PressScale>
                        ) : (
                          <PressScale
                            onPress={() =>
                              payFixedExpenseWithAmount(item.id, item.amount, user?.id)
                            }
                            scale={0.95}
                            style={styles.payButton}
                          >
                            <Text style={styles.payButtonText}>Pay</Text>
                          </PressScale>
                        )}
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    flex: 1,
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },
  appBarSpacer: {
    width: 38,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summaryMain: {
    flex: 1,
    minWidth: 0,
  },
  ringText: {
    fontSize: 16,
    fontWeight: '500',
    color: mc.text,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '500',
    marginTop: 2,
  },
  summarySub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },
  splitBar: {
    marginVertical: 12,
  },
  splitLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  splitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  splitLabel: {
    fontSize: 12,
    color: mc.textDim,
  },

  sectionTitle: {
    marginTop: 6,
    marginBottom: 8,
    marginLeft: 4,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowItemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 15,
    color: mc.text,
  },
  itemSubtitle: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },
  variableWrap: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amountInput: {
    backgroundColor: mc.raised,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: mc.text,
    fontSize: 13,
    minWidth: 80,
    textAlign: 'right',
  },
  payButton: {
    backgroundColor: mc.red,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  payButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: mc.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: mc.textDim,
  },
});
