import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useGarageStore, FuelFill } from '../store';
import { useFinanceStore } from '../../finance/store';
import { GarageStackParamList } from '../../../navigation/RootNavigator';
import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import SidebarDrawer from '../../../shared/components/SidebarDrawer';

type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'GarageDashboard'>;

export default function GarageDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { vehicles, fills, maintenance, getVehicleSpendTotal } = useGarageStore();
  const notifications = useFinanceStore((state) => state.notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chartView, setChartView] = useState<'latest' | 'overall'>('latest');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  React.useEffect(() => {
    setSelectedPointIndex(null);
  }, [selectedVehicle, chartView]);

  const vehicleFills = fills.filter((f) => f.vehicle === selectedVehicle);
  const vehicleMaint = maintenance.filter((m) => m.vehicle === selectedVehicle);

  const totalFuelSpend = vehicleFills.reduce((sum, f) => sum + f.amount, 0);
  const totalMaintSpend = vehicleMaint.reduce((sum, m) => sum + m.amount, 0);

  const getAvgMileageText = () => {
    if (vehicleFills.length < 2) return 'N/A';
    const sortedFills = [...vehicleFills].sort((a, b) => a.odometer - b.odometer);
    const dist = sortedFills[sortedFills.length - 1].odometer - sortedFills[0].odometer;
    const fuel = sortedFills.slice(1).reduce((sum, f) => sum + f.liters, 0);
    if (fuel === 0) return 'N/A';
    return (dist / fuel).toFixed(1);
  };

  // Per-fill mileage for chart (sorted oldest → newest)
  const sortedForChart = [...vehicleFills].sort((a, b) => a.odometer - b.odometer);
  const perFillMileage: number[] = [];
  for (let i = 1; i < sortedForChart.length; i++) {
    const dist = sortedForChart[i].odometer - sortedForChart[i - 1].odometer;
    const fuel = sortedForChart[i].liters;
    if (fuel > 0) perFillMileage.push(parseFloat((dist / fuel).toFixed(1)));
  }

  const avgMileageNum = getAvgMileageText();
  const overallAvgVal = avgMileageNum !== 'N/A' ? parseFloat(avgMileageNum) : 0;

  const latestData = perFillMileage.length >= 2 ? perFillMileage.slice(-6) : [];
  const chartData = chartView === 'latest'
    ? latestData
    : overallAvgVal > 0
      ? [overallAvgVal, overallAvgVal, overallAvgVal, overallAvgVal, overallAvgVal, overallAvgVal]
      : latestData;

  const activeIndex = selectedPointIndex !== null ? selectedPointIndex : (chartData.length - 1);
  const latestMileage = chartData[activeIndex]?.toFixed(1) ?? 'N/A';
  const displayMileage = chartView === 'overall' ? avgMileageNum : latestMileage;
  const displayLabel = chartView === 'overall' ? 'OVERALL AVG MILEAGE' : 'LATEST FILL MILEAGE';

  // Build smooth area chart wave path as Svg coordinates
  const CHART_W = 320;
  const CHART_H = 120;
  const padX = 30;
  const padY = 25;

  const chartMax = Math.max(...chartData);
  const chartMin = Math.min(...chartData);
  const chartRange = chartMax === chartMin ? 1 : chartMax - chartMin;
  const norm = (v: number) => (v - chartMin) / chartRange;

  const points = chartData.map((val, i) => {
    const x = padX + (i / (chartData.length - 1)) * (CHART_W - 2 * padX);
    const y = CHART_H - padY - norm(val) * (CHART_H - 2 * padY - 10);
    return { x, y };
  });

  let pathD = '';
  let fillD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cpX1 = curr.x + (next.x - curr.x) / 2;
      const cpY1 = curr.y;
      const cpX2 = curr.x + (next.x - curr.x) / 2;
      const cpY2 = next.y;
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
    }
    fillD = `${pathD} L ${points[points.length - 1].x} ${CHART_H - padY + 10} L ${points[0].x} ${CHART_H - padY + 10} Z`;
  }

  const xAxisLabels = chartView === 'latest' && sortedForChart.length >= 2
    ? sortedForChart.slice(-chartData.length).map(f => new Date(f.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase())
    : [];

  const lastFillDate = vehicleFills.length > 0
    ? new Date(sortedForChart[sortedForChart.length - 1]?.date ?? vehicleFills[0].date)
        .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : 'No logs';

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const renderFillItem = ({ item }: { item: FuelFill }) => {
    return (
      <TouchableOpacity
        style={styles.logRow}
        onPress={() => navigation.navigate('EditFuelFill', { fillId: item.id })}
      >
        <View style={styles.logLeft}>
          <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="funnel-outline" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.logTitle}>{item.liters} Liters Fuel</Text>
            <Text style={styles.logSub}>{item.odometer} km · {formatCurrency(item.pricePerLiter)}/L</Text>
          </View>
        </View>
        <View style={styles.logRight}>
          <Text style={styles.logAmount}>{formatCurrency(item.amount)}</Text>
          <Text style={styles.logDate}>
            {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Shared slide-out left Drawer */}
      <SidebarDrawer
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
      />

      {/* Top Header */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setSidebarOpen(true)}>
            <Ionicons name="menu-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.logoText}>Meridian</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Notifications' as any)}>
          <View style={styles.notificationWrapper}>
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            {unreadCount > 0 && <View style={styles.notificationDot} />}
          </View>
        </TouchableOpacity>
      </View>

      {/* Vehicle Selector Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {vehicles.map((v) => {
            const isSelected = selectedVehicle === v;
            return (
              <TouchableOpacity
                key={v}
                style={[styles.tabButton, isSelected && styles.tabButtonActive]}
                onPress={() => setSelectedVehicle(v)}
              >
                <Ionicons
                  name="car-outline"
                  size={16}
                  color={isSelected ? colors.onSurface : colors.onSurfaceVariant}
                />
                <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>{v}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Mileage Hero — styled after reference image */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>CURRENT EFFICIENCY</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{avgMileageNum === 'N/A' ? 'N/A' : avgMileageNum}</Text>
            {avgMileageNum !== 'N/A' && <Text style={styles.heroUnit}>km/l</Text>}
          </View>
          <View style={styles.heroSubRow}>
            <View style={styles.trendBadge}>
              <Ionicons name="arrow-up" size={12} color={colors.success} />
              <Text style={styles.trendText}>from prev fill</Text>
            </View>
            <Text style={styles.heroSubText}>Last fill: {lastFillDate}</Text>
          </View>
        </View>

        {/* Bento Spend Grid */}
        <View style={styles.gridSection}>
          <View style={styles.gridCard}>
            <View style={styles.gridHeader}>
              <View style={[styles.gridIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="funnel-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.gridLabel}>Fuel Spend</Text>
            </View>
            <Text style={styles.gridValue}>{formatCurrency(totalFuelSpend)}</Text>
          </View>

          <View style={styles.gridCard}>
            <View style={styles.gridHeader}>
              <View style={[styles.gridIcon, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name="construct-outline" size={16} color="#f59e0b" />
              </View>
              <Text style={styles.gridLabel}>Service Cost</Text>
            </View>
            <Text style={styles.gridValue}>{formatCurrency(totalMaintSpend)}</Text>
          </View>
        </View>

        {/* Mileage Trend Card — Cred-style clean area chart */}
        <View style={styles.chartCard}>
          {/* Header row: label + toggle buttons */}
          <View style={styles.chartHeaderRow}>
            <View>
              <Text style={styles.chartSubLabel}>{displayLabel}</Text>
              <View style={styles.chartValueRow}>
                <Text style={styles.chartBigValue}>{displayMileage}</Text>
                {displayMileage !== 'N/A' && <Text style={styles.chartUnit}>km/l</Text>}
              </View>
            </View>
            <View style={styles.chartToggleGroup}>
              <TouchableOpacity
                style={[styles.chartToggleBtn, chartView === 'latest' && styles.chartToggleBtnActive]}
                onPress={() => setChartView('latest')}
              >
                <Text style={[styles.chartToggleText, chartView === 'latest' && styles.chartToggleTextActive]}>Latest</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chartToggleBtn, chartView === 'overall' && styles.chartToggleBtnActive]}
                onPress={() => setChartView('overall')}
              >
                <Text style={[styles.chartToggleText, chartView === 'overall' && styles.chartToggleTextActive]}>Overall</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Smooth SVG Area Wave Chart */}
          <View style={styles.areaChartContainer}>
            {points.length > 1 ? (
              <>
                <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
                  <Defs>
                    <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
                      <Stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                    </LinearGradient>
                  </Defs>

                  <Line x1="0" y1={CHART_H * 0.33} x2={CHART_W} y2={CHART_H * 0.33} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <Line x1="0" y1={CHART_H * 0.66} x2={CHART_W} y2={CHART_H * 0.66} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                  <Path d={fillD} fill="url(#grad)" />
                  <Path d={pathD} stroke="#c084fc" strokeWidth="2.5" fill="none" />

                  <Line
                    x1={points[activeIndex].x}
                    y1={points[activeIndex].y}
                    x2={points[activeIndex].x}
                    y2={CHART_H - padY + 10}
                    stroke="#c084fc"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                  />
                </Svg>

                <View
                  style={[
                    styles.floatValueBadge,
                    {
                      left: points[activeIndex].x - 45,
                      top: points[activeIndex].y - 32,
                    },
                  ]}
                >
                  <Text style={styles.floatValueText}>{latestMileage} km/l</Text>
                </View>

                <View style={styles.touchOverlay}>
                  {points.map((p, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.touchSlice}
                      onPress={() => setSelectedPointIndex(idx)}
                      activeOpacity={1}
                    />
                  ))}
                </View>
              </>
            ) : (
              <View style={{ height: CHART_H, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>Not enough data for chart</Text>
              </View>
            )}
          </View>
        </View>

        {/* Recent logs */}
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>RECENT FUEL LOGS</Text>
          <View style={styles.logsContainer}>
            {vehicleFills.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="funnel-outline" size={40} color={colors.outline} />
                <Text style={styles.emptyText}>No fuel fills logged yet</Text>
              </View>
            ) : (
              <FlatList
                data={vehicleFills}
                renderItem={renderFillItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddFuelFill')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
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
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },

  notificationWrapper: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  tabContainer: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  tabScroll: {
    paddingHorizontal: spacing.containerPadding,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  tabText: {
    color: colors.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.onSurface,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: '#0f0f1a',
    borderColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 20,
    alignItems: 'flex-start',
    gap: 4,
    overflow: 'hidden',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  heroValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#c084fc', // Purple-ish like reference
    letterSpacing: -1,
  },
  heroUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginBottom: 6,
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
  gridSection: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    gap: 12,
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gridIcon: {
    width: 28,
    height: 28,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  gridValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  chartCard: {
    backgroundColor: '#0f0f1a',
    borderColor: 'rgba(168, 85, 247, 0.12)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    overflow: 'hidden',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartSubLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  chartValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  chartBigValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#c084fc',
    letterSpacing: -1,
  },
  chartUnit: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  chartToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: rounded.full,
    padding: 2,
    gap: 2,
  },
  chartToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: rounded.full,
  },
  chartToggleBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.3)',
  },
  chartToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  chartToggleTextActive: {
    color: '#c084fc',
  },
  areaChartContainer: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 8,
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  barRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    gap: 3,
    paddingHorizontal: 2,
  },
  areaBar: {
    flex: 1,
    backgroundColor: '#7c3aed',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    // subtle gradient-like effect via linear solid
  },
  chartFooter: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 4,
  },
  floatValueBadge: {
    position: 'absolute',
    backgroundColor: '#a855f7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rounded.sm,
    borderWidth: 1,
    borderColor: '#c084fc',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  floatValueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Legacy — kept to avoid unused style warnings
  xAxisRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, marginTop: 4 },
  xAxisLabel: { fontSize: 10, color: colors.onSurfaceVariant, fontWeight: '600' },
  chartPoint: { position: 'absolute', alignItems: 'center', width: 24, height: 24 },
  pointPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#a855f7' },
  pointLabel: { fontSize: 9, color: '#fff', fontWeight: '700', marginTop: 4 },
  trendLinePath: { position: 'absolute', left: '10%', right: '10%', bottom: 50, height: 2 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface, marginBottom: 16 },
  chartContainer: { position: 'relative', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 8 },
  areaFill: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', backgroundColor: 'rgba(168,85,247,0.08)' },
  logsSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  logsContainer: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: rounded.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  logSub: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  logRight: {
    alignItems: 'flex-end',
  },
  logAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  logDate: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
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
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 20,
  },
  touchSlice: {
    flex: 1,
    height: '100%',
    backgroundColor: 'transparent',
  },
});
