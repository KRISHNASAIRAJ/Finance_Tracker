/**
 * GarageDashboardScreen — vehicle garage root. Multi-vehicle overview, recent
 * fuel fills, quick-add FAB, and vehicle management.
 */
import React, { useState, useCallback } from 'react';
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
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useGarageStore, FuelFill } from '../store';
import { GarageStackParamList } from '../../../navigation/RootNavigator';
import { useGarageSync } from '../hooks/useGarageSync';
import { processSyncQueue } from '../../../services/syncQueue';
import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';


type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'GarageDashboard'>;

function getStationIcon(station?: string) {
  if (!station) return { type: 'generic' as const, bg: `${colors.primary}15`, color: colors.primary, label: '⛽' };
  const up = station.toUpperCase();
  if (up.includes('HPCL') || up.includes('HP ')) {
    return { type: 'brand' as const, bg: '#e74c3c18', color: '#e74c3c', label: 'HP' };
  }
  if (up.includes('BPCL') || up.includes('BP ')) {
    return { type: 'brand' as const, bg: '#2ecc7118', color: '#2ecc71', label: 'BP' };
  }
  if (up.includes('IOCL') || up.includes('IO ')) {
    return { type: 'brand' as const, bg: '#3498db18', color: '#3498db', label: 'IO' };
  }
  return { type: 'generic' as const, bg: `${colors.primary}15`, color: colors.primary, label: '⛽' };
}

export default function GarageDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { vehicles, fills, maintenance, getVehicleSpendTotal, addVehicle, editVehicle, deleteVehicle } = useGarageStore();
  const { pullFromCloud } = useGarageSync();

  const [selectedVehicle, setSelectedVehicle] = useState<string | undefined>(vehicles[0]);

  React.useEffect(() => {
    if (!selectedVehicle && vehicles.length > 0) {
      setSelectedVehicle(vehicles[0]);
    }
  }, [vehicles, selectedVehicle]);
  const [chartView, setChartView] = useState<'latest' | 'overall'>('latest');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleNameInput, setVehicleNameInput] = useState('');
  const [editingVehicleName, setEditingVehicleName] = useState<string | null>(null);

  React.useEffect(() => {
    setSelectedPointIndex(null);
  }, [selectedVehicle, chartView]);

  useFocusEffect(
    useCallback(() => {
      pullFromCloud();
      processSyncQueue().catch((e: Error) => console.warn('[Garage] syncQueue flush failed:', e));
    }, [pullFromCloud])
  );

  const vehicleFills = fills.filter((f) => f.vehicle === selectedVehicle);
  const vehicleMaint = maintenance.filter((m) => m.vehicle === selectedVehicle);

  const totalFuelSpend = vehicleFills.reduce((sum, f) => sum + f.amount, 0);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyFuelSpend = vehicleFills.reduce(
    (sum, f) => sum + (new Date(f.date) >= startOfMonth ? f.amount : 0),
    0
  );
  const totalMaintSpend = vehicleMaint.reduce((sum, m) => sum + m.amount, 0);

  const sortedForChart = [...vehicleFills].sort((a, b) => a.odometer - b.odometer);

  // Per-fill mileage (distance since last fill / fuel at that fill)
  const perFillMileage: { value: number; fill: FuelFill }[] = [];
  for (let i = 1; i < sortedForChart.length; i++) {
    const prevOdo = sortedForChart[i - 1].odometer;
    const currOdo = sortedForChart[i].odometer;
    if (typeof prevOdo !== 'number' || typeof currOdo !== 'number') continue;
    const dist = currOdo - prevOdo;
    if (dist <= 0) continue;
    const fuel = sortedForChart[i].liters;
    if (fuel > 0) {
      perFillMileage.push({ value: parseFloat((dist / fuel).toFixed(1)), fill: sortedForChart[i] });
    }
  }

  // Latest Fill Mileage: average of last 3 per-fill mileage values
  const latestFillMileage = (() => {
    if (perFillMileage.length === 0) return 'N/A';
    const last3 = perFillMileage.slice(-3);
    const avg = last3.reduce((sum, p) => sum + p.value, 0) / last3.length;
    return avg.toFixed(1);
  })();

  // Overall Mileage: total distance / total fuel across all fills
  const overallMileage = (() => {
    if (sortedForChart.length < 2) return 'N/A';
    const totalDist = sortedForChart[sortedForChart.length - 1].odometer - sortedForChart[0].odometer;
    const totalFuel = sortedForChart.slice(1).reduce((sum, f) => sum + f.liters, 0);
    if (totalFuel === 0) return 'N/A';
    return (totalDist / totalFuel).toFixed(1);
  })();

  // Chart data: latest shows last 6 per-fill, overall shows ALL per-fill
  const latestData = perFillMileage.length >= 2 ? perFillMileage.slice(-6).map((p) => p.value) : [];
  const overallData = perFillMileage.length >= 2 ? perFillMileage.map((p) => p.value) : [];

  const chartData = chartView === 'latest' ? latestData : overallData;
  const activeIndex = selectedPointIndex !== null ? selectedPointIndex : (chartData.length - 1);
  const latestMileageVal = chartData[activeIndex]?.toFixed(1) ?? 'N/A';
  const displayMileage = chartView === 'overall' ? overallMileage : latestFillMileage;
  const sampleCount = perFillMileage.slice(-3).length;
  const displayLabel = chartView === 'overall'
    ? 'OVERALL AVG MILEAGE'
    : sampleCount <= 1
      ? 'LATEST FILL MILEAGE'
      : `LATEST ${sampleCount} FILLS AVG`;

  // Build smooth area chart wave path
  const CHART_W = 320;
  const CHART_H = 120;
  const padX = 30;
  const padY = 25;

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

  const lastFillDate = vehicleFills.length > 0
    ? new Date(sortedForChart[sortedForChart.length - 1]?.date ?? vehicleFills[0].date)
        .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : 'No logs';

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  // Recent fills: latest 3 only
  const recentFills = sortedForChart.slice(-3).reverse();

  const renderFillItem = ({ item }: { item: FuelFill }) => {
    const si = getStationIcon(item.station);
    return (
      <TouchableOpacity
        style={styles.logRow}
        onPress={() => navigation.navigate('EditFuelFill', { fillId: item.id })}
      >
        <View style={styles.logLeft}>
          <View style={[styles.iconContainer, { backgroundColor: si.bg }]}>
            {si.type === 'brand' ? (
              <Text style={[styles.brandIconText, { color: si.color }]}>{si.label}</Text>
            ) : (
              <Text style={styles.fuelEmoji}>{si.label}</Text>
            )}
          </View>
            <View>
            <Text style={styles.logTitle}>{item.liters} Liters Fuel</Text>
            <Text style={styles.logSub} numberOfLines={1}>
              {item.odometer} km · {formatCurrency(item.pricePerLiter)}/L
            </Text>
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Mileage Hero */}
        <View style={styles.heroCard}>
          <ExpoLinearGradient
            colors={['rgba(94,230,255,0.09)', 'rgba(0,0,0,0)']}
            style={styles.heroGradient}
            pointerEvents="none"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicleTabsRow}>
            {vehicles.map((v) => {
              const isSelected = selectedVehicle === v;
              return (
                <TouchableOpacity
                  key={v}
                  style={[styles.tabButton, isSelected && styles.tabButtonActive]}
                  onPress={() => setSelectedVehicle(v)}
                  onLongPress={() => {
                    if (vehicles.length <= 1) return;
                    setEditingVehicleName(v);
                    setVehicleNameInput(v);
                    setShowVehicleModal(true);
                  }}
                >
                  <Text style={styles.vehicleEmoji}>🛵</Text>
                  <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>{v}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.addVehicleBtn}
              onPress={() => {
                setEditingVehicleName(null);
                setVehicleNameInput('');
                setShowVehicleModal(true);
              }}
            >
              <Ionicons name="add" size={18} color={colors.action} />
            </TouchableOpacity>
          </ScrollView>
          <View style={styles.heroDivider} />
          <Text style={styles.heroLabel}>CURRENT EFFICIENCY</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{displayMileage}</Text>
            {displayMileage !== 'N/A' && <Text style={styles.heroUnit}>km/l</Text>}
          </View>
          <View style={styles.heroSubRow}>
            <View style={styles.trendBadge}>
              <Ionicons name="arrow-up" size={12} color={colors.success} />
              <Text style={styles.trendText}>avg of last 3 fills</Text>
            </View>
            <Text style={styles.heroSubText}>Last fill: {lastFillDate}</Text>
          </View>
        </View>

        {/* Bento Spend Grid */}
        <View style={styles.gridSection}>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('AllFuelFills')}
            activeOpacity={0.7}
          >
            <View style={styles.gridHeader}>
              <View style={[styles.gridIcon, { backgroundColor: '#5ee6ff20' }]}>
                <Ionicons name="water-outline" size={16} color="#5ee6ff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gridLabel} numberOfLines={1}>Fuel Spend</Text>
              </View>
            </View>
            <Text style={[styles.gridValue, { fontWeight: '700', color: '#5ee6ff' }]}>{formatCurrency(monthlyFuelSpend)}</Text>
            <Text style={styles.gridSubValue}>{formatCurrency(totalFuelSpend)} total</Text>
            <TouchableOpacity
              style={styles.cardAction}
              onPress={(e) => { e.stopPropagation(); navigation.navigate('AddFuelFill'); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardActionText, { color: '#5ee6ff' }]}>+ Add Fuel Fill</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate('AllMaintenance')}
            activeOpacity={0.7}
          >
            <View style={styles.gridHeader}>
              <View style={[styles.gridIcon, { backgroundColor: '#ea647920' }]}>
                <Ionicons name="construct-outline" size={16} color="#ea6479" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gridLabel} numberOfLines={1}>Service/Maint</Text>
              </View>
            </View>
            <Text style={[styles.gridValue, { color: '#ea6479' }]}>{formatCurrency(totalMaintSpend)}</Text>
            <Text style={styles.gridLink}>{vehicleMaint.length} logs →</Text>
            <TouchableOpacity
              style={styles.cardAction}
              onPress={(e) => { e.stopPropagation(); navigation.navigate('AddMaintenance', {}); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardActionText, { color: '#ea6479' }]}>+ Add Service</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Mileage Trend Chart */}
        <View style={styles.chartCard}>
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

          <View style={styles.areaChartContainer}>
            {points.length > 1 ? (
              <>
                <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
                  <Defs>
                    <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor={colors.action} stopOpacity="0.35" />
                      <Stop offset="100%" stopColor={colors.action} stopOpacity="0.0" />
                    </LinearGradient>
                  </Defs>

                  <Line x1="0" y1={CHART_H * 0.33} x2={CHART_W} y2={CHART_H * 0.33} stroke={colors.border} strokeWidth="1" />
                  <Line x1="0" y1={CHART_H * 0.66} x2={CHART_W} y2={CHART_H * 0.66} stroke={colors.border} strokeWidth="1" />

                  <Path d={fillD} fill="url(#grad)" />
                  <Path d={pathD} stroke={colors.action} strokeWidth="2.5" fill="none" />

                  {activeIndex >= 0 && activeIndex < points.length && (
                    <Line
                      x1={points[activeIndex].x}
                      y1={points[activeIndex].y}
                      x2={points[activeIndex].x}
                      y2={CHART_H - padY + 10}
                      stroke={colors.action}
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                    />
                  )}
                </Svg>

                {activeIndex >= 0 && activeIndex < points.length && (
                  <View
                    style={[
                      styles.floatValueBadge,
                      {
                        left: points[activeIndex].x - 45,
                        top: points[activeIndex].y - 32,
                      },
                    ]}
                  >
                    <Text style={styles.floatValueText}>{latestMileageVal} km/l</Text>
                  </View>
                )}

                <View style={styles.touchOverlay}>
                  {points.map((_, idx) => (
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

        {/* Recent Fuel Logs */}
        <View style={styles.logsSection}>
          <View style={styles.logsHeaderRow}>
            <Text style={styles.sectionTitle}>RECENT FUEL LOGS</Text>
            {vehicleFills.length > 3 && (
              <TouchableOpacity onPress={() => navigation.navigate('AllFuelFills')}>
                <Text style={styles.viewMoreText}>View More</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.logsContainer}>
            {recentFills.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.fuelEmojiLarge}>⛽</Text>
                <Text style={styles.emptyText}>No fuel fills logged yet</Text>
              </View>
            ) : (
              recentFills.map((fill) => (
                <TouchableOpacity
                  key={fill.id}
                  style={styles.logRow}
                  onPress={() => navigation.navigate('EditFuelFill', { fillId: fill.id })}
                >
                  <View style={styles.logLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: getStationIcon(fill.station).bg }]}>
                      {getStationIcon(fill.station).type === 'brand' ? (
                        <Text style={[styles.brandIconText, { color: getStationIcon(fill.station).color }]}>
                          {getStationIcon(fill.station).label}
                        </Text>
                      ) : (
                        <Text style={styles.fuelEmoji}>{getStationIcon(fill.station).label}</Text>
                      )}
                    </View>
                    <View>
                      <Text style={styles.logTitle}>{fill.liters} Liters Fuel</Text>
                      <Text style={styles.logSub} numberOfLines={1}>
                        {fill.odometer} km · {formatCurrency(fill.pricePerLiter)}/L
                      </Text>
                    </View>
                  </View>
                  <View style={styles.logRight}>
                    <Text style={styles.logAmount}>{formatCurrency(fill.amount)}</Text>
                    <Text style={styles.logDate}>
                      {new Date(fill.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Vehicle Add/Edit/Delete Modal */}
      <Modal visible={showVehicleModal} transparent animationType="fade" onRequestClose={() => setShowVehicleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingVehicleName ? 'Edit Vehicle' : 'Add Vehicle'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={vehicleNameInput}
              onChangeText={setVehicleNameInput}
              placeholder="Vehicle name"
              placeholderTextColor={colors.outline}
            />
            {editingVehicleName && vehicles.length > 1 && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  deleteVehicle(editingVehicleName);
                  if (selectedVehicle === editingVehicleName) {
                    setSelectedVehicle(vehicles.find((v: string) => v !== editingVehicleName) || '');
                  }
                  setShowVehicleModal(false);
                }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={styles.deleteBtnText}>Delete "{editingVehicleName}"</Text>
              </TouchableOpacity>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowVehicleModal(false)}
              >
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={() => {
                  const name = vehicleNameInput.trim();
                  if (!name) { alert('Enter a vehicle name'); return; }
                  if (editingVehicleName && name !== editingVehicleName) {
                    editVehicle(editingVehicleName, name);
                    if (selectedVehicle === editingVehicleName) {
                      setSelectedVehicle(name);
                    }
                  } else if (!editingVehicleName) {
                    if (vehicles.includes(name)) { alert('Vehicle already exists'); return; }
                    addVehicle(name);
                    setSelectedVehicle(name);
                  }
                  setShowVehicleModal(false);
                }}
              >
                <Text style={styles.modalBtnTextSave}>
                  {editingVehicleName ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
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
  vehicleTabsRow: {
    paddingBottom: 4,
    gap: 8,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(155,165,255,0.08)',
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.actionDim,
    borderColor: colors.action,
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
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 20,
    alignItems: 'flex-start',
    gap: 4,
    overflow: 'hidden',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
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
    color: colors.action,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
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
    flexShrink: 1,
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  cardActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  gridValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  gridSubValue: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  gridLink: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
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
    color: colors.action,
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
    backgroundColor: colors.border,
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
    backgroundColor: colors.actionStrong,
  },
  chartToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  chartToggleTextActive: {
    color: colors.action,
  },
  areaChartContainer: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 8,
  },
  floatValueBadge: {
    position: 'absolute',
    backgroundColor: 'rgba(18,18,24,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rounded.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.action,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  floatValueText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.action,
  },
  logsSection: {
    gap: 8,
  },
  logsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  viewMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  logsContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: rounded.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontSize: 12,
    fontWeight: '800',
  },
  fuelEmoji: {
    fontSize: 16,
  },
  fuelEmojiLarge: {
    fontSize: 40,
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
  addVehicleBtn: {
    width: 36,
    height: 36,
    borderRadius: rounded.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: 24,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    height: 44,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: '500',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  deleteBtnText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  modalBtnCancel: { backgroundColor: 'transparent' },
  modalBtnSave: { backgroundColor: colors.primaryContainer },
  modalBtnTextCancel: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
  modalBtnTextSave: { fontSize: 14, color: colors.textPrimary, fontWeight: '700' },
});
