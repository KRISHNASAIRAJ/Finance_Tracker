/**
 * VehicleReportsScreen — per-vehicle analytics: fuel cost trends, mileage chart,
 * maintenance spend breakdown and total cost of ownership.
 */
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
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useGarageStore } from '../store';
import { GarageStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'VehicleReports'>;

export default function VehicleReportsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { vehicles, fills, maintenance } = useGarageStore();
  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]);

  const vehicleFills = fills
    .filter((f) => f.vehicle === selectedVehicle)
    .sort((a, b) => a.odometer - b.odometer);
  const vehicleMaint = maintenance.filter((m) => m.vehicle === selectedVehicle);

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  // Mileage per fill
  const perFillMileage: number[] = [];
  for (let i = 1; i < vehicleFills.length; i++) {
    const dist = vehicleFills[i].odometer - vehicleFills[i - 1].odometer;
    const fuel = vehicleFills[i].liters;
    if (fuel > 0) perFillMileage.push(parseFloat((dist / fuel).toFixed(1)));
  }

  // Overall mileage
  const overallMileage = (() => {
    if (vehicleFills.length < 2) return 'N/A';
    const totalDist = vehicleFills[vehicleFills.length - 1].odometer - vehicleFills[0].odometer;
    const totalFuel = vehicleFills.slice(1).reduce((sum, f) => sum + f.liters, 0);
    if (totalFuel === 0) return 'N/A';
    return (totalDist / totalFuel).toFixed(1);
  })();

  // Best / worst mileage
  const bestMileage = perFillMileage.length > 0 ? Math.max(...perFillMileage).toFixed(1) : 'N/A';
  const worstMileage = perFillMileage.length > 0 ? Math.min(...perFillMileage).toFixed(1) : 'N/A';

  // Cost breakdown
  const totalFuelSpend = vehicleFills.reduce((sum, f) => sum + f.amount, 0);
  const totalMaintSpend = vehicleMaint.reduce((sum, m) => sum + m.amount, 0);
  const totalSpend = totalFuelSpend + totalMaintSpend;

  // Service type breakdown
  const serviceBreakdown: Record<string, number> = {};
  vehicleMaint.forEach((m) => {
    serviceBreakdown[m.serviceType] = (serviceBreakdown[m.serviceType] || 0) + m.amount;
  });

  // Monthly fuel spend
  const monthlyFuel: Record<string, number> = {};
  vehicleFills.forEach((f) => {
    const month = new Date(f.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    monthlyFuel[month] = (monthlyFuel[month] || 0) + f.amount;
  });

  // Chart data
  const CHART_W = 320;
  const CHART_H = 120;
  const padX = 30;
  const padY = 25;

  const chartData = perFillMileage.length >= 2 ? perFillMileage.slice(-10) : [];
  const chartMax = chartData.length > 0 ? Math.max(...chartData) : 0;
  const chartMin = chartData.length > 0 ? Math.min(...chartData) : 0;
  const chartRange = chartMax === chartMin ? 1 : chartMax - chartMin;
  const norm = (v: number) => (v - chartMin) / chartRange;

  const points = chartData.map((val, i) => {
    const x = padX + (i / Math.max(chartData.length - 1, 1)) * (CHART_W - 2 * padX);
    const y = CHART_H - padY - norm(val) * (CHART_H - 2 * padY - 10);
    return { x, y };
  });

  let pathD = '';
  let fillD = '';
  if (points.length > 1) {
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Vehicle Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Vehicle tabs */}
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
                <Text style={styles.vehicleEmoji}>🛵</Text>
                <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>{v}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Mileage Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>OVERALL</Text>
            <Text style={styles.summaryValue}>{overallMileage}</Text>
            <Text style={styles.summaryUnit}>km/l</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>BEST</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{bestMileage}</Text>
            <Text style={styles.summaryUnit}>km/l</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>WORST</Text>
            <Text style={[styles.summaryValue, { color: colors.error }]}>{worstMileage}</Text>
            <Text style={styles.summaryUnit}>km/l</Text>
          </View>
        </View>

        {/* Mileage Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>MILEAGE TREND</Text>
          {points.length > 1 ? (
            <View style={styles.chartContainer}>
              <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
                <Defs>
                  <LinearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={colors.action} stopOpacity="0.35" />
                    <Stop offset="100%" stopColor={colors.action} stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>
                <Path d={fillD} fill="url(#reportGrad)" />
                <Path d={pathD} stroke={colors.action} strokeWidth="2.5" fill="none" />
              </Svg>
            </View>
          ) : (
            <View style={{ height: CHART_H, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>Not enough data</Text>
            </View>
          )}
        </View>

        {/* Cost Breakdown */}
        <View style={styles.costCard}>
          <Text style={styles.costTitle}>COST BREAKDOWN</Text>
          <View style={styles.costRow}>
            <View style={styles.costItem}>
              <View style={[styles.costDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.costLabel}>Fuel</Text>
            </View>
            <Text style={styles.costValue}>{formatCurrency(totalFuelSpend)}</Text>
          </View>
          <View style={styles.costRow}>
            <View style={styles.costItem}>
              <View style={[styles.costDot, { backgroundColor: colors.amber }]} />
              <Text style={styles.costLabel}>Service</Text>
            </View>
            <Text style={styles.costValue}>{formatCurrency(totalMaintSpend)}</Text>
          </View>
          <View style={styles.costDivider} />
          <View style={styles.costRow}>
            <Text style={styles.costTotalLabel}>TOTAL</Text>
            <Text style={styles.costTotalValue}>{formatCurrency(totalSpend)}</Text>
          </View>
        </View>

        {/* Service Type Breakdown */}
        {Object.keys(serviceBreakdown).length > 0 && (
          <View style={styles.breakdownCard}>
            <Text style={styles.costTitle}>SERVICE BREAKDOWN</Text>
            {Object.entries(serviceBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([type, amount]) => (
                <View key={type} style={styles.costRow}>
                  <Text style={styles.costLabel}>{type}</Text>
                  <Text style={styles.costValue}>{formatCurrency(amount)}</Text>
                </View>
              ))}
          </View>
        )}

        {/* Monthly Fuel Spend */}
        {Object.keys(monthlyFuel).length > 0 && (
          <View style={styles.breakdownCard}>
            <Text style={styles.costTitle}>MONTHLY FUEL SPEND</Text>
            {Object.entries(monthlyFuel)
              .sort((a, b) => b[1] - a[1])
              .map(([month, amount]) => (
                <View key={month} style={styles.costRow}>
                  <Text style={styles.costLabel}>{month}</Text>
                  <Text style={styles.costValue}>{formatCurrency(amount)}</Text>
                </View>
              ))}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  tabContainer: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tabScroll: {
    paddingHorizontal: spacing.containerPadding,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  vehicleEmoji: {
    fontSize: 14,
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
    paddingBottom: 40,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 14,
    alignItems: 'center',
    gap: 2,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.action,
  },
  summaryUnit: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    overflow: 'hidden',
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  chartContainer: {
    overflow: 'hidden',
  },
  costCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 16,
    gap: 12,
  },
  costTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  costDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  costLabel: {
    fontSize: 14,
    color: colors.onSurface,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  costDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  costTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  costTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  breakdownCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 16,
    gap: 12,
  },
});
