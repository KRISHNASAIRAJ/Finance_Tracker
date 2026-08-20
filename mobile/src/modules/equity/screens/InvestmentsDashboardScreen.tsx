/**
 * InvestmentsDashboardScreen — wealth tab root. Holdings overview, allocation donut,
 * Kite sync status, rapid-add, and AI recommendations entry.
 */
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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G as SvgG, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore } from '../store';
import { InvestmentsStackParamList } from '../../../navigation/RootNavigator';
import { useEquitySync, syncActionPlan } from '../hooks/useEquitySync';
import { processSyncQueue } from '../../../services/syncQueue';
import { useAuth } from '../../../services/AuthProvider';
import { supabase } from '../../../services/supabaseClient';
import DraggableFab from '../../../shared/components/DraggableFab';

type NavigationProp = NativeStackNavigationProp<InvestmentsStackParamList, 'InvestmentsDashboard'>;

export default function InvestmentsDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { holdings, goals, getPortfolioValue, getTodayPnL, snapshots, portfolioActionPlan, setPortfolioActionPlan } = useInvestmentsStore();
  const portfolioValue = getPortfolioValue();
  const todayPnL = getTodayPnL();
  const [refreshingPrices, setRefreshingPrices] = useState(false);
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

  const handleRefreshPrices = async () => {
    setRefreshingPrices(true);
    try {
      await supabase.functions.invoke('refresh-portfolio-prices', { body: {} });
      if (user?.id) {
        await pullFromCloud();
      }
    } catch (e) {
      console.warn('[Investments] refresh prices failed:', e);
    }
    setRefreshingPrices(false);
  };

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
        {/* Portfolio Value Hero — Glass Noir panel, tappable → history */}
        <TouchableOpacity
          style={styles.heroCard}
          onPress={() => navigation.navigate('PortfolioHistory')}
          activeOpacity={0.9}
        >
          <View style={styles.heroGlow} />
          <View style={styles.heroTopRow}>
            <Text style={styles.heroLabel}>TOTAL PORTFOLIO VALUE</Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={(e) => { e.stopPropagation(); handleRefreshPrices(); }}
              disabled={refreshingPrices}
              activeOpacity={0.7}
            >
              <Ionicons
                name={refreshingPrices ? 'sync' : 'refresh'}
                size={16}
                color={colors.onSurface}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{formatCurrency(portfolioValue)}</Text>
            <View style={styles.trendBadge}>
              <Ionicons name={isPositive ? 'trending-up' : 'trending-down'} size={12} color={isPositive ? colors.success : colors.error} />
              <Text style={[styles.trendText, { color: isPositive ? colors.success : colors.error }]}>
                {isPositive ? '+' : ''}{pnlPct}%
              </Text>
            </View>
          </View>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaValue}>{holdings.length}</Text>
              <Text style={styles.heroMetaLabel}>Holdings</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaValue}>{formatCurrency(totalCost)}</Text>
              <Text style={styles.heroMetaLabel}>Invested</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={[styles.heroMetaValue, { color: isPositive ? colors.success : colors.error }]}>
                {isPositive ? '+' : ''}{formatCurrency(totalPnL)}
              </Text>
              <Text style={styles.heroMetaLabel}>Returns</Text>
            </View>
          </View>

          {/* Snapshot info inside the hero — computed live from holdings */}
          {holdings.some((h) => h.prevClose) && (() => {
            const yesterdayClose = portfolioValue - todayPnL;
            const dayChgPct = yesterdayClose > 0 ? (todayPnL / yesterdayClose) * 100 : 0;
            return (
              <View style={styles.heroSnapshotRow}>
                <View style={styles.heroSnapshotItem}>
                  <Text style={styles.heroSnapshotLabel}>YESTERDAY'S CLOSE</Text>
                  <Text style={styles.heroSnapshotValue}>
                    {formatCurrency(yesterdayClose)}
                  </Text>
                </View>
                <View style={styles.heroSnapshotDivider} />
                <View style={styles.heroSnapshotItem}>
                  <Text style={styles.heroSnapshotLabel}>DAY CHANGE</Text>
                  <Text style={[styles.heroSnapshotValue, { color: todayPnL >= 0 ? colors.success : colors.error }]}>
                    {todayPnL >= 0 ? '+' : ''}{formatCurrency(todayPnL)} ({dayChgPct.toFixed(1)}%)
                  </Text>
                </View>
              </View>
            );
          })()}
        </TouchableOpacity>

        {/* Allocation Donut — segmented gradient design */}
        {holdings.length > 0 && (() => {
          const allocMap: Record<string, number> = {};
          holdings.forEach((h) => {
            const cat = h.allocation ?? ((h.type === 'mf') ? 'Mutual Funds' : (h.type === 'etf') ? 'ETF' : 'Equity');
            allocMap[cat] = (allocMap[cat] || 0) + h.quantity * h.currentPrice;
          });

          const entries = Object.entries(allocMap).sort((a, b) => b[1] - a[1]);
          const totalV = entries.reduce((s, e) => s + e[1], 0);
          if (totalV === 0) return null;

          const R = 40;
          const strokeW = 8;
          const cx = 50;
          const cy = 50;
          const circumference = 2 * Math.PI * R;
          const gap = 2.5;
          const gradients = ['url(#allocGradPink)', 'url(#allocGradTeal)', 'url(#allocGradOrange)'];
          let cumulativeDeg = 0;

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
              <View style={styles.donutCenterWrap}>
                <Svg width={192} height={192} viewBox="0 0 100 100">
                  <Defs>
                    <LinearGradient id="allocGradPink" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#ffb2b9" />
                      <Stop offset="100%" stopColor="#d0bcff" />
                    </LinearGradient>
                    <LinearGradient id="allocGradTeal" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#5ee6ff" />
                      <Stop offset="100%" stopColor="#00cbe6" />
                    </LinearGradient>
                    <LinearGradient id="allocGradOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#ea6479" />
                      <Stop offset="100%" stopColor="#ffdadc" />
                    </LinearGradient>
                  </Defs>

                  {/* Background track */}
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={R}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={strokeW}
                    fill="none"
                  />

                  {entries.map(([cat, val]) => {
                    const pct = val / totalV;
                    const segLen = Math.max(pct * circumference - gap, 0.8);
                    const deg = cumulativeDeg;
                    cumulativeDeg += pct * 360;
                    const idx = entries.findIndex((e) => e[0] === cat);
                    return (
                      <SvgG key={cat} rotation={deg} origin={`${cx}, ${cy}`}>
                        <Circle
                          cx={cx}
                          cy={cy}
                          r={R}
                          stroke={gradients[idx % gradients.length]}
                          strokeWidth={strokeW}
                          strokeDasharray={`${segLen} ${circumference - segLen}`}
                          strokeDashoffset={circumference * 0.25}
                          fill="none"
                          strokeLinecap="round"
                        />
                      </SvgG>
                    );
                  })}
                </Svg>
                <View style={styles.donutCenterAbs}>
                  <Text style={styles.donutCenterVal}>{((entries[0][1] / totalV) * 100).toFixed(0)}%</Text>
                  <Text style={styles.donutCenterLabel}>{entries[0][0].toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.donutLegend}>
                {entries.map(([cat, val], i) => {
                  const pct = ((val / totalV) * 100).toFixed(1);
                  return (
                    <View key={cat} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: gradients[i % gradients.length] === 'url(#allocGradPink)' ? '#ffb2b9' : gradients[i % gradients.length] === 'url(#allocGradTeal)' ? '#5ee6ff' : '#ea6479' }]} />
                      <Text style={styles.legendLabel} numberOfLines={1}>{cat}</Text>
                      <Text style={styles.legendPct}>{pct}%</Text>
                    </View>
                  );
                })}
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

      </ScrollView>

      {/* Floating AI Button — draggable */}
      <DraggableFab
        icon="sparkles"
        color={colors.onSurface}
        storageKey="meridian-fab-wealth"
        onPress={() => navigation.navigate('AIRecommendations')}
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
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 100,
  },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 32,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    gap: 6,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  heroMetaItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  heroMetaDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroMetaValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    flexShrink: 1,
  },
  heroMetaLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  heroSnapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  heroSnapshotItem: {
    flex: 1,
  },
  heroSnapshotDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroSnapshotLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  heroSnapshotValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 3,
  },
  donutCard: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(155,165,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.xl,
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
  donutCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  donutCenterAbs: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterVal: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -1,
  },
  donutCenterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  donutLegend: {
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
    borderRadius: rounded.xl,
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
    borderColor: 'rgba(155,165,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.xl,
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rounded.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
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
  planCard: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(155,165,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.xl,
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
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: rounded.DEFAULT,
    padding: 12,
    color: colors.onSurface,
    fontSize: 12,
    lineHeight: 18,
    minHeight: 300,
    maxHeight: 400,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: colors.primary,
  },
  planSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.background,
  },
});
