/**
 * GarageDashboardScreen — vehicle garage root.
 *
 * Restyled to the Meridian v2 reference: a big efficiency readout with a
 * per-fill bar chart, a fuel/service/cost-per-km tile row, the next-service
 * countdown and the recent fills list. Multi-vehicle switching, vehicle
 * add/rename/delete, the chart view toggle and tap-to-inspect all still work.
 */
import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  BarChart,
  Card,
  IconTile,
  Label,
  PressScale,
  ProgressBar,
  Rise,
  Screen,
} from '../../../shared/components/meridian';
import DrawerTrigger from '../../../shared/components/DrawerTrigger';
import { useGarageStore, getNextServiceInfo, isGeneralService, type FuelFill } from '../store';
import { GarageStackParamList } from '../../../navigation/RootNavigator';
import { useGarageSync } from '../hooks/useGarageSync';
import { processSyncQueue } from '../../../services/syncQueue';

type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'GarageDashboard'>;

/** The fuel-station brand badge shown on every fill row. */
export function getStationIcon(station?: string) {
  const up = (station || '').toUpperCase();
  if (up.includes('HPCL') || up.includes('HP ')) {
    return { type: 'brand' as const, bg: mc.redDim, color: mc.redSoft, label: 'HP' };
  }
  if (up.includes('BPCL') || up.includes('BP ')) {
    return { type: 'brand' as const, bg: mc.mintDim, color: mc.mint, label: 'BP' };
  }
  if (up.includes('IOCL') || up.includes('IO ')) {
    return { type: 'brand' as const, bg: mc.skyDim, color: mc.sky, label: 'IO' };
  }
  return { type: 'generic' as const, bg: mc.raised, color: mc.textDim, label: '⛽' };
}

export default function GarageDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { vehicles, fills, maintenance, addVehicle, editVehicle, deleteVehicle } = useGarageStore();
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

  // Per-fill mileage (distance since the last fill / fuel at that fill).
  // A fill with no usable odometer reading is skipped so it can never
  // produce a bogus 0.0 km/l.
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

  // Latest Fill Mileage: average of the last 3 per-fill mileage values
  const latestFillMileage = (() => {
    if (perFillMileage.length === 0) return 'N/A';
    const last3 = perFillMileage.slice(-3);
    const avg = last3.reduce((sum, p) => sum + p.value, 0) / last3.length;
    return avg.toFixed(1);
  })();

  // Overall Mileage: total distance / total fuel across all fills
  const overallMileage = (() => {
    if (sortedForChart.length < 2) return 'N/A';
    const totalDist =
      sortedForChart[sortedForChart.length - 1].odometer - sortedForChart[0].odometer;
    const totalFuel = sortedForChart.slice(1).reduce((sum, f) => sum + f.liters, 0);
    if (totalFuel === 0) return 'N/A';
    return (totalDist / totalFuel).toFixed(1);
  })();

  // Chart data: latest shows the last 6 per-fill values, overall shows all.
  const latestData = perFillMileage.length >= 2 ? perFillMileage.slice(-6) : [];
  const overallData = perFillMileage.length >= 2 ? perFillMileage : [];
  const chartEntries = chartView === 'latest' ? latestData : overallData;
  const chartData = chartEntries.map((p) => p.value);
  const activeIndex = selectedPointIndex !== null ? selectedPointIndex : chartData.length - 1;
  const latestMileageVal = chartData[activeIndex]?.toFixed(1) ?? 'N/A';
  const displayMileage = chartView === 'overall' ? overallMileage : latestFillMileage;
  const sampleCount = perFillMileage.slice(-3).length;
  const displayLabel = chartView === 'overall'
    ? 'OVERALL AVG MILEAGE'
    : sampleCount <= 1
      ? 'LATEST FILL MILEAGE'
      : `LATEST ${sampleCount} FILLS AVG`;

  // The trend chip: last-3 average against the 3 before it.
  const trendPct = (() => {
    if (perFillMileage.length < 6) return null;
    const vals = perFillMileage.map((p) => p.value);
    const last3 = vals.slice(-3);
    const prev3 = vals.slice(-6, -3);
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const now3 = avg(last3);
    const before = avg(prev3);
    if (before <= 0) return null;
    return ((now3 - before) / before) * 100;
  })();

  const chartAverage = chartData.length ? chartData.reduce((s, v) => s + v, 0) / chartData.length : 0;

  // Cost per km — real: total spend divided by the distance covered.
  const totalKm =
    sortedForChart.length >= 2
      ? sortedForChart[sortedForChart.length - 1].odometer - sortedForChart[0].odometer
      : 0;
  const costPerKm = totalKm > 0 ? (totalFuelSpend + totalMaintSpend) / 100 / totalKm : null;

  // Next service — real reminder maths from the garage store.
  const currentOdometer = vehicleFills.length
    ? Math.max(...vehicleFills.map((f) => f.odometer || 0))
    : 0;
  const nextService = getNextServiceInfo(
    selectedVehicle ?? '',
    vehicleMaint,
    currentOdometer
  );
  const lastService = [...vehicleMaint]
    .filter((m) => isGeneralService(m.serviceType) && m.odometer && m.odometer > 0)
    .sort((a, b) => (b.odometer ?? 0) - (a.odometer ?? 0))[0];
  const serviceSettings = useGarageStore(
    (s) => s.serviceReminderSettings[selectedVehicle ?? '']
  );
  const intervalKm = serviceSettings?.intervalKm ?? 3000;
  const serviceKmLeft = nextService?.dueKm != null ? nextService.dueKm - currentOdometer : null;
  const serviceUsedPct =
    serviceKmLeft != null && lastService?.odometer != null && intervalKm > 0
      ? Math.min(1, Math.max(0, (currentOdometer - lastService.odometer) / intervalKm))
      : 0;

  const lastFillDate = vehicleFills.length > 0
    ? new Date(sortedForChart[sortedForChart.length - 1]?.date ?? vehicleFills[0].date)
        .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : 'No logs';

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  // Recent fills: latest 3 only
  const recentFills = sortedForChart.slice(-3).reverse();

  const firstChartDate = chartEntries.length
    ? new Date(chartEntries[0].fill.date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })
    : null;
  const lastChartDate = chartEntries.length
    ? new Date(chartEntries[chartEntries.length - 1].fill.date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })
    : null;

  return (
    <Screen
      bottomInset={120}
      floating={
        /* Log fuel fill — floating action button, pinned above the tab bar */
        <PressScale
          onPress={() => navigation.navigate('AddFuelFill')}
          scale={0.95}
          wrapStyle={styles.fabWrap}
          style={styles.fab}
          accessibilityLabel="Log fuel fill"
        >
          <Ionicons name="add" size={26} color={mc.white} />
        </PressScale>
      }
    >
      {/* Header — drawer trigger, title, vehicle picker */}
      <Rise index={0}>
        <View style={styles.topBar}>
          <DrawerTrigger />
          <Text style={styles.topBarTitle}>Garage</Text>
          <PressScale
            onPress={() => {
              setEditingVehicleName(null);
              setVehicleNameInput('');
              setShowVehicleModal(true);
            }}
            scale={0.96}
            style={styles.vehicleChip}
          >
            <Ionicons name="bicycle-outline" size={15} color={mc.red} />
            <Text style={styles.vehicleChipText} numberOfLines={1}>
              {selectedVehicle ?? 'Add vehicle'}
            </Text>
            <Ionicons name="chevron-down" size={13} color={mc.textDim} />
          </PressScale>
        </View>
      </Rise>

      {/* Efficiency hero + per-fill chart */}
      <Rise index={1}>
        <Card>
          <View style={styles.heroHead}>
            <View>
              <Label>EFFICIENCY</Label>
              <View style={styles.heroValueRow}>
                <Text style={styles.heroValue}>{displayMileage}</Text>
                {displayMileage !== 'N/A' ? <Text style={styles.heroUnit}>km/l</Text> : null}
              </View>
            </View>
            {trendPct !== null ? (
              <View
                style={[
                  styles.trendBadge,
                  { backgroundColor: trendPct >= 0 ? mc.mintDim : mc.redDim },
                ]}
              >
                <Ionicons
                  name={trendPct >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={11}
                  color={trendPct >= 0 ? mc.mint : mc.redSoft}
                />
                <Text
                  style={[
                    styles.trendText,
                    { color: trendPct >= 0 ? mc.mint : mc.redSoft },
                  ]}
                >
                  {Math.abs(trendPct).toFixed(1)}%
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.chartToggleRow}>
            {(['latest', 'overall'] as const).map((v) => (
              <PressScale key={v} onPress={() => setChartView(v)} scale={0.95}>
                <View style={[styles.chartToggle, chartView === v && styles.chartToggleActive]}>
                  <Text
                    style={[
                      styles.chartToggleText,
                      chartView === v && styles.chartToggleTextActive,
                    ]}
                  >
                    {v === 'latest' ? 'Latest 6' : 'Overall'}
                  </Text>
                </View>
              </PressScale>
            ))}
            <Text style={styles.chartToggleHint}>{displayLabel}</Text>
          </View>

          {chartData.length > 1 ? (
            <>
              <BarChart
                data={chartData.map((v, i) => ({
                  value: v,
                  color: i === chartData.length - 1 ? mc.red : mc.barDim,
                }))}
                width={300}
                height={104}
                reference={chartAverage}
                referenceColor={mc.sky}
                onSelect={(i) => setSelectedPointIndex(i)}
                selectedIndex={activeIndex}
                style={styles.chart}
              />
              <View style={styles.chartFoot}>
                <Text style={styles.chartFootText}>{firstChartDate}</Text>
                <Text style={[styles.chartFootText, { color: mc.sky }]}>
                  avg {chartAverage.toFixed(1)}
                </Text>
                <Text style={[styles.chartFootText, { color: mc.redSoft }]}>{lastChartDate}</Text>
              </View>
              <Text style={styles.selectedValue}>
                {latestMileageVal} km/l ·{' '}
                {chartEntries[activeIndex]
                  ? new Date(chartEntries[activeIndex].fill.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : ''}
              </Text>
            </>
          ) : (
            <View style={styles.chartEmpty}>
              <Text style={styles.chartEmptyText}>Not enough data for a chart yet</Text>
            </View>
          )}
        </Card>
      </Rise>

      {/* Fuel / service / cost per km */}
      <View style={styles.tileRow}>
        <Rise index={2} style={styles.tileCell}>
          <Card style={styles.tileCard}>
            <IconTile icon="water-outline" color={mc.sky} size={32} radius={11} />
            <Text style={styles.tileValue}>{formatCurrency(monthlyFuelSpend)}</Text>
            <Label small>FUEL</Label>
            <PressScale
              onPress={() => navigation.navigate('AllFuelFills')}
              scale={0.95}
              style={styles.tileAction}
            >
              <Text style={[styles.tileActionText, { color: mc.sky }]}>View fills</Text>
            </PressScale>
            <PressScale
              onPress={() => navigation.navigate('AddFuelFill')}
              scale={0.95}
              style={styles.tileAction}
            >
              <Text style={[styles.tileActionText, { color: mc.sky }]}>+ Add fill</Text>
            </PressScale>
          </Card>
        </Rise>

        <Rise index={3} style={styles.tileCell}>
          <Card style={styles.tileCard}>
            <IconTile icon="construct-outline" color={mc.violet} size={32} radius={11} />
            <Text style={styles.tileValue}>{formatCurrency(totalMaintSpend)}</Text>
            <Label small>SERVICE</Label>
            <PressScale
              onPress={() => navigation.navigate('AllMaintenance')}
              scale={0.95}
              style={styles.tileAction}
            >
              <Text style={[styles.tileActionText, { color: mc.violet }]}>
                {vehicleMaint.length} logs
              </Text>
            </PressScale>
            <PressScale
              onPress={() => navigation.navigate('AddMaintenance', {})}
              scale={0.95}
              style={styles.tileAction}
            >
              <Text style={[styles.tileActionText, { color: mc.violet }]}>+ Add service</Text>
            </PressScale>
          </Card>
        </Rise>

        <Rise index={4} style={styles.tileCell}>
          <Card style={styles.tileCard}>
            <IconTile icon="cash-outline" color={mc.amber} size={32} radius={11} />
            <Text style={styles.tileValue}>
              {costPerKm !== null ? `₹${costPerKm.toFixed(2)}` : '—'}
            </Text>
            <Label small>PER KM</Label>
            <PressScale
              onPress={() => navigation.navigate('VehicleSpend')}
              scale={0.95}
              style={styles.tileAction}
            >
              <Text style={[styles.tileActionText, { color: mc.amber }]}>Breakdown</Text>
            </PressScale>
          </Card>
        </Rise>
      </View>

      {/* Next service */}
      <Rise index={5}>
        <Card>
          <View style={styles.rowBetween}>
            <Label>NEXT SERVICE</Label>
            {serviceKmLeft !== null ? (
              <Text style={[styles.serviceLeft, serviceKmLeft <= 200 && { color: mc.redSoft }]}>
                {serviceKmLeft} km left
              </Text>
            ) : null}
          </View>
          <ProgressBar
            value={serviceUsedPct}
            color={serviceKmLeft !== null && serviceKmLeft <= 200 ? mc.redSoft : mc.amber}
            height={10}
            style={styles.serviceBar}
          />
          <View style={styles.serviceFoot}>
            <Text style={styles.serviceFootText}>
              Last {lastService?.odometer != null ? `${lastService.odometer} km` : '—'}
            </Text>
            <Text style={styles.serviceFootText}>
              {nextService?.dueKm != null ? `Due ${nextService.dueKm} km` : 'No service logged'}
            </Text>
          </View>
        </Card>
      </Rise>

      {/* Recent fills */}
      <Rise index={6}>
        <Card pad={false}>
          <View style={styles.logsHeaderRow}>
            <Label>RECENT FILLS</Label>
            <View style={styles.logsHeaderActions}>
              {vehicleFills.length > 3 ? (
                <TouchableOpacity onPress={() => navigation.navigate('AllFuelFills')}>
                  <Text style={[styles.viewMoreText, { color: mc.textDim }]}>View all</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => navigation.navigate('AddFuelFill')}>
                <Text style={[styles.viewMoreText, { color: mc.redSoft }]}>+ Add fill</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.logsContainer}>
            {recentFills.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.fuelEmojiLarge}>⛽</Text>
                <Text style={styles.emptyText}>No fuel fills logged yet</Text>
              </View>
            ) : (
              recentFills.map((fill, idx) => {
                const station = getStationIcon(fill.station);
                return (
                  <PressScale
                    key={fill.id}
                    onPress={() => navigation.navigate('EditFuelFill', { fillId: fill.id })}
                    scale={0.99}
                    style={[styles.logRow, idx > 0 && styles.logRowDivider]}
                  >
                    <View style={[styles.iconContainer, { backgroundColor: station.bg }]}>
                      <Text style={[styles.brandIconText, { color: station.color }]}>
                        {station.label}
                      </Text>
                    </View>
                    <View style={styles.logMain}>
                      <Text style={styles.logTitle}>{fill.liters} L</Text>
                      <Text style={styles.logSub} numberOfLines={1}>
                        {fill.odometer} km · {formatCurrency(fill.pricePerLiter)}/L
                      </Text>
                    </View>
                    <View style={styles.logRight}>
                      <Text style={styles.logAmount}>{formatCurrency(fill.amount)}</Text>
                      <Text style={styles.logDate}>
                        {new Date(fill.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                  </PressScale>
                );
              })
            )}
          </View>
        </Card>
      </Rise>

      {/* Vehicle Add/Edit/Delete Modal */}
      <Modal
        visible={showVehicleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVehicleModal(false)}
      >
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
              placeholderTextColor={mc.textFaint}
            />
            {editingVehicleName && vehicles.length > 1 ? (
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
                <Ionicons name="trash-outline" size={16} color={mc.redSoft} />
                <Text style={[styles.deleteBtnText, { color: mc.redSoft }]}>
                  Delete "{editingVehicleName}"
                </Text>
              </TouchableOpacity>
            ) : null}
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
                  if (!name) {
                    alert('Enter a vehicle name');
                    return;
                  }
                  if (editingVehicleName && name !== editingVehicleName) {
                    editVehicle(editingVehicleName, name);
                    if (selectedVehicle === editingVehicleName) {
                      setSelectedVehicle(name);
                    }
                  } else if (!editingVehicleName) {
                    if (vehicles.includes(name)) {
                      alert('Vehicle already exists');
                      return;
                    }
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 26,
    fontWeight: '500',
    color: mc.text,
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.card,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 160,
  },
  vehicleChipText: {
    fontSize: 14,
    color: mc.text,
    flexShrink: 1,
  },
  fabWrap: {
    position: 'absolute',
    bottom: 92,
    right: 18,
    width: 56,
    height: 56,
  },
  fab: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#EB0028',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },

  heroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  heroValue: {
    fontSize: 40,
    fontWeight: '500',
    color: mc.text,
  },
  heroUnit: {
    fontSize: 15,
    color: mc.textDim,
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

  chartToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  chartToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: mc.raised,
  },
  chartToggleActive: {
    backgroundColor: mc.redDim,
  },
  chartToggleText: {
    fontSize: 11,
    color: mc.textDim,
  },
  chartToggleTextActive: {
    color: mc.redSoft,
    fontWeight: '600',
  },
  chartToggleHint: {
    flex: 1,
    textAlign: 'right',
    fontSize: 10,
    letterSpacing: 0.8,
    color: mc.textFaint,
  },
  chart: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  chartFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  chartFootText: {
    fontSize: 11,
    color: mc.textDim,
  },
  selectedValue: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 6,
    textAlign: 'center',
  },
  chartEmpty: {
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: {
    color: mc.textDim,
    fontSize: 13,
  },

  tileRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tileCell: {
    flex: 1,
  },
  tileCard: {
    flex: 1,
    gap: 6,
    paddingVertical: 12,
  },
  tileValue: {
    fontSize: 17,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  tileAction: {
    backgroundColor: 'transparent',
  },
  tileActionText: {
    fontSize: 11,
    fontWeight: '600',
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceLeft: {
    fontSize: 13,
    color: mc.amber,
    fontWeight: '600',
  },
  serviceBar: {
    marginTop: 10,
  },
  serviceFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  serviceFootText: {
    fontSize: 11,
    color: mc.textDim,
  },

  logsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  logsHeaderActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  viewMoreText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logsContainer: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  logRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontSize: 11,
    fontWeight: '500',
  },
  logMain: {
    flex: 1,
    minWidth: 0,
  },
  logTitle: {
    fontSize: 15,
    color: mc.text,
  },
  logSub: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  logRight: {
    alignItems: 'flex-end',
  },
  logAmount: {
    fontSize: 15,
    color: mc.text,
  },
  logDate: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  fuelEmojiLarge: {
    fontSize: 26,
  },
  emptyText: {
    fontSize: 13,
    color: mc.textDim,
    marginTop: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: mc.card,
    borderRadius: mr.card,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: mc.text,
  },
  modalInput: {
    backgroundColor: mc.raised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: mc.text,
    fontSize: 15,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtnText: {
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  modalBtnCancel: {
    backgroundColor: mc.raised,
  },
  modalBtnSave: {
    backgroundColor: mc.red,
  },
  modalBtnTextCancel: {
    color: mc.text,
    fontSize: 14,
    fontWeight: '500',
  },
  modalBtnTextSave: {
    color: mc.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
