/**
 * AllTransactionsScreen — full chronological list of all transactions
 * (including garage fuel fills) with search, category chips and a monthly
 * summary card, grouped by day.
 *
 * Restyled to the Meridian v2 reference (s18): centred title with a record
 * count, a search field, category filter chips, the current-month spend
 * summary and per-day groups inside cards. Edit/delete still works through
 * the expandable transaction card.
 */
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  EmptyState,
  Label,
  PressScale,
  Screen,
  TopBar,
} from '../../../shared/components/meridian';
import { useFinanceStore } from '../store';
import { useGarageStore } from '../../garage/store';
import ExpandableTransactionCard from '../../../shared/components/ExpandableTransactionCard';
import { useAuth } from '../../../services/AuthProvider';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'AllTransactions'>;

const isWalletLoadTx = (tx: any) =>
  tx?.category?.toLowerCase() === 'wallet loads' ||
  tx?.category?.toLowerCase() === 'wallet load' ||
  tx?.notes?.toLowerCase().includes('wallet load') ||
  tx?.notes?.toLowerCase().includes('payzapp');

export default function AllTransactionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { transactions, deleteTransaction, monthlyBudget, getMonthlyExpenses } = useFinanceStore();
  const { fills: garageFills, deleteFuelFill } = useGarageStore();
  const { user } = useAuth();

  const [searchVisible, setSearchVisible] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const monthTotal = getMonthlyExpenses();
  const budgetPaise = (monthlyBudget ?? 0) * 100;
  const budgetPct = budgetPaise > 0 ? Math.min(0.99, monthTotal / budgetPaise) : 0;
  const budgetPillPct = budgetPaise > 0 ? Math.round((monthTotal / budgetPaise) * 100) : 0;
  const budgetPillColor = budgetPct >= 0.9 ? mc.redSoft : budgetPct >= 0.7 ? mc.amber : mc.mint;

  const categoryChips = useMemo(() => {
    const totals = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== 'expense' && tx.type !== 'vehicle_service') continue;
      if (isWalletLoadTx(tx)) continue;
      totals.set(tx.category, (totals.get(tx.category) ?? 0) + (tx.amount ?? 0));
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat]) => cat);
  }, [transactions]);

  const filteredTxs = transactions.filter((tx) => tx.type !== 'fuel_purchase');
  const fuelPseudoTxs: any[] = garageFills.map((f) => ({
    id: `fill-${f.id}`,
    type: 'expense',
    amount: f.amount,
    currency: 'INR',
    category: 'Fuel',
    notes: `${Number(f.liters).toFixed(2)}L Fuel`,
    date: f.date,
    source: 'manual',
  }));

  // Text + category filter (the search field and the chips)
  const q = query.trim().toLowerCase();
  const matches = (tx: any) => {
    if (activeCategory !== 'All' && tx.category !== activeCategory) return false;
    if (!q) return true;
    const amountText = ((tx.amount ?? 0) / 100).toFixed(2);
    return (
      (tx.notes ?? '').toLowerCase().includes(q) ||
      (tx.category ?? '').toLowerCase().includes(q) ||
      amountText.includes(q)
    );
  };

  const sorted = [...filteredTxs, ...fuelPseudoTxs]
    .filter(matches)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Group by day — headers get the day total (wallet loads excluded)
  const dayStartOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = dayStartOf(new Date());
  const yesterdayStart = todayStart - 86400000;

  type ListItem =
    | { type: 'header'; key: string; label: string; total: number }
    | { type: 'group'; key: string; items: any[] };

  const flatData: ListItem[] = [];
  const itemsByDay = new Map<number, any[]>();
  for (const tx of sorted) {
    const dayKey = dayStartOf(new Date(tx.date));
    const list = itemsByDay.get(dayKey) ?? [];
    list.push(tx);
    itemsByDay.set(dayKey, list);
  }
  [...itemsByDay.entries()]
    .sort((a, b) => b[0] - a[0])
    .forEach(([dayKey, items]) => {
      const d = new Date(dayKey);
      const label =
        dayKey === todayStart
          ? 'TODAY'
          : dayKey === yesterdayStart
            ? 'YESTERDAY'
            : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }).toUpperCase();
      const total = items
        .filter((tx) => (tx.type === 'expense' || tx.type === 'vehicle_service') && !isWalletLoadTx(tx))
        .reduce((sum, tx) => sum + (tx.amount ?? 0), 0);
      flatData.push({ type: 'header', key: `h-${dayKey}`, label, total });
      flatData.push({ type: 'group', key: `g-${dayKey}`, items });
    });

  const handleEdit = (tx: any) => {
    if (typeof tx.id === 'string' && tx.id.startsWith('fill-')) {
      navigation.navigate('GarageTab' as any, { screen: 'EditFuelFill', params: { fillId: tx.id.replace('fill-', '') } });
    } else {
      navigation.navigate('EditTransaction', { transactionId: tx.id });
    }
  };

  const handleDelete = (tx: any) => {
    const isFill = typeof tx.id === 'string' && tx.id.startsWith('fill-');
    Alert.alert(
      'Delete Transaction',
      `Delete "${tx.notes || tx.category}" for ${formatCurrencyDetailed(tx.amount)}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (isFill) {
              deleteFuelFill(tx.id.replace('fill-', ''), user?.id);
            } else {
              deleteTransaction(tx.id, user?.id);
            }
          },
        },
      ]
    );
  };

  const formatCurrencyDetailed = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  };

  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' }).toUpperCase();
  const formatWhole = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.groupHead}>
          <Text style={styles.groupLabel}>{item.label}</Text>
          <Text style={styles.groupTotal}>{formatWhole(item.total)}</Text>
        </View>
      );
    }

    return (
      <Card pad={false} style={styles.groupCard}>
        {item.items.map((tx, index) => (
          <React.Fragment key={tx.id}>
            {index > 0 ? <View style={styles.rowDivider} /> : null}
            <ExpandableTransactionCard
              tx={tx}
              formatAmount={formatCurrencyDetailed}
              onPressEdit={() => handleEdit(tx)}
              onPressDelete={() => handleDelete(tx)}
            />
          </React.Fragment>
        ))}
      </Card>
    );
  };

  const rightSlot = (
    <PressScale
      onPress={() => setSearchVisible((v) => !v)}
      scale={0.92}
      accessibilityLabel="Toggle search"
      style={styles.filterBtn}
    >
      <Ionicons name="options-outline" size={19} color={mc.text} />
    </PressScale>
  );

  return (
    <Screen scroll={false}>
      <TopBar
        title="All transactions"
        subtitle={`${transactions.length} records`}
        onBack={() => navigation.goBack()}
        right={rightSlot}
      />

      {searchVisible ? (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={mc.textGhost} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, category, amount"
            placeholderTextColor={mc.textGhost}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color={mc.textGhost} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        keyboardShouldPersistTaps="handled"
      >
        {['All', ...categoryChips].map((cat) => {
          const active = activeCategory === cat;
          return (
            <PressScale
              key={cat}
              onPress={() => setActiveCategory(active ? 'All' : cat)}
              scale={0.96}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>
                {cat}
              </Text>
            </PressScale>
          );
        })}
      </ScrollView>

      {/* Month summary */}
      <Card style={styles.monthCard}>
        <View style={styles.monthLeft}>
          <Label>{monthName}</Label>
          <View style={styles.monthValueRow}>
            <Text style={styles.monthValue}>{formatWhole(monthTotal)}</Text>
            <Text style={styles.monthOut}> out</Text>
          </View>
        </View>
        {budgetPaise > 0 ? (
          <View style={[styles.budgetPill, { backgroundColor: mc.amberDim }]}>
            <Text style={[styles.budgetPillText, { color: budgetPillColor }]}>
              {budgetPillPct}% of budget
            </Text>
          </View>
        ) : null}
      </Card>

      <FlatList
        data={flatData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="No transactions found"
            subtitle={q || activeCategory !== 'All' ? 'Try a different search or filter' : undefined}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 18,
    marginTop: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: mc.text,
    padding: 0,
  },
  chipRow: {
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: mr.chip,
    backgroundColor: mc.raised,
  },
  filterChipActive: {
    backgroundColor: mc.redDim,
  },
  filterChipText: {
    fontSize: 13,
    color: mc.textDim,
  },
  filterChipTextActive: {
    color: mc.redSoft,
    fontWeight: '600',
  },
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 18,
    marginBottom: 4,
  },
  monthLeft: {
    gap: 2,
  },
  monthValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  monthValue: {
    fontSize: 24,
    fontWeight: '500',
    color: mc.text,
  },
  monthOut: {
    fontSize: 12,
    color: mc.textDim,
  },
  budgetPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  budgetPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 6,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.2,
    color: mc.textDim,
  },
  groupTotal: {
    fontSize: 12,
    fontWeight: '500',
    color: mc.textDim,
  },
  groupCard: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mc.line,
    marginHorizontal: 6,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
