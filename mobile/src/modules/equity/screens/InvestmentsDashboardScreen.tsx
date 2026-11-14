/**
 * InvestmentsDashboardScreen — the Wealth tab.
 *
 * Restyled to the Meridian v2 reference: a net-worth headline with a
 * portfolio trend, an allocation bar, holdings rows with sparklines, a goal
 * ring and a loan summary. Price refresh, the action plan, goals, loans,
 * fixed deposits and the AI recommendations button all still work.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  CountUp,
  IconTile,
  Label,
  LineChart,
  PressScale,
  ProgressBar,
  RangeChips,
  Ring,
  Rise,
  Screen,
  SegmentedControl,
  Sparkline,
  StackedShareBar,
  type ShareSegment,
} from '../../../shared/components/meridian';
import DrawerTrigger from '../../../shared/components/DrawerTrigger';
import DraggableFab from '../../../shared/components/DraggableFab';
import {
  useInvestmentsStore,
  allocationBuckets,
  allocationCategoryOf,
  holdingDisplayName,
  todayPnLSplit,
} from '../store';
import { useEquitySync, syncActionPlan } from '../hooks/useEquitySync';
import { useAuth } from '../../../services/AuthProvider';
import { processSyncQueue } from '../../../services/syncQueue';
import { supabase } from '../../../services/supabaseClient';

type NavigationProp = NativeStackNavigationProp<any>;

const ALLOCATION_COLORS: Record<string, string> = {
  'Mutual Funds': mc.violet,
  Equity: mc.red,
  ETF: mc.sky,
  Gold: mc.amber,
  Realty: mc.mint,
  Other: mc.textFaint,
};

export default function InvestmentsDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    holdings,
    goals,
    loans,
    fds,
    snapshots,
    getPortfolioValue,
    getTodayPnL,
    getTotalLoans,
    getTotalFDs,
    getNetWorth,
    portfolioActionPlan,
    setPortfolioActionPlan,
  } = useInvestmentsStore();
  const portfolioValue = getPortfolioValue();
  const todayPnL = getTodayPnL();
  const totalLoans = getTotalLoans();
  const totalFDs = getTotalFDs();
  const netWorth = getNetWorth();
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [activeTab, setActiveTab] = useState<'equity' | 'mf'>('equity');
  const [range, setRange] = useState('1M');
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

  const equityHoldings = holdings.filter((h) => allocationCategoryOf(h) === 'Equity');
  const mfHoldings = holdings.filter((h) => allocationCategoryOf(h) === 'Mutual Funds');
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

  // ---- Portfolio trend from the real daily snapshots ----
  const trendSeries = useMemo(() => {
    if (snapshots.length === 0) return [] as number[];
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const days = range === '1W' ? 7 : range === '1M' ? 30 : range === '3M' ? 90 : 365;
    const cutoff = Date.now() - days * 86400000;
    const filtered = sorted.filter((s) => new Date(s.date).getTime() >= cutoff);
    const picked = filtered.length > 1 ? filtered : sorted.slice(-2);
    return picked.map((s) => s.totalValue / 100);
  }, [snapshots, range]);

  // ---- Allocation ----
  const allocation = useMemo(() => {
    const buckets = allocationBuckets(holdings);
    const total = buckets.reduce((s, b) => s + b.value, 0);
    if (!Number.isFinite(total) || total === 0) return { total: 0, segments: [] as ShareSegment[], rows: [] as any[] };
    const rows = buckets.map((b) => ({
      category: b.category,
      value: b.value,
      pct: (b.value / total) * 100,
    }));
    const segments: ShareSegment[] = rows.map((r) => ({
      key: r.category,
      value: r.value,
      color: ALLOCATION_COLORS[r.category] ?? mc.textFaint,
      minWidth: 2,
    }));
    return { total, segments, rows };
  }, [holdings]);

  const handleRefreshPrices = async () => {
    setRefreshingPrices(true);
    try {
      await supabase.functions.invoke('refresh-portfolio-prices', { body: {} });
      if (user?.id) {
        await pullFromCloud();
      }

      // Day-change push — fire immediately after the cloud day-change update
      // so the user gets the move without waiting for the 8:30 PM snapshot.
      const store = useInvestmentsStore.getState();
      const dayPnL = store.getTodayPnL();
      const totalValue = store.getPortfolioValue();
      if (dayPnL !== 0) {
        const { scheduleImmediate } = await import('../../../services/notificationService');
        const lakhs = (totalValue / 10000000).toFixed(2);
        const changeStr = `₹${Math.abs(dayPnL / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        const pct = store.holdings.length > 0
          ? ((dayPnL / Math.max(1, totalValue - dayPnL)) * 100).toFixed(1)
          : '0.0';
        scheduleImmediate(
          '📈 Portfolio Day Change',
          `${dayPnL >= 0 ? 'Up' : 'Down'} ${changeStr} (${dayPnL >= 0 ? '+' : ''}${pct}%) · ₹${lakhs}L total`,
          'portfolio',
          { type: 'PORTFOLIO_REPORT', dedupKey: `daychange_${new Date().toISOString().slice(0, 13)}` },
        );
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

  const firstGoal = goals[0];
  const goalProgress = firstGoal && firstGoal.target > 0
    ? Math.min(1, firstGoal.current / firstGoal.target)
    : 0;
  const firstLoan = loans[0];

  return (
    <Screen bottomInset={120}>
      {/* Header */}
      <Rise index={0}>
        <View style={styles.header}>
          <DrawerTrigger />
          <Text style={styles.headerTitle}>Wealth</Text>
          <PressScale
            onPress={() => navigation.navigate('AIRecommendations')}
            scale={0.9}
            style={styles.aiButton}
            accessibilityLabel="AI recommendations"
          >
            <Ionicons name="sparkles" size={17} color={mc.redSoft} />
          </PressScale>
        </View>
      </Rise>

      {/* Net worth */}
      <Rise index={1}>
        <Card>
          <View style={styles.nwTopRow}>
            <Label>NET WEALTH</Label>
            <PressScale
              onPress={handleRefreshPrices}
              scale={0.9}
              style={styles.refreshBtn}
              accessibilityLabel="Refresh prices"
            >
              <Ionicons
                name={refreshingPrices ? 'sync' : 'refresh'}
                size={15}
                color={mc.textDim}
              />
            </PressScale>
          </View>
          <View style={styles.nwValueRow}>
            <CountUp
              value={netWorth / 100}
              format={(n) => `₹${Math.round(n).toLocaleString('en-IN')}`}
              style={styles.nwValue}
            />
            <View
              style={[
                styles.trendBadge,
                { backgroundColor: isPositive ? mc.mintDim : mc.redDim },
              ]}
            >
              <Ionicons
                name={isPositive ? 'trending-up' : 'trending-down'}
                size={11}
                color={isPositive ? mc.mint : mc.redSoft}
              />
              <Text style={[styles.trendText, { color: isPositive ? mc.mint : mc.redSoft }]}>
                {isPositive ? '+' : ''}
                {pnlPct}%
              </Text>
            </View>
          </View>

          {trendSeries.length > 1 ? (
            <>
              <LineChart
                data={trendSeries}
                width={280}
                height={84}
                color={mc.mint}
                area
                style={styles.nwChart}
              />
              <RangeChips
                options={['1W', '1M', '3M', '1Y']}
                value={range}
                onChange={setRange}
              />
            </>
          ) : null}

          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatCurrency(totalCost)}</Text>
              <Label small>INVESTED</Label>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: isPositive ? mc.mint : mc.redSoft }]}>
                {isPositive ? '+' : ''}
                {formatCurrency(totalPnL)}
              </Text>
              <Label small>RETURNS</Label>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: mc.redSoft }]}>
                {totalLoans > 0 ? '−' : ''}
                {formatCurrency(totalLoans)}
              </Text>
              <Label small>LOANS</Label>
            </View>
          </View>
        </Card>
      </Rise>

      {/* Allocation */}
      {allocation.total > 0 ? (
        <Rise index={2}>
          <PressScale onPress={() => navigation.navigate('AllocationDetail')} scale={0.99}>
            <Card>
              <View style={styles.rowBetween}>
                <Label>ALLOCATION</Label>
                <Text style={styles.rowValue}>{formatCurrency(allocation.total)}</Text>
              </View>
              <StackedShareBar
                segments={allocation.segments}
                height={14}
                style={styles.allocBar}
              />
              <View style={styles.allocLegend}>
                {allocation.rows.map((r) => (
                  <View key={r.category} style={styles.allocItem}>
                    <View
                      style={[
                        styles.allocDot,
                        { backgroundColor: ALLOCATION_COLORS[r.category] ?? mc.textFaint },
                      ]}
                    />
                    <Text style={styles.allocLabel} numberOfLines={1}>
                      {r.category} {r.pct.toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </PressScale>
        </Rise>
      ) : null}

      {/* Holdings */}
      <Rise index={3}>
        <Card>
          <View style={styles.rowBetween}>
            <Label>HOLDINGS · {holdings.length}</Label>
            <PressScale
              onPress={() => navigation.navigate('AddEditHolding', {})}
              scale={0.9}
              accessibilityLabel="Add holding"
            >
              <Ionicons name="add" size={18} color={mc.redSoft} />
            </PressScale>
          </View>

          <SegmentedControl
            options={[
              { key: 'equity', label: 'Equity' },
              { key: 'mf', label: 'Mutual Funds' },
            ]}
            value={activeTab}
            onChange={(k) => setActiveTab(k as 'equity' | 'mf')}
            style={styles.holdingsSegment}
          />

          {activeHoldings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={activeTab === 'equity' ? 'trending-up-outline' : 'wallet-outline'}
                size={28}
                color={mc.textGhost}
              />
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
              {previewHoldings.map((h, idx) => {
                const totalValue = h.quantity * h.currentPrice;
                const totalCostH = h.quantity * h.avgPrice;
                const profitLoss = totalValue - totalCostH;
                const plPercent = totalCostH > 0 ? ((profitLoss / totalCostH) * 100).toFixed(1) : '0.0';
                const isProfit = profitLoss >= 0;
                const isMF = h.type === 'mf';

                return (
                  <PressScale
                    key={h.id}
                    onPress={() => navigation.navigate('AddEditHolding', { holdingId: h.id })}
                    scale={0.99}
                    style={[styles.holdingRow, idx > 0 && styles.holdingDivider]}
                  >
                    <IconTile
                      icon={isMF ? 'wallet-outline' : 'trending-up-outline'}
                      color={isMF ? mc.violet : mc.redSoft}
                      background={isMF ? mc.violetDim : mc.redDim}
                      size={36}
                      radius={12}
                    />
                    <View style={styles.holdingMain}>
                      <Text style={styles.holdingTitle} numberOfLines={1}>
                        {isMF ? holdingDisplayName(h) : h.symbol}
                      </Text>
                      <Text style={styles.holdingSub} numberOfLines={1}>
                        {isMF
                          ? `${h.quantity.toFixed(2)} units · NAV ${formatCurrencyDetailed(h.currentPrice)}`
                          : `${h.quantity} share${h.quantity === 1 ? '' : 's'} · avg ${formatCurrencyDetailed(h.avgPrice)}`}
                      </Text>
                    </View>
                    <Sparkline
                      data={[h.avgPrice / 100, h.currentPrice / 100]}
                      width={48}
                      height={22}
                      color={isProfit ? mc.mint : mc.redSoft}
                    />
                    <View style={styles.holdingRight}>
                      <Text style={styles.holdingValue}>{formatCurrency(totalValue)}</Text>
                      <Text style={[styles.holdingPct, { color: isProfit ? mc.mint : mc.redSoft }]}>
                        {isProfit ? '+' : ''}
                        {plPercent}%
                      </Text>
                    </View>
                  </PressScale>
                );
              })}
              {hasMore ? (
                <PressScale
                  onPress={() => navigation.navigate('HoldingsList', { tab: activeTab })}
                  scale={0.97}
                  style={styles.viewAllBtn}
                >
                  <Text style={styles.viewAllText}>
                    View all {activeTab === 'equity' ? 'equity' : 'MF'} holdings ({activeHoldings.length})
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={mc.redSoft} />
                </PressScale>
              ) : null}
            </>
          )}
        </Card>
      </Rise>

      {/* Goal ring + loan summary */}
      <View style={styles.twoUp}>
        {firstGoal ? (
          <Rise index={4} style={styles.flexCell}>
            <PressScale
              onPress={() => navigation.navigate('AddEditGoal', { goalId: firstGoal.id })}
              scale={0.98}
            >
              <Card style={styles.goalCard}>
                <Ring progress={goalProgress} size={52} stroke={6} color={mc.amber}>
                  <Text style={styles.goalRingText}>{Math.round(goalProgress * 100)}%</Text>
                </Ring>
                <View style={styles.goalTextWrap}>
                  <Label small>GOAL</Label>
                  <Text style={styles.goalName} numberOfLines={1}>
                    {firstGoal.name}
                  </Text>
                  <Text style={styles.goalSub}>
                    {formatCurrency(firstGoal.current)} of {formatCurrency(firstGoal.target)}
                  </Text>
                </View>
              </Card>
            </PressScale>
          </Rise>
        ) : null}

        {firstLoan ? (
          <Rise index={5} style={styles.flexCell}>
            <PressScale onPress={() => navigation.navigate('LoansManager')} scale={0.98}>
              <Card style={styles.loanCard}>
                <Label small color={mc.redSoft}>LOAN · {firstLoan.name.toUpperCase()}</Label>
                <Text style={styles.loanAmount}>{formatCurrency(firstLoan.amount)}</Text>
                <Text style={styles.loanSub}>
                  {loans.length} loan{loans.length === 1 ? '' : 's'} ·{' '}
                  {formatCurrency(totalLoans)} total
                </Text>
              </Card>
            </PressScale>
          </Rise>
        ) : null}
      </View>

      {/* Investment goals */}
      <Rise index={6}>
        <Card>
          <View style={styles.rowBetween}>
            <Label>INVESTMENT GOALS</Label>
            <PressScale
              onPress={() => navigation.navigate('AddEditGoal', {})}
              scale={0.9}
              accessibilityLabel="Add goal"
            >
              <Ionicons name="add" size={18} color={mc.redSoft} />
            </PressScale>
          </View>
          {goals.length === 0 ? (
            <Text style={styles.emptySubtext}>No goals yet — add one to track your progress.</Text>
          ) : (
            goals.map((g) => {
              const progress = g.target > 0 ? Math.min(1, g.current / g.target) : 0;
              return (
                <PressScale
                  key={g.id}
                  onPress={() => navigation.navigate('AddEditGoal', { goalId: g.id })}
                  scale={0.99}
                  style={styles.goalRow}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.goalRowName} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={styles.goalPercent}>{Math.round(progress * 100)}%</Text>
                  </View>
                  <ProgressBar
                    value={progress}
                    color={mc.amber}
                    height={6}
                    style={styles.goalBar}
                  />
                  <View style={styles.rowBetween}>
                    <Text style={styles.goalDetail}>
                      {formatCurrency(g.current)} of {formatCurrency(g.target)}
                    </Text>
                    <Text style={styles.goalDetail}>Target: {new Date(g.dueDate).getFullYear()}</Text>
                  </View>
                </PressScale>
              );
            })
          )}
        </Card>
      </Rise>

      {/* Portfolio action plan */}
      <Rise index={7}>
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.planTitleRow}>
              <Ionicons name="document-text-outline" size={15} color={mc.violet} />
              <Label>PORTFOLIO ACTION PLAN</Label>
            </View>
            {!editPlan ? (
              <PressScale onPress={handleStartEditPlan} scale={0.9} accessibilityLabel="Edit plan">
                <Ionicons name="create-outline" size={16} color={mc.textDim} />
              </PressScale>
            ) : null}
          </View>
          {editPlan ? (
            <View style={styles.planEditContainer}>
              <TextInput
                style={styles.planInput}
                value={draftPlan}
                onChangeText={setDraftPlan}
                placeholder="Enter your action plan..."
                placeholderTextColor={mc.textFaint}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.planEditActions}>
                <PressScale onPress={handleCancelEditPlan} scale={0.95}>
                  <Text style={styles.planCancelText}>Cancel</Text>
                </PressScale>
                <PressScale onPress={handleSavePlan} scale={0.95}>
                  <Text style={styles.planSaveText}>Save</Text>
                </PressScale>
              </View>
            </View>
          ) : portfolioActionPlan ? (
            <Text style={styles.planContent} numberOfLines={12}>
              {portfolioActionPlan}
            </Text>
          ) : (
            <PressScale onPress={handleStartEditPlan} scale={0.98}>
              <View style={styles.planEmptyState}>
                <Ionicons name="add-circle-outline" size={18} color={mc.textDim} />
                <Text style={styles.planEmptyText}>Add your portfolio action plan</Text>
              </View>
            </PressScale>
          )}
        </Card>
      </Rise>

      {/* Loans */}
      {loans.length > 0 ? (
        <Rise index={8}>
          <Card>
            <View style={styles.rowBetween}>
              <View style={styles.planTitleRow}>
                <Ionicons name="wallet-outline" size={15} color={mc.redSoft} />
                <Label>LOANS · {formatCurrency(totalLoans)}</Label>
              </View>
              <PressScale
                onPress={() => navigation.navigate('LoansManager')}
                scale={0.9}
                accessibilityLabel="Manage loans"
              >
                <Ionicons name="add" size={18} color={mc.redSoft} />
              </PressScale>
            </View>
            {loans.map((l) => (
              <View key={l.id} style={styles.loanRow}>
                <View style={[styles.loanDot, { backgroundColor: mc.redSoft }]} />
                <Text style={styles.loanRowName} numberOfLines={1}>
                  {l.name}
                </Text>
                <Text style={styles.loanRowAmount}>−{formatCurrency(l.amount)}</Text>
              </View>
            ))}
          </Card>
        </Rise>
      ) : null}

      {/* Fixed deposits */}
      {fds.length > 0 ? (
        <Rise index={9}>
          <Card>
            <View style={styles.rowBetween}>
              <View style={styles.planTitleRow}>
                <Ionicons name="lock-closed-outline" size={15} color={mc.sky} />
                <Label>FIXED DEPOSITS · {formatCurrency(totalFDs)}</Label>
              </View>
              <PressScale
                onPress={() => navigation.navigate('LoansManager')}
                scale={0.9}
                accessibilityLabel="Manage fixed deposits"
              >
                <Ionicons name="add" size={18} color={mc.redSoft} />
              </PressScale>
            </View>
            {fds.map((f) => (
              <View key={f.id} style={styles.loanRow}>
                <View style={[styles.loanDot, { backgroundColor: mc.sky }]} />
                <Text style={styles.loanRowName} numberOfLines={1}>
                  {f.name}
                </Text>
                <Text style={[styles.loanRowAmount, { color: mc.mint }]}>
                  +{formatCurrency(f.amount)}
                </Text>
              </View>
            ))}
          </Card>
        </Rise>
      ) : null}

      {/* Floating AI Button — draggable */}
      <DraggableFab
        icon="sparkles"
        color={mc.white}
        storageKey="meridian-fab-wealth"
        onPress={() => navigation.navigate('AIRecommendations')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
  },
  headerTitle: {
    flex: 1,
    fontSize: 26,
    fontWeight: '500',
    color: mc.text,
  },
  aiButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.redDim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nwTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: mc.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nwValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  nwValue: {
    fontSize: 36,
    fontWeight: '500',
    color: mc.text,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nwChart: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  statRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
    marginTop: 12,
    paddingTop: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
    marginBottom: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: mc.line,
    marginVertical: 2,
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 12,
    color: mc.textDim,
  },
  allocBar: {
    marginVertical: 12,
  },
  allocLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  allocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allocDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  allocLabel: {
    fontSize: 13,
    color: mc.text,
  },

  holdingsSegment: {
    marginVertical: 12,
  },
  holdingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  holdingDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  holdingMain: {
    flex: 1,
    minWidth: 0,
  },
  holdingTitle: {
    fontSize: 15,
    color: mc.text,
  },
  holdingSub: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  holdingRight: {
    alignItems: 'flex-end',
    width: 66,
  },
  holdingValue: {
    fontSize: 15,
    color: mc.text,
  },
  holdingPct: {
    fontSize: 11,
    marginTop: 2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  viewAllText: {
    fontSize: 12,
    color: mc.redSoft,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  emptyText: {
    fontSize: 14,
    color: mc.textDim,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: mc.textFaint,
    marginTop: 4,
  },

  twoUp: {
    flexDirection: 'row',
    gap: 10,
  },
  flexCell: {
    flex: 1,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalRingText: {
    fontSize: 11,
    fontWeight: '600',
    color: mc.text,
  },
  goalTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  goalName: {
    fontSize: 14,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  goalSub: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  loanCard: {
    justifyContent: 'center',
    minHeight: 84,
  },
  loanAmount: {
    fontSize: 18,
    fontWeight: '500',
    color: mc.text,
    marginVertical: 4,
  },
  loanSub: {
    fontSize: 11,
    color: mc.textDim,
  },

  goalRow: {
    marginTop: 12,
    backgroundColor: 'transparent',
  },
  goalRowName: {
    fontSize: 14,
    color: mc.text,
    flex: 1,
    marginRight: 8,
  },
  goalPercent: {
    fontSize: 13,
    color: mc.amber,
    fontWeight: '600',
  },
  goalBar: {
    marginVertical: 6,
  },
  goalDetail: {
    fontSize: 11,
    color: mc.textDim,
  },

  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planEditContainer: {
    marginTop: 10,
    gap: 10,
  },
  planInput: {
    backgroundColor: mc.raised,
    borderRadius: 14,
    padding: 12,
    color: mc.text,
    fontSize: 14,
    minHeight: 120,
    maxHeight: 220,
  },
  planEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  planCancelText: {
    fontSize: 14,
    color: mc.textDim,
  },
  planSaveText: {
    fontSize: 14,
    color: mc.redSoft,
    fontWeight: '600',
  },
  planContent: {
    fontSize: 13,
    color: mc.text,
    lineHeight: 20,
    marginTop: 10,
  },
  planEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  planEmptyText: {
    fontSize: 13,
    color: mc.textDim,
  },

  loanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  loanDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loanRowName: {
    flex: 1,
    fontSize: 14,
    color: mc.text,
  },
  loanRowAmount: {
    fontSize: 14,
    color: mc.redSoft,
    fontWeight: '500',
  },
});
