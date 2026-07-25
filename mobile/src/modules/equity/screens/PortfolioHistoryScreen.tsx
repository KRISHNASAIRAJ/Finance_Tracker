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
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { deleteCloudSnapshot } from '../hooks/useEquitySync';

const formatCurrency = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function PortfolioHistoryScreen() {
  const navigation = useNavigation();
  const { snapshots, deleteSnapshot } = useInvestmentsStore();
  const { user } = useAuth();
  const [showAllDates, setShowAllDates] = useState(false);

  const handleDeleteSnapshot = (date: string) => {
    Alert.alert(
      'Delete Snapshot',
      `Remove snapshot from ${new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            deleteSnapshot(date);
            if (user?.id) {
              deleteCloudSnapshot(user.id, date).catch((e: Error) =>
                console.warn('[PortfolioHistory] delete snapshot:', e)
              );
            }
          },
        },
      ],
    );
  };

  if (snapshots.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.logoText}>Portfolio History</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color={colors.outline} />
          <Text style={styles.emptyText}>No snapshots yet</Text>
          <Text style={styles.emptySub}>Daily snapshots are saved at 8:30 PM IST</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const latest = sorted[0];
  const prev = sorted.length > 1 ? sorted[1] : null;
  const dayChange = prev ? latest.totalValue - prev.totalValue : 0;
  const dayChangePct = prev ? ((dayChange / prev.totalValue) * 100).toFixed(1) : '0.0';
  const chartData = [...snapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const CHART_W = 320;
  const CHART_H = 140;
  const padX = 20;
  const padY = 25;

  const maxVal = Math.max(...chartData.map((s) => s.totalValue));
  const minVal = Math.min(...chartData.map((s) => s.totalValue));
  const range = maxVal === minVal ? 1 : maxVal - minVal;
  const norm = (v: number) => (v - minVal) / range;

  const points = chartData.map((s, i) => {
    const x = padX + (i / Math.max(chartData.length - 1, 1)) * (CHART_W - 2 * padX);
    const y = CHART_H - padY - norm(s.totalValue) * (CHART_H - 2 * padY);
    return { x, y, label: s.date };
  });

  let pathD = '';
  let fillD = '';
  if (points.length > 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const cpX1 = points[i].x + (points[i + 1].x - points[i].x) / 2;
      const cpX2 = points[i].x + (points[i + 1].x - points[i].x) / 2;
      pathD += ` C ${cpX1} ${points[i].y}, ${cpX2} ${points[i + 1].y}, ${points[i + 1].x} ${points[i + 1].y}`;
    }
    fillD = `${pathD} L ${points[points.length - 1].x} ${CHART_H - padY} L ${points[0].x} ${CHART_H - padY} Z`;
  }

  const [selectedIndex, setSelectedIndex] = useState(points.length - 1);

  const ALLOC_COLORS: Record<string, string> = {
    Equity: '#9BA5FF',
    'Mutual Funds': '#8894A8',
    Gold: '#E2A45C',
    Realty: '#59D6C7',
    ETF: '#FF887D',
    Other: '#8894A8',
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Portfolio History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Value Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>TODAY'S VALUE</Text>
          <Text style={styles.heroValue}>{formatCurrency(latest.totalValue)}</Text>
          <View style={styles.changeRow}>
            <Ionicons
              name={dayChange >= 0 ? 'trending-up' : 'trending-down'}
              size={14}
              color={dayChange >= 0 ? colors.success : colors.error}
            />
            <Text style={[styles.changeText, { color: dayChange >= 0 ? colors.success : colors.error }]}>
              {dayChange >= 0 ? '+' : ''}{formatCurrency(dayChange)} ({dayChangePct}%)
            </Text>
            <Text style={styles.changeLabel}>vs yesterday</Text>
          </View>
        </View>

        {/* Value Chart */}
        {points.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>VALUE OVER TIME</Text>
            <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
              <Defs>
                <LinearGradient id="hGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.stable} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={colors.stable} stopOpacity="0.0" />
                </LinearGradient>
              </Defs>
              <Line x1="0" y1={CHART_H * 0.5} x2={CHART_W} y2={CHART_H * 0.5} stroke={colors.border} strokeWidth="1" />
              <Path d={fillD} fill="url(#hGrad)" />
              <Path d={pathD} stroke={colors.stable} strokeWidth="2" fill="none" />
              {selectedIndex >= 0 && selectedIndex < points.length && (
                <Circle cx={points[selectedIndex].x} cy={points[selectedIndex].y} r="4" fill={colors.stable} />
              )}
            </Svg>
          </View>
        )}

        {/* Date Points */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>SNAPSHOT DATES</Text>
          {points.slice(0, showAllDates ? points.length : Math.min(5, points.length)).map((p, idx) => (
            <TouchableOpacity
              key={p.label}
              style={[styles.pointRow, selectedIndex === idx && styles.pointRowActive]}
              onPress={() => setSelectedIndex(idx)}
              onLongPress={() => handleDeleteSnapshot(p.label)}
            >
              <Text style={styles.pointDate}>
                {new Date(p.label).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
              <Text style={styles.pointValue}>{formatCurrency(chartData[idx].totalValue)}</Text>
            </TouchableOpacity>
          ))}
          {points.length > 5 && !showAllDates && (
            <TouchableOpacity style={styles.viewMoreBtn} onPress={() => setShowAllDates(true)}>
              <Text style={styles.viewMoreText}>View All ({points.length} dates)</Text>
              <Ionicons name="chevron-down" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
          {showAllDates && points.length > 5 && (
            <TouchableOpacity style={styles.viewMoreBtn} onPress={() => setShowAllDates(false)}>
              <Text style={styles.viewMoreText}>Show Less</Text>
              <Ionicons name="chevron-up" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Allocation */}
        {latest.allocation && Object.keys(latest.allocation).length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>LATEST ALLOCATION</Text>
            {Object.entries(latest.allocation)
              .sort((a, b) => b[1] - a[1])
              .map(([label, val]) => {
                const pct = latest.totalValue > 0 ? ((val / latest.totalValue) * 100).toFixed(1) : '0.0';
                const catColor = ALLOC_COLORS[label] ?? ALLOC_COLORS.Other;
                return (
                  <View key={label} style={styles.allocRow}>
                    <Text style={styles.allocLabel} numberOfLines={1}>{label}</Text>
                    <View style={styles.allocBarTrack}>
                      <View style={[styles.allocBar, { width: `${Math.min(Number(pct), 100)}%`, backgroundColor: catColor }]} />
                    </View>
                    <Text style={styles.allocPct}>{pct}%</Text>
                  </View>
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
    borderBottomColor: colors.border,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 40,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: colors.outline,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.stableDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
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
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  changeLabel: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    gap: 12,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  pointRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pointRowActive: {
    backgroundColor: colors.stableDim,
    borderRadius: rounded.DEFAULT,
  },
  pointDate: {
    fontSize: 13,
    color: colors.onSurface,
  },
  pointValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  allocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  allocLabel: {
    fontSize: 12,
    color: colors.onSurface,
    width: 60,
    flexShrink: 1,
  },
  allocBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  allocBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  allocPct: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    width: 42,
    textAlign: 'right',
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    marginTop: 4,
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
