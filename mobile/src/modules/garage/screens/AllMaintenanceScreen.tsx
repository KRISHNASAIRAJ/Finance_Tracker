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
import { useGarageStore, MaintenanceLog } from '../store';
import { GarageStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'AllMaintenance'>;

const formatCurrency = (paise: number) => {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export default function AllMaintenanceScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { vehicles, maintenance } = useGarageStore();
  const [selectedVehicle, setSelectedVehicle] = React.useState(vehicles[0]);

  React.useEffect(() => {
    if (!selectedVehicle && vehicles.length > 0) {
      setSelectedVehicle(vehicles[0]);
    }
  }, [vehicles, selectedVehicle]);

  const vehicleMaint = maintenance
    .filter((m) => m.vehicle === selectedVehicle)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalMaintSpend = vehicleMaint.reduce((sum, m) => sum + m.amount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Service History</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddMaintenance', {})}
          activeOpacity={0.7}
        >
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
        {/* Total Spend */}
        <View style={styles.spendRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.spendLabel}>TOTAL SERVICE SPEND</Text>
            <Text style={styles.spendValue}>{formatCurrency(totalMaintSpend)}</Text>
            <Text style={styles.spendSub}>
              {vehicleMaint.length} log{vehicleMaint.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addMaintBtn}
            onPress={() => navigation.navigate('AddMaintenance', {})}
            activeOpacity={0.8}
          >
            <Ionicons name="construct-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.addMaintBtnText}>Add Service</Text>
          </TouchableOpacity>
        </View>

        {/* Maintenance List */}
        {vehicleMaint.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔧</Text>
            <Text style={styles.emptyText}>No service logs yet</Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => navigation.navigate('AddMaintenance', {})}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={18} color={colors.textInverse} />
              <Text style={styles.emptyAddBtnText}>Add First Service</Text>
            </TouchableOpacity>
          </View>
        ) : (
          vehicleMaint.map((log: MaintenanceLog) => (
            <TouchableOpacity
              key={log.id}
              style={styles.logRow}
              onPress={() => navigation.navigate('AddMaintenance', { maintenanceId: log.id })}
            >
              <View style={styles.logLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="construct-outline" size={16} color={colors.amber} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logTitle}>{log.serviceType}</Text>
                  <Text style={styles.logSub} numberOfLines={1}>
                    {log.notes ? log.notes : log.vehicle}
                  </Text>
                </View>
              </View>
              <View style={styles.logRight}>
                <Text style={styles.logAmount}>{formatCurrency(log.amount)}</Text>
                <Text style={styles.logDate}>
                  {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            </TouchableOpacity>
          ))
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
  addBtn: {
    padding: 4,
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
  vehicleEmoji: { fontSize: 14 },
  tabText: { color: colors.onSurfaceVariant, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: colors.onSurface, fontWeight: '600' },
  scrollContent: { padding: spacing.containerPadding, gap: 14, paddingBottom: 60 },
  spendRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: rounded.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 16, gap: 12,
  },
  spendLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  spendValue: { fontSize: 22, fontWeight: '800', color: colors.onSurface },
  spendSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  addMaintBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: rounded.full, backgroundColor: colors.primaryContainer,
  },
  addMaintBtnText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  logRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.cardPadding, backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  logLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconContainer: {
    width: 36, height: 36, borderRadius: rounded.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.amber}20`,
  },
  logTitle: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  logSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  logRight: { alignItems: 'flex-end' },
  logAmount: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  logDate: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  emptyState: { padding: 48, alignItems: 'center', gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '500' },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: rounded.full, backgroundColor: colors.primary,
    marginTop: 4,
  },
  emptyAddBtnText: { fontSize: 13, fontWeight: '700', color: colors.textInverse },
});
