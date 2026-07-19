import React, { useState } from 'react';
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
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore } from '../store';
import { InvestmentsStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<InvestmentsStackParamList, 'InvestmentsDashboard'>;

export default function InvestmentsDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { holdings, goals, getPortfolioValue, snapshots } = useInvestmentsStore();
  const portfolioValue = getPortfolioValue();
  const [activeTab, setActiveTab] = useState<'equity' | 'mf'>('equity');

  const equityHoldings = holdings.filter(
    (h) => h.type === 'equity' && h.allocation !== 'Gold' && h.allocation !== 'Realty',
  );
  const mfHoldings = holdings.filter((h) => h.type === 'mf');
  const activeHoldings = activeTab === 'equity' ? equityHoldings : mfHoldings;
  const previewHoldings = activeHoldings.slice(0, 3);
  const hasMore = activeHoldings.length > 3;

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

  const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.avgPrice, 0);
  const totalPnL = portfolioValue - totalCost;
  const pnlPct = totalCost > 0 ? ((totalPnL / totalCost) * 100).toFixed(1) : '0.0';
  const isPositive = totalPnL >= 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Portfolio Value Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>PORTFOLIO VALUE</Text>
          <Text style={styles.heroValue}>{formatCurrency(portfolioValue)}</Text>
          <View style={styles.heroSubRow}>
            <View style={[styles.trendBadge, { backgroundColor: isPositive ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)' }]}>
              <Ionicons name={isPositive ? 'trending-up' : 'trending-down'} size={12} color={isPositive ? colors.success : colors.error} />
              <Text style={[styles.trendText, { color: isPositive ? colors.success : colors.error }]}>
                {isPositive ? '+' : ''}{pnlPct}% P&amp;L
              </Text>
            </View>
            <Text style={styles.heroSubText}>All-time unrealized gains</Text>
          </View>
        </View>

        {/* Snapshot Summary */}
        {snapshots.length > 0 && (() => {
          const latest = snapshots[snapshots.length - 1];
          const dayChg = latest.dayChange;
          const dayChgPct = latest.dayChangePct.toFixed(1);
          return (
            <TouchableOpacity
              style={styles.snapshotCard}
              onPress={() => navigation.navigate('PortfolioHistory')}
              activeOpacity={0.7}
            >
              <View style={styles.snapshotRow}>
                <View style={styles.snapshotItem}>
                  <Text style={styles.snapshotLabel}>YESTERDAY'S CLOSE</Text>
                  <Text style={styles.snapshotValue}>
                    {formatCurrency(latest.totalValue - dayChg)}
                  </Text>
                </View>
                <View style={styles.snapshotDivider} />
                <View style={styles.snapshotItem}>
                  <Text style={styles.snapshotLabel}>DAY CHANGE</Text>
                  <Text style={[styles.snapshotValue, { color: dayChg >= 0 ? colors.success : colors.error }]}>
                    {dayChg >= 0 ? '+' : ''}{formatCurrency(dayChg)} ({dayChgPct}%)
                  </Text>
                </View>
              </View>
              <View style={styles.snapshotFooter}>
                <Text style={styles.snapshotDate}>
                  Last snapshot: {new Date(latest.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* Allocation Donut */}
        {holdings.length > 0 && (() => {
          const CAT_COLORS: Record<string, string> = {
            Equity: '#60a5fa',
            'Mutual Funds': '#a78bfa',
            Gold: '#fbbf24',
            Realty: '#34d399',
            ETF: '#f472b6',
            Other: '#94a3b8',
          };

          const allocMap: Record<string, number> = {};
          holdings.forEach((h) => {
            const cat = h.allocation ?? ((h.type === 'mf') ? 'Mutual Funds' : (h.type === 'etf') ? 'ETF' : 'Equity');
            allocMap[cat] = (allocMap[cat] || 0) + h.quantity * h.currentPrice;
          });

          const entries = Object.entries(allocMap).sort((a, b) => b[1] - a[1]);
          const totalV = entries.reduce((s, e) => s + e[1], 0);
          if (totalV === 0) return null;

          const R = 70;
          const strokeW = 18;
          const cx = 90;
          const cy = 90;
          const circumference = 2 * Math.PI * R;
          let offset = 0;

          return (
            <TouchableOpacity
              style={styles.donutCard}
              onPress={() => navigation.navigate('AllocationDetail')}
              activeOpacity={0.8}
            >
              <View style={styles.donutHeaderRow}>
                <Text style={styles.donutTitle}>ASSET ALLOCATION</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </View>
              <View style={styles.donutRow}>
                <Svg width={180} height={180} viewBox="0 0 180 180">
                  {entries.map(([cat, val]) => {
                    const sliceLen = (val / totalV) * circumference;
                    const dashArray = `${sliceLen} ${circumference - sliceLen}`;
                    const color = CAT_COLORS[cat] ?? CAT_COLORS.Other;
                    const segment = (
                      <Circle
                        key={cat}
                        cx={cx}
                        cy={cy}
                        r={R}
                        stroke={color}
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
                    {formatCurrency(totalV)}
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
                <View style={styles.donutLegend}>
                  {entries.map(([cat, val]) => {
                    const pct = ((val / totalV) * 100).toFixed(1);
                    return (
                      <View key={cat} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: CAT_COLORS[cat] ?? CAT_COLORS.Other }]} />
                        <Text style={styles.legendLabel} numberOfLines={1}>{cat}</Text>
                        <Text style={styles.legendPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* Holdings List Section */}
        <View style={styles.sectionCard}>
          {/* Segmented Tab Control */}
          <View style={styles.segmentedRow}>
            <TouchableOpacity
              style={[styles.segmentedBtn, activeTab === 'equity' && styles.segmentedBtnActive]}
              onPress={() => setActiveTab('equity')}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentedText, activeTab === 'equity' && styles.segmentedTextActive]}>
                Equity
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentedBtn, activeTab === 'mf' && styles.segmentedBtnActive]}
              onPress={() => setActiveTab('mf')}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentedText, activeTab === 'mf' && styles.segmentedTextActive]}>
                Mutual Funds
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeTab === 'equity' ? 'EQUITY HOLDINGS' : 'MUTUAL FUNDS'}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('AddEditHolding', {})}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {activeHoldings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name={activeTab === 'equity' ? 'trending-up-outline' : 'wallet-outline'} size={32} color={colors.outline} />
              <Text style={styles.emptyText}>
                No {activeTab === 'equity' ? 'equity' : 'mutual fund'} holdings yet
              </Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'equity'
                  ? 'Add stocks or sync from Kite'
                  : 'Add mutual funds or sync from Zerodha Coin'}
              </Text>
            </View>
          ) : (
            <>
            <View style={styles.holdingsList}>
              {previewHoldings.map((h) => {
                const totalValue = h.quantity * h.currentPrice;
                const totalCost = h.quantity * h.avgPrice;
                const profitLoss = totalValue - totalCost;
                const plPercent = ((profitLoss / totalCost) * 100).toFixed(1);
                const isProfit = profitLoss >= 0;
                const isMF = h.type === 'mf';

                return (
                  <TouchableOpacity
                    key={h.id}
                    style={styles.holdingRow}
                    onPress={() => navigation.navigate('AddEditHolding', { holdingId: h.id })}
                  >
                    <View style={styles.holdingLeft}>
                      {isMF ? (
                        <>
                          <View style={styles.holdingTitleRow}>
                            <Text style={styles.holdingSymbol} numberOfLines={1}>{h.name}</Text>
                          </View>
                          <Text style={styles.mfSchemeCode}>{h.symbol}</Text>
                          <Text style={styles.holdingQuantity}>
                            {h.quantity.toFixed(2)} Units · NAV {formatCurrencyDetailed(h.currentPrice)}
                          </Text>
                          {h.folio ? (
                            <Text style={styles.holdingFolio}>Folio: {h.folio}</Text>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <View style={styles.holdingTitleRow}>
                            <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                          </View>
                          <Text style={styles.holdingName}>{h.name}</Text>
                          <Text style={styles.holdingQuantity}>
                            {h.quantity} Shares · Avg {formatCurrencyDetailed(h.avgPrice)}
                          </Text>
                        </>
                      )}
                    </View>
                    <View style={styles.holdingRight}>
                      <Text style={styles.holdingValue}>{formatCurrency(totalValue)}</Text>
                      <View style={[styles.plBadge, { backgroundColor: isProfit ? `${colors.success}15` : `${colors.error}15` }]}>
                        <Text style={[styles.plText, { color: isProfit ? colors.success : colors.error }]}>
                          {isProfit ? '+' : ''}
                          {plPercent}%
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {hasMore && (
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => navigation.navigate('HoldingsList', { tab: activeTab })}
              >
                <Text style={styles.viewAllText}>View All {activeTab === 'equity' ? 'Equity' : 'MF'} Holdings ({activeHoldings.length})</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
            </>
          )}
        </View>

        {/* Investment Goals Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>INVESTMENT GOALS</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AddEditGoal', {})}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.goalsList}>
            {goals.map((g) => {
              const progress = g.current / g.target;
              const percentText = `${Math.round(progress * 100)}%`;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={styles.goalRow}
                  onPress={() => navigation.navigate('AddEditGoal', { goalId: g.id })}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.goalName}>{g.name}</Text>
                    <Text style={styles.goalPercent}>{percentText}</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.goalProgressDetails}>
                      {formatCurrency(g.current)} of {formatCurrency(g.target)}
                    </Text>
                    <Text style={styles.goalProgressDetails}>
                      Target: {new Date(g.dueDate).getFullYear()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* AI Recommendations Action Card */}
        <TouchableOpacity
          style={styles.aiBanner}
          onPress={() => navigation.navigate('AIRecommendations')}
          activeOpacity={0.9}
        >
          <View style={styles.aiLeft}>
            <Ionicons name="sparkles" size={22} color={colors.primary} />
            <View>
              <Text style={styles.aiTitle}>AI Rebalancing Recommendations</Text>
              <Text style={styles.aiSubtitle}>Review allocation suggestions based on goals</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
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
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 100,
  },
  heroCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.onSurface,
  },
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rounded.full,
  },
  trendText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '700',
  },
  heroSubText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  snapshotCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    gap: 12,
  },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  snapshotItem: {
    flex: 1,
  },
  snapshotDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  snapshotLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  snapshotValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    marginTop: 4,
  },
  snapshotFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  snapshotDate: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  donutCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    gap: 14,
  },
  donutTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  donutHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  donutLegend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.onSurface,
  },
  legendPct: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${colors.primaryContainer}15`,
    borderColor: `${colors.primaryContainer}40`,
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 16,
  },
  aiLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  aiSubtitle: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  goalsList: {
    gap: 16,
  },
  goalRow: {
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  goalPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: rounded.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primaryContainer,
    borderRadius: rounded.full,
  },
  goalProgressDetails: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  holdingsList: {
    gap: 12,
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  holdingLeft: {
    gap: 3,
    flex: 1,
  },
  holdingSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  holdingName: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  holdingQuantity: {
    fontSize: 11,
    color: colors.outline,
    marginTop: 2,
  },
  holdingRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  holdingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  plBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: rounded.full,
  },
  plText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rounded.DEFAULT,
    padding: 3,
    gap: 3,
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: rounded.sm,
  },
  segmentedBtnActive: {
    backgroundColor: `${colors.primary}25`,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  segmentedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.outline,
  },
  segmentedTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  holdingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amcBadge: {
    backgroundColor: `${colors.tertiary}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: rounded.sm,
  },
  amcBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.tertiary,
  },
  holdingFolio: {
    fontSize: 10,
    color: colors.outline,
    marginTop: 1,
  },
  mfSchemeCode: {
    fontSize: 11,
    color: colors.outline,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.outline,
    textAlign: 'center',
  },
  viewAllBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
