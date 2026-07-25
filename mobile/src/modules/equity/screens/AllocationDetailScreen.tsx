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
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore, Holding } from '../store';

const CAT_COLORS: Record<string, string> = {
  Equity: '#9BA5FF',
  'Mutual Funds': '#8894A8',
  Gold: '#E2A45C',
  Realty: '#59D6C7',
  ETF: '#FF887D',
  Other: '#8894A8',
};

const HOLDING_COLORS = [
  '#9BA5FF', '#59D6C7', '#FF887D', '#E2A45C', '#BCE85D',
  '#B3BBFF', '#74E0D4', '#FFA297', '#EDBB76', '#CCF070',
  '#7A84E0', '#3FBBAE', '#E06A60', '#D49A4E', '#A3CC40',
];

const formatCurrency = (paise: number) =>
  `\u20B9${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatCurrencyDetailed = (paise: number) =>
  `\u20B9${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export default function AllocationDetailScreen() {
  const navigation = useNavigation();
  const { holdings } = useInvestmentsStore();

  const holdingValues = holdings.map((h: Holding) => ({
    ...h,
    value: h.quantity * h.currentPrice,
  }));

  const totalValue = holdingValues.reduce((s: number, h: any) => s + h.value, 0);

  // Sort by value descending and assign colors
  const sorted = [...holdingValues]
    .sort((a: any, b: any) => b.value - a.value)
    .map((h: any, i: number) => ({
      ...h,
      pct: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
      color: HOLDING_COLORS[i % HOLDING_COLORS.length],
    }));

  const R = 70;
  const strokeW = 18;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * R;
  let offset = 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Portfolio Breakdown</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {sorted.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="pie-chart-outline" size={32} color={colors.outline} />
            <Text style={styles.emptyText}>No holdings to show</Text>
          </View>
        ) : (
          <>
            {/* Donut Chart */}
            <View style={styles.donutCard}>
              <View style={styles.donutRow}>
                <Svg width={180} height={180} viewBox="0 0 180 180">
                  {sorted.map((h: any) => {
                    const sliceLen = (h.value / totalValue) * circumference;
                    const dashArray = `${sliceLen} ${circumference - sliceLen}`;
                    const segment = (
                      <Circle
                        key={h.id}
                        cx={cx}
                        cy={cy}
                        r={R}
                        stroke={h.color}
                        strokeWidth={strokeW}
                        strokeDasharray={dashArray}
                        strokeDashoffset={-offset}
                        fill="none"
                        strokeLinecap="butt"
                      />
                    );
                    offset += sliceLen;
                    return segment;
                  })}
                  <SvgText
                    x={cx}
                    y={cy - 4}
                    textAnchor="middle"
                    fontSize={16}
                    fontWeight="800"
                    fill={colors.onSurface}
                  >
                    {formatCurrency(totalValue)}
                  </SvgText>
                  <SvgText
                    x={cx}
                    y={cy + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fill={colors.onSurfaceVariant}
                  >
                    Total
                  </SvgText>
                </Svg>
                <View style={styles.donutSummary}>
                  <Text style={styles.donutCount}>{sorted.length} holdings</Text>
                  <Text style={styles.donutSubText}>in portfolio</Text>
                </View>
              </View>
            </View>

            {/* Individual Holding Cards */}
            <Text style={styles.sectionLabel}>INDIVIDUAL HOLDINGS</Text>
            {sorted.map((h: any) => {
              const cost = h.quantity * h.avgPrice;
              const pnl = h.value - cost;
              const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(1) : '0.0';
              const isProfit = pnl >= 0;
              const isMF = h.type === 'mf';

              return (
                <View key={h.id} style={[styles.holdingCard, { borderLeftColor: h.color }]}>
                  <View style={styles.holdingHeader}>
                    <View style={[styles.dot, { backgroundColor: h.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.holdingName} numberOfLines={1}>
                        {isMF ? h.name : h.symbol}
                      </Text>
                      <Text style={styles.holdingSub} numberOfLines={1}>
                        {isMF ? h.symbol : h.name} · {h.allocation ?? (h.type === 'mf' ? 'Mutual Funds' : 'Equity')}
                      </Text>
                    </View>
                    <View style={[styles.plBadge, { backgroundColor: isProfit ? `${colors.success}15` : `${colors.error}15` }]}>
                      <Text style={[styles.plText, { color: isProfit ? colors.success : colors.error }]}>
                        {isProfit ? '+' : ''}{pnlPct}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricsRow}>
                    <View style={styles.metric}>
                      <Text style={styles.metricVal}>{formatCurrency(h.value)}</Text>
                      <Text style={styles.metricLbl}>Current Value</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricVal}>{formatCurrency(cost)}</Text>
                      <Text style={styles.metricLbl}>Cost Basis</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={[styles.metricVal, { color: isProfit ? colors.success : colors.error }]}>
                        {isProfit ? '+' : ''}{formatCurrency(pnl)}
                      </Text>
                      <Text style={styles.metricLbl}>P&amp;L</Text>
                    </View>
                  </View>

                  {/* Allocation bar */}
                  <View style={styles.allocBar}>
                    <View style={styles.allocBarBg}>
                      <View style={[styles.allocBarFill, { width: `${h.pct}%`, backgroundColor: h.color }]} />
                    </View>
                    <Text style={styles.allocPct}>{h.pct.toFixed(1)}% of portfolio</Text>
                  </View>

                  <View style={styles.holdingDetails}>
                    <Text style={styles.detailText}>
                      {isMF
                        ? `${h.quantity.toFixed(2)} Units · NAV ${formatCurrencyDetailed(h.currentPrice)} · Avg ${formatCurrencyDetailed(h.avgPrice)}`
                        : `${h.quantity} Shares · LTP ${formatCurrencyDetailed(h.currentPrice)} · Avg ${formatCurrencyDetailed(h.avgPrice)}`}
                    </Text>
                    {h.folio && <Text style={styles.detailFolio}>Folio: {h.folio}</Text>}
                  </View>
                </View>
              );
            })}
          </>
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
    height: 56,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 6, borderRadius: rounded.full },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  scroll: { padding: spacing.containerPadding, gap: 16, paddingBottom: 60 },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, color: colors.onSurfaceVariant },
  donutCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  donutSummary: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  donutCount: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
  donutSubText: { fontSize: 12, color: colors.onSurfaceVariant },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
    marginTop: 4,
  },
  holdingCard: {
    backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: 14,
    gap: 10,
  },
  holdingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  holdingName: { fontSize: 14, fontWeight: '700', color: colors.onSurface, flex: 1 },
  holdingSub: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 2 },
  plBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: rounded.full,
  },
  plText: { fontSize: 11, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', gap: 24 },
  metric: { gap: 2 },
  metricVal: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  metricLbl: { fontSize: 10, color: colors.onSurfaceVariant },
  allocBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  allocBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  allocBarFill: { height: 6, borderRadius: 3 },
  allocPct: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },
  holdingDetails: { gap: 2 },
  detailText: { fontSize: 10, color: colors.outline },
  detailFolio: { fontSize: 10, color: colors.outline, marginTop: 1 },
});
