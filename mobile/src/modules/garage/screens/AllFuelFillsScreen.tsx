/**
 * AllFuelFillsScreen — every fuel fill for one vehicle.
 *
 * Restyled to the Meridian v2 reference: overall / best / worst efficiency
 * tiles, a per-fill efficiency chart, the total fuel spend and the fill list.
 *
 * The efficiency maths uses the shared `perFillKmPerL` helper, which skips
 * fills that have no usable previous odometer reading — so a fill with a
 * missing reading can never report a bogus 0.0 km/l.
 */
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  Fab,
  Label,
  LineChart,
  PressScale,
  ProgressBar,
  Rise,
  Screen,
} from '../../../shared/components/meridian';
import { useGarageStore, perFillKmPerL } from '../store';
import { getStationIcon } from './GarageDashboardScreen';

type NavigationProp = NativeStackNavigationProp<any>;

const formatCurrency = (paise: number) => {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export default function AllFuelFillsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { fills, vehicles } = useGarageStore();
  const [selectedVehicle, setSelectedVehicle] = React.useState(vehicles[0]);

  React.useEffect(() => {
    if (!selectedVehicle && vehicles.length > 0) {
      setSelectedVehicle(vehicles[0]);
    }
  }, [vehicles, selectedVehicle]);

  const vehicleFills = fills
    .filter((f) => f.vehicle === selectedVehicle)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const sortedByOdo = [...fills.filter((f) => f.vehicle === selectedVehicle)].sort(
    (a, b) => a.odometer - b.odometer
  );

  // Every fill that has a measurable distance since the previous one.
  const perFill = perFillKmPerL(vehicleFills);
  const perFillMileage = perFill.map((p) => p.value);

  const overallMileage = (() => {
    if (sortedByOdo.length < 2) return 'N/A';
    const totalDist = sortedByOdo[sortedByOdo.length - 1].odometer - sortedByOdo[0].odometer;
    const totalFuel = sortedByOdo.slice(1).reduce((sum: number, f: any) => sum + f.liters, 0);
    if (totalFuel === 0) return 'N/A';
    return (totalDist / totalFuel).toFixed(1);
  })();

  const bestMileage = perFillMileage.length > 0 ? Math.max(...perFillMileage).toFixed(1) : 'N/A';
  const worstMileage = perFillMileage.length > 0 ? Math.min(...perFillMileage).toFixed(1) : 'N/A';

  const totalFuelSpend = vehicleFills.reduce((sum, f) => sum + f.amount, 0);

  // The chart reads oldest → newest so the line runs left to right.
  const chartSeries = [...perFill].reverse().map((p) => p.value);
  const chartAverage = chartSeries.length
    ? chartSeries.reduce((s, v) => s + v, 0) / chartSeries.length
    : 0;

  // The litres bar on each row, relative to the largest fill.
  const maxLiters = vehicleFills.reduce((m, f) => Math.max(m, f.liters || 0), 0);

  return (
    <Screen bottomInset={40}>
      {/* Header */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale onPress={() => navigation.goBack()} scale={0.9} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <Text style={styles.appBarTitle}>Fuel fills</Text>
          <Fab
            icon="add"
            size={38}
            onPress={() => navigation.navigate('AddFuelFill')}
            accessibilityLabel="Add fuel fill"
          />
        </View>
      </Rise>

      {/* Vehicle picker */}
      <Rise index={1}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.vehicleRow,
            vehicles.length <= 1 && styles.vehicleRowCentered,
          ]}
        >
          {vehicles.map((v) => {
            const isSelected = selectedVehicle === v;
            return (
              <PressScale key={v} onPress={() => setSelectedVehicle(v)} scale={0.96}>
                <View style={[styles.vehicleChip, isSelected && styles.vehicleChipActive]}>
                  <Ionicons
                    name="bicycle-outline"
                    size={15}
                    color={isSelected ? mc.red : mc.textDim}
                  />
                  <Text style={[styles.vehicleChipText, isSelected && styles.vehicleChipTextActive]}>
                    {v}
                  </Text>
                </View>
              </PressScale>
            );
          })}
        </ScrollView>
      </Rise>

      {/* Efficiency tiles */}
      {vehicleFills.length > 0 ? (
        <Rise index={2}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Label small>OVERALL</Label>
              <Text style={styles.summaryValue}>{overallMileage}</Text>
              <Text style={styles.summaryUnit}>km/l</Text>
            </View>
            <View style={styles.summaryCard}>
              <Label small>BEST</Label>
              <Text style={[styles.summaryValue, { color: mc.mint }]}>{bestMileage}</Text>
              <Text style={styles.summaryUnit}>km/l</Text>
            </View>
            <View style={styles.summaryCard}>
              <Label small>WORST</Label>
              <Text style={[styles.summaryValue, { color: mc.redSoft }]}>{worstMileage}</Text>
              <Text style={styles.summaryUnit}>km/l</Text>
            </View>
          </View>
        </Rise>
      ) : null}

      {/* Efficiency per fill */}
      {chartSeries.length > 1 ? (
        <Rise index={3}>
          <Card>
            <View style={styles.rowBetween}>
              <Label>EFFICIENCY PER FILL</Label>
              <Text style={styles.rowValue}>{perFill.length} measured fills</Text>
            </View>
            <LineChart
              data={chartSeries}
              width={300}
              height={100}
              color={mc.red}
              reference={chartAverage}
              referenceColor={mc.sky}
              referenceLabel={`avg ${chartAverage.toFixed(1)}`}
              endDot
              style={styles.chart}
            />
          </Card>
        </Rise>
      ) : null}

      {/* Total spend */}
      <Rise index={4}>
        <Card>
          <View style={styles.spendRow}>
            <View style={styles.spendMain}>
              <Label>TOTAL FUEL SPEND</Label>
              <Text style={styles.spendValue}>{formatCurrency(totalFuelSpend)}</Text>
              <Text style={styles.spendSub}>
                {vehicleFills.length} fill{vehicleFills.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <PressScale
              onPress={() => navigation.navigate('AddFuelFill')}
              scale={0.95}
              style={styles.addFillBtn}
            >
              <Ionicons name="water-outline" size={16} color={mc.sky} />
              <Text style={[styles.addFillBtnText, { color: mc.sky }]}>Add fill</Text>
            </PressScale>
          </View>
        </Card>
      </Rise>

      {/* Fill list */}
      {vehicleFills.length === 0 ? (
        <Rise index={5}>
          <Card style={styles.emptyState}>
            <Text style={styles.fuelEmojiLarge}>⛽</Text>
            <Text style={styles.emptyText}>No fuel fills logged yet</Text>
            <PressScale
              onPress={() => navigation.navigate('AddFuelFill')}
              scale={0.96}
              style={styles.emptyAddBtn}
            >
              <Ionicons name="add-circle" size={17} color={mc.ink} />
              <Text style={styles.emptyAddBtnText}>Add first fuel fill</Text>
            </PressScale>
          </Card>
        </Rise>
      ) : (
        <Rise index={5}>
          <Label style={styles.sectionTitle}>RECENT</Label>
          <Card pad={false}>
            {vehicleFills.map((fill, idx) => {
              const si = getStationIcon(fill.station);
              const pct = maxLiters > 0 ? (fill.liters || 0) / maxLiters : 0;
              return (
                <PressScale
                  key={fill.id}
                  onPress={() => navigation.navigate('EditFuelFill', { fillId: fill.id })}
                  scale={0.99}
                  style={[styles.logRow, idx > 0 && styles.logRowDivider]}
                >
                  <View style={[styles.iconContainer, { backgroundColor: si.bg }]}>
                    <Text style={[styles.brandIconText, { color: si.color }]}>{si.label}</Text>
                  </View>
                  <View style={styles.logMain}>
                    <Text style={styles.logTitle}>{fill.liters} L</Text>
                    <ProgressBar
                      value={pct}
                      color={mc.sky}
                      height={5}
                      style={styles.litersBar}
                    />
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
            })}
          </Card>
        </Rise>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    height: 52,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },

  vehicleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  vehicleRowCentered: {
    justifyContent: 'center',
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.card,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  vehicleChipActive: {
    backgroundColor: mc.redDim,
  },
  vehicleChipText: {
    fontSize: 14,
    color: mc.textDim,
  },
  vehicleChipTextActive: {
    color: mc.text,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: mc.card,
    borderRadius: mr.card,
    padding: 12,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '500',
    color: mc.text,
  },
  summaryUnit: {
    fontSize: 11,
    color: mc.textDim,
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
  chart: {
    marginTop: 8,
    alignSelf: 'stretch',
  },

  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spendMain: {
    flex: 1,
    minWidth: 0,
  },
  spendValue: {
    fontSize: 30,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  spendSub: {
    fontSize: 12,
    color: mc.textDim,
  },
  addFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.skyDim,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  addFillBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },

  sectionTitle: {
    marginTop: 6,
    marginBottom: 8,
    marginLeft: 4,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
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
  litersBar: {
    marginVertical: 5,
    width: '85%',
  },
  logSub: {
    fontSize: 11,
    color: mc.textDim,
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
    paddingVertical: 22,
  },
  fuelEmojiLarge: {
    fontSize: 26,
  },
  emptyText: {
    fontSize: 14,
    color: mc.textDim,
    marginTop: 6,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.mint,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 14,
  },
  emptyAddBtnText: {
    fontSize: 14,
    color: mc.ink,
    fontWeight: '600',
  },
});
