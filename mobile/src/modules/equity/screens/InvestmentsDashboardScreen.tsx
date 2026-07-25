import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore } from '../store';
import { InvestmentsStackParamList } from '../../../navigation/RootNavigator';
import { useEquitySync, syncActionPlan } from '../hooks/useEquitySync';
import { processSyncQueue } from '../../../services/syncQueue';
import { useAuth } from '../../../services/AuthProvider';

type NavigationProp = NativeStackNavigationProp<InvestmentsStackParamList, 'InvestmentsDashboard'>;

export default function InvestmentsDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { holdings, goals, getPortfolioValue, snapshots, portfolioActionPlan, setPortfolioActionPlan } = useInvestmentsStore();
  const portfolioValue = getPortfolioValue();
  const [activeTab, setActiveTab] = useState<'equity' | 'mf'>('equity');
  const { pullFromCloud } = useEquitySync();
  const { user } = useAuth();
  const [editPlan, setEditPlan] = useState(false);
  const [draftPlan, setDraftPlan] = useState('');

  useFocusEffect(
    useCallback(() => {
      pullFromCloud();
      processSyncQueue().catch((e: Error) => console.warn('[Investments] syncQueue flush failed:', e));
    }, [pullFromCloud])
  );

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

  const handleStartEditPlan = () => {
    setDraftPlan(portfolioActionPlan || '');
    setEditPlan(true);
  };

  const handleSavePlan = async () => {
    setPortfolioActionPlan(draftPlan);
    setEditPlan(false);
    if (user?.id) {
      syncActionPlan(user.id, draftPlan).catch(() => {});
    }
  };

  const handleCancelEditPlan = () => {
    setEditPlan(false);
    setDraftPlan('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Portfolio Value Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>PORTFOLIO VALUE</Text>
          <Text style={styles.heroValue}>{formatCurrency(portfolioValue)}</Text>
          <View style={styles.heroSubRow}>
            <View style={[styles.trendBadge, { backgroundColor: isPositive ? colors.successContainer : colors.errorContainer }]}> 
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
            Equity: '#9BA5FF',
            'Mutual Funds': '#8894A8',
            Gold: '#E2A45C',
            Realty: '#59D6C7',
            ETF: '#FF887D',
            Other: '#8894A8',
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

        {/* Portfolio Action Plan */}
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View style={styles.planTitleRow}>
              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              <Text style={styles.planTitle}>PORTFOLIO ACTION PLAN</Text>
            </View>
            {!editPlan ? (
              <TouchableOpacity onPress={handleStartEditPlan} style={styles.planEditBtn}>
                <Ionicons name="create-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
          </View>
          {editPlan ? (
            <View style={styles.planEditContainer}>
              <TextInput
                style={styles.planInput}
                value={draftPlan}
                onChangeText={setDraftPlan}
                placeholder="Enter your action plan..."
                placeholderTextColor={colors.onSurfaceVariant}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.planEditActions}>
                <TouchableOpacity style={styles.planCancelBtn} onPress={handleCancelEditPlan}>
                  <Text style={styles.planCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.planSaveBtn} onPress={handleSavePlan}>
                  <Text style={styles.planSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : portfolioActionPlan ? (
            <Text style={styles.planContent} numberOfLines={12}>{portfolioActionPlan}</Text>
          ) : (
            <TouchableOpacity onPress={handleStartEditPlan} style={styles.planEmptyState}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.planEmptyText}>Add your portfolio action plan</Text>
            </TouchableOpacity>
          )}
        </View>

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

      </ScrollView>

      {/* Floating AI Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AIRecommendations')}
        activeOpacity={0.85}
      >
        <Ionicons name="sparkles" size={24} color={colors.onPrimaryContainer} />
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
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 100,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: colors.successContainer,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: colors.actionDim,
    borderColor: colors.actionStrong,
    borderWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: colors.surface,
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
    borderBottomColor: colors.border,
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
    backgroundColor: colors.surface,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderTopColor: colors.border,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    gap: 10,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  planEditBtn: {
    padding: 4,
    borderRadius: rounded.full,
  },
  planContent: {
    fontSize: 12,
    color: colors.onSurface,
    lineHeight: 18,
  },
  planEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  planEmptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  planEditContainer: {
    gap: 10,
  },
  planInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    color: colors.onSurface,
    fontSize: 12,
    lineHeight: 18,
    minHeight: 300,
    maxHeight: 400,
  },
  planEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  planCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  planCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  planSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: rounded.DEFAULT,
    backgroundColor: colors.primaryContainer,
  },
  planSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  fab: {
    position: 'absolute',
    bottom: 96,
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
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
