import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore } from '../store';
import { getCategoryIcon, getCategoryColor } from '../../../shared/categoryMap';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'AllTransactions'>;

export default function AllTransactionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { transactions } = useFinanceStore();

  const formatCurrencyDetailed = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  };

  // Sort transactions by date descending, then group by date
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const grouped: { date: string; items: typeof transactions }[] = [];
  const dateMap: Record<string, typeof transactions> = {};

  sorted.forEach((tx) => {
    const dateKey = new Date(tx.date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = [];
      grouped.push({ date: dateKey, items: dateMap[dateKey] });
    }
    dateMap[dateKey].push(tx);
  });

  type ListItem =
    | { type: 'header'; date: string }
    | { type: 'transaction'; tx: (typeof transactions)[number] };

  const flatData: ListItem[] = [];
  grouped.forEach((group) => {
    flatData.push({ type: 'header', date: group.date });
    group.items.forEach((tx) => flatData.push({ type: 'transaction', tx }));
  });

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return <Text style={styles.dateHeader}>{item.date}</Text>;
    }

    const { tx } = item;
    const isIncome = tx.type === 'income';
    const catColor = getCategoryColor(tx.category, isIncome);

    return (
      <TouchableOpacity
        style={styles.txRow}
        onPress={() => navigation.navigate('EditTransaction', { transactionId: tx.id })}
        activeOpacity={0.8}
      >
        <View style={styles.txLeft}>
          <View style={[styles.txIcon, { backgroundColor: `${catColor}18` }]}>
            <Ionicons name={getCategoryIcon(tx.category)} size={18} color={catColor} />
          </View>
          <View style={styles.txDetails}>
            <Text style={styles.txTitle} numberOfLines={1}>
              {tx.notes || tx.category}
            </Text>
            <Text style={styles.txSubtitle}>
              {tx.category} • {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color: catColor }]}>
            {isIncome ? '+' : '-'}{formatCurrencyDetailed(tx.amount)}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.outline} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.logoText}>All Transactions</Text>
          <Text style={styles.logoSub}>{transactions.length} records</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={flatData}
        keyExtractor={(item, index) =>
          item.type === 'header' ? `h-${item.date}` : `tx-${item.tx.id}-${index}`
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={colors.outline} />
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        }
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
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  logoSub: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 1,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  listContent: {
    paddingHorizontal: spacing.containerPadding,
    paddingBottom: 32,
  },
  dateHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
    paddingTop: 20,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 4,
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: rounded.DEFAULT,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetails: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  txSubtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  txRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
});
