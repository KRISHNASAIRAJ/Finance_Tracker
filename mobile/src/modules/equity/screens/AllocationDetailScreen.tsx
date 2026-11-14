/**
 * AllocationDetailScreen — donut chart breakdown of asset allocation by category
 * (Equity, MF, Gold, Realty, ETF) with per-holding drill-down.
 *
 * Restyled to the Meridian v2 reference (s29): a "PORTFOLIO" hero with the
 * donut and total P&L, then a section of per-holding cards with the value /
 * cost / P&L stat row, allocation bar and unit details. Tap a donut segment
 * to scroll to that holding. All logic is unchanged.
 */
import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { mc, mr } from '../../../shared/theme/meridian';
import { Card, EmptyState, Label, Screen, TopBar } from '../../../shared/components/meridian';
import { useInvestmentsStore, Holding, holdingValueOf, holdingDisplayName } from '../store';

const HOLDING_COLORS = [
  '#9BA5FF', '#59D6C7', '#FF887D', '#E2A45C', '#BCE85D',
  '#B3BBFF', '#74E0D4', '#FFA297', '#EDBB76', '#CCF070',
  '#7A84E0', '#3FBBAE', '#E06A60', '#D49A4E', '#A3CC40',
];

const formatCurrency = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatCurrencyDetailed = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export default function AllocationDetailScreen() {
  const navigation = useNavigation();
  const { holdings } = useInvestmentsStore();
  const scrollRef = useRef<any>(null);
  const holdingY = useRef<Record<string, number>>({});

  const holdingValues = holdings
    .map((h: Holding) => ({
      ...h,
      value: holdingValueOf(h),
    }))
    // Holdings worth nothing (sold out / zero qty / malformed) are not part
    // of the portfolio — they must not show up as slices or rows here.
    .filter((h: any) => h.value > 0);

  const totalValue = holdingValues.reduce((s: number, h: any) => s + h.value, 0);
  const totalCost = holdingValues.reduce((s: number, h: any) => s + h.quantity * h.avgPrice, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // Sort by value descending and assign colors
  const sorted = [...holdingValues]
    .sort((a: any, b: any) => b.value - a.value)
    .map((h: any, i: number) => ({
      ...h,
      pct: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
      color: HOLDING_COLORS[i % HOLDING_COLORS.length],
    }));

  const R = 58;
  const strokeW = 15;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * R;

  // Build segment angle spans (clockwise from 12 o'clock) for tap hit-testing
  const segments = sorted.reduce((acc: any[], h: any) => {
    const startDeg = acc.length > 0 ? acc[acc.length - 1].endDeg : 0;
    const sliceDeg = totalValue > 0 ? (h.value / totalValue) * 360 : 0;
    acc.push({ id: h.id, startDeg, endDeg: startDeg + sliceDeg });
    return acc;
  }, []);

  const scrollToHolding = (id: string) => {
    const y = holdingY.current[id];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  const handleSegmentTap = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    const dx = locationX - cx;
    const dy = locationY - cy;
    // Clockwise angle from 12 o'clock; SVG dashes start at 3 o'clock (+90°)
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;
    const hit = segments.find((s: any) => {
      const start = (s.startDeg + 90) % 360;
      const end = (s.endDeg + 90) % 360;
      if (start < end) return angle >= start && angle < end;
      return angle >= start || angle < end; // wraps past 360
    });
    if (hit) scrollToHolding(hit.id);
  };

  return (
    <Screen bottomInset={36} ref={scrollRef}>
      <TopBar title="Portfolio breakdown" onBack={() => navigation.goBack()} variant="left" />

      {sorted.length === 0 ? (
        <EmptyState
          icon="pie-chart-outline"
          title="No holdings to show"
          subtitle="Add holdings to see the breakdown"
        />
      ) : (
        <>
          {/* Hero — donut + portfolio summary */}
          <Card>
            <View style={styles.heroRow}>
              <View style={styles.donutWrap}>
                <Svg width={140} height={140} viewBox="0 0 140 140">
                  {sorted.map((h: any) => {
                    const sliceLen = totalValue > 0 ? (h.value / totalValue) * circumference : 0;
                    const dashArray = `${sliceLen} ${circumference - sliceLen}`;
                    const startDeg = segments.find((s: any) => s.id === h.id)?.startDeg ?? 0;
                    return (
                      <Circle
                        key={h.id}
                        cx={cx}
                        cy={cy}
                        r={R}
                        stroke={h.color}
                        strokeWidth={strokeW}
                        strokeDasharray={dashArray}
                        strokeDashoffset={-(startDeg / 360) * circumference}
                        fill="none"
                        strokeLinecap="butt"
                      />
                    );
                  })}
                  <SvgText x={cx} y={cy - 2} textAnchor="middle" fontSize={15} fontWeight="500" fill={mc.text}>
                    {formatCurrency(totalValue)}
                  </SvgText>
                  <SvgText x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill={mc.textDim}>
                    Total
                  </SvgText>
                </Svg>
                {/* Native transparent overlay — reliably catches every tap */}
                <TouchableOpacity
                  style={styles.donutTapOverlay}
                  activeOpacity={1}
                  onPress={handleSegmentTap}
                />
              </View>

              <View style={styles.heroRight}>
                <Label>PORTFOLIO</Label>
                <Text style={[styles.heroPnl, { color: totalPnl >= 0 ? mc.mint : mc.redSoft }]}>
                  {totalPnl >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totalPnl))}
                </Text>
                <Text style={styles.heroCaption}>
                  {sorted.length} {sorted.length === 1 ? 'holding' : 'holdings'} · {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%
                </Text>
              </View>
            </View>
          </Card>

          <Label style={styles.sectionLabel}>INDIVIDUAL HOLDINGS</Label>

          {sorted.map((h: any) => {
            const cost = h.quantity * h.avgPrice;
            const pnl = h.value - cost;
            const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(1) : '0.0';
            const isProfit = pnl >= 0;
            const isMF = h.type === 'mf';
            const isin = h.isin || h.symbol;
            const kind = h.allocation ?? (h.type === 'mf' ? 'Mutual fund' : h.type === 'etf' ? 'ETF' : 'Equity');
            const sipTag = isMF && (h.sipAmount || h.sipDay) ? ' · SIP' : '';

            return (
              <View
                key={h.id}
                style={styles.holdingCard}
                onLayout={(e) => { holdingY.current[h.id] = e.nativeEvent.layout.y; }}
              >
                  <View style={styles.holdingHeader}>
                    <View style={[styles.dot, { backgroundColor: h.color }]} />
                    <View style={styles.holdingTitleWrap}>
                      <Text style={styles.holdingName} numberOfLines={1}>
                        {isMF ? holdingDisplayName(h) : h.symbol}
                      </Text>
                      <Text style={styles.holdingSub} numberOfLines={1}>
                        {isin} · {kind}{sipTag}
                      </Text>
                    </View>
                    <View style={[styles.plPill, { backgroundColor: isProfit ? mc.mintDim : mc.redDim }]}>
                      <Text style={[styles.plPillText, { color: isProfit ? mc.mint : mc.redSoft }]}>
                        {isProfit ? '+' : ''}{pnlPct}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricsRow}>
                    <View style={styles.metric}>
                      <Text style={styles.metricVal}>{formatCurrency(h.value)}</Text>
                      <Text style={styles.metricLbl}>VALUE</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricVal}>{formatCurrency(cost)}</Text>
                      <Text style={styles.metricLbl}>COST</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={[styles.metricVal, { color: isProfit ? mc.mint : mc.redSoft }]}>
                        {isProfit ? '+' : ''}{formatCurrency(pnl)}
                      </Text>
                      <Text style={styles.metricLbl}>P&amp;L</Text>
                    </View>
                  </View>

                  <View style={styles.allocBarRow}>
                    <View style={styles.allocBarBg}>
                      <View style={[styles.allocBarFill, { width: `${Math.max(h.pct, 2)}%`, backgroundColor: h.color }]} />
                    </View>
                    <Text style={styles.allocPct}>{h.pct.toFixed(1)}% of portfolio</Text>
                  </View>

                  <Text style={styles.detailText}>
                    {isMF
                      ? `${h.quantity.toFixed(2)} units · NAV ${formatCurrencyDetailed(h.currentPrice)} · avg ${formatCurrencyDetailed(h.avgPrice)}`
                      : `${h.quantity} shares · LTP ${formatCurrencyDetailed(h.currentPrice)} · avg ${formatCurrencyDetailed(h.avgPrice)}`}
                  </Text>
                  {h.folio ? <Text style={styles.detailText}>Folio: {h.folio}</Text> : null}
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  donutWrap: {
    position: 'relative',
  },
  donutTapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 140,
    height: 140,
  },
  heroRight: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  heroPnl: {
    fontSize: 22,
    fontWeight: '500',
    marginTop: 2,
  },
  heroCaption: {
    fontSize: 12,
    color: mc.textDim,
  },
  sectionLabel: {
    paddingHorizontal: 4,
    marginTop: 2,
  },
  holdingCard: {
    backgroundColor: mc.card,
    borderRadius: mr.card,
    padding: 14,
    gap: 0,
  },
  holdingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  holdingTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  holdingName: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },
  holdingSub: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  plPill: {
    borderRadius: mr.badge,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  plPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metric: {
    flex: 1,
    gap: 2,
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },
  metricLbl: {
    fontSize: 10,
    letterSpacing: 1,
    color: mc.textDim,
  },
  allocBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  allocBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: mc.track,
    overflow: 'hidden',
  },
  allocBarFill: {
    height: 6,
    borderRadius: 3,
  },
  allocPct: {
    fontSize: 11,
    color: mc.textDim,
  },
  detailText: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
});
