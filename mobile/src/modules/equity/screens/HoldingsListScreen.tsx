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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore } from '../store';
import { InvestmentsStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<InvestmentsStackParamList, 'HoldingsList'>;
type RouteProps = RouteProp<InvestmentsStackParamList, 'HoldingsList'>;

const formatCurrency = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatCurrencyDetailed = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export default function HoldingsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const tab = route.params?.tab ?? 'equity';
  const { holdings } = useInvestmentsStore();

  const isMF = tab === 'mf';
  const filtered = holdings.filter((h) =>
    isMF ? h.type === 'mf' : h.type !== 'mf',
  );

  const totalValue = filtered.reduce((s, h) => s + h.quantity * h.currentPrice, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>
          {isMF ? 'Mutual Funds' : 'Equity Holdings'}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddEditHolding', {})}>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>TOTAL VALUE</Text>
          <Text style={styles.heroValue}>{formatCurrency(totalValue)}</Text>
          <Text style={styles.heroSub}>{filtered.length} holding{filtered.length !== 1 ? 's' : ''}</Text>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={isMF ? 'wallet-outline' : 'trending-up-outline'} size={40} color={colors.outline} />
            <Text style={styles.emptyText}>No {isMF ? 'mutual fund' : 'equity'} holdings yet</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {filtered.map((h) => {
              const hTotalValue = h.quantity * h.currentPrice;
              const hTotalCost = h.quantity * h.avgPrice;
              const profitLoss = hTotalValue - hTotalCost;
              const plPercent = hTotalCost > 0 ? ((profitLoss / hTotalCost) * 100).toFixed(1) : '0.0';
              const isProfit = profitLoss >= 0;

              return (
                <TouchableOpacity
                  key={h.id}
                  style={styles.holdingRow}
                  onPress={() => navigation.navigate('AddEditHolding', { holdingId: h.id })}
                >
                  <View style={styles.holdingLeft}>
                    {isMF ? (
                      <>
                        <Text style={styles.holdingName} numberOfLines={1}>{h.name}</Text>
                        <Text style={styles.holdingCode}>{h.symbol}</Text>
                        <Text style={styles.holdingQty}>
                          {h.quantity.toFixed(2)} Units · NAV {formatCurrencyDetailed(h.currentPrice)}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                        <Text style={styles.holdingName} numberOfLines={1}>{h.name}</Text>
                        <Text style={styles.holdingQty}>
                          {h.quantity} Shares · Avg {formatCurrencyDetailed(h.avgPrice)}
                        </Text>
                      </>
                    )}
                  </View>
                  <View style={styles.holdingRight}>
                    <Text style={styles.holdingValue}>{formatCurrency(hTotalValue)}</Text>
                    <View style={[styles.plBadge, { backgroundColor: isProfit ? `${colors.success}15` : `${colors.error}15` }]}>
                      <Text style={[styles.plText, { color: isProfit ? colors.success : colors.error }]}>
                        {isProfit ? '+' : ''}{plPercent}%
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    alignItems: 'center',
    gap: 4,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.onSurface,
  },
  heroSub: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  listCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    overflow: 'hidden',
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  holdingLeft: {
    flex: 1,
    marginRight: 12,
  },
  holdingSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  holdingName: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  holdingCode: {
    fontSize: 11,
    color: colors.outline,
    marginTop: 2,
  },
  holdingQty: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  holdingRight: {
    alignItems: 'flex-end',
  },
  holdingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  plBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: rounded.full,
    marginTop: 4,
  },
  plText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
