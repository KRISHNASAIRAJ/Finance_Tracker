import React from 'react';
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

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useGarageStore, FuelFill } from '../store';
import { GarageStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'AllFuelFills'>;

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

const formatCurrency = (paise: number) => {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export default function AllFuelFillsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { fills, vehicles } = useGarageStore();
  const [selectedVehicle, setSelectedVehicle] = React.useState(vehicles[0]);

  const vehicleFills = fills
    .filter((f) => f.vehicle === selectedVehicle)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const sortedByOdo = [...fills.filter(f => f.vehicle === selectedVehicle)]
    .sort((a, b) => a.odometer - b.odometer);

  // Mileage calculations
  const perFillMileage: number[] = [];
  for (let i = 1; i < sortedByOdo.length; i++) {
    const dist = sortedByOdo[i].odometer - sortedByOdo[i - 1].odometer;
    const fuel = sortedByOdo[i].liters;
    if (fuel > 0) perFillMileage.push(parseFloat((dist / fuel).toFixed(1)));
  }

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Fuel Fills</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddFuelFill')} activeOpacity={0.7}>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
        </TouchableOpacity>
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
        {vehicleFills.length > 0 && (
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
        )}

        {/* Total Spend + Add */}
        <View style={styles.spendRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.spendLabel}>TOTAL FUEL SPEND</Text>
            <Text style={styles.spendValue}>{formatCurrency(totalFuelSpend)}</Text>
            <Text style={styles.spendSub}>{vehicleFills.length} fill{vehicleFills.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            style={styles.addFillBtn}
            onPress={() => navigation.navigate('AddFuelFill')}
            activeOpacity={0.8}
          >
            <Ionicons name="water-outline" size={18} color="#fff" />
            <Text style={styles.addFillBtnText}>Add Fill</Text>
          </TouchableOpacity>
        </View>

        {/* Fuel Fill List */}
        {vehicleFills.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.fuelEmojiLarge}>⛽</Text>
            <Text style={styles.emptyText}>No fuel fills logged yet</Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => navigation.navigate('AddFuelFill')}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={18} color="#000" />
              <Text style={styles.emptyAddBtnText}>Add First Fuel Fill</Text>
            </TouchableOpacity>
          </View>
        ) : (
          vehicleFills.map((fill) => {
            const si = getStationIcon(fill.station);
            return (
              <TouchableOpacity
                key={fill.id}
                style={styles.logRow}
                onPress={() => navigation.navigate('EditFuelFill', { fillId: fill.id })}
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
                    <Text style={styles.logTitle}>{fill.liters} Liters Fuel</Text>
                    <Text style={styles.logSub} numberOfLines={1}>
                      {fill.odometer} km · {formatCurrency(fill.pricePerLiter)}/L
                    </Text>
                  </View>
                </View>
                <View style={styles.logRight}>
                  <Text style={styles.logAmount}>{formatCurrency(fill.amount)}</Text>
                  <Text style={styles.logDate}>
                    {new Date(fill.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
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
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
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
  addBtn: {
    padding: 4,
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
  vehicleEmoji: { fontSize: 14 },
  tabText: { color: colors.onSurfaceVariant, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: colors.onSurface, fontWeight: '600' },
  scrollContent: { padding: spacing.containerPadding, gap: 14, paddingBottom: 60 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1, backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderRadius: rounded.lg, padding: 14, alignItems: 'center', gap: 2,
  },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  summaryValue: { fontSize: 22, fontWeight: '800', color: '#c084fc' },
  summaryUnit: { fontSize: 11, color: colors.onSurfaceVariant },
  spendRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    padding: 16, gap: 12,
  },
  spendLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  spendValue: { fontSize: 22, fontWeight: '800', color: colors.onSurface },
  spendSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  addFillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: rounded.full, backgroundColor: colors.primaryContainer,
  },
  addFillBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  logRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.cardPadding, backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  logLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconContainer: { width: 36, height: 36, borderRadius: rounded.full, alignItems: 'center', justifyContent: 'center' },
  brandIconText: { fontSize: 12, fontWeight: '800' },
  fuelEmoji: { fontSize: 16 },
  fuelEmojiLarge: { fontSize: 40 },
  logTitle: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  logSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  logRight: { alignItems: 'flex-end' },
  logAmount: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  logDate: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  emptyState: { padding: 48, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '500' },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: rounded.full, backgroundColor: colors.primary,
    marginTop: 4,
  },
  emptyAddBtnText: { fontSize: 13, fontWeight: '700', color: '#000' },
});
