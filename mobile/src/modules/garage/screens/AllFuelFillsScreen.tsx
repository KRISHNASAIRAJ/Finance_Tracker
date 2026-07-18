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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>All Fuel Fills</Text>
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
        {vehicleFills.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.fuelEmojiLarge}>⛽</Text>
            <Text style={styles.emptyText}>No fuel fills logged yet</Text>
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
                    <Text style={styles.logSub}>
                      {fill.odometer} km · {formatCurrency(fill.pricePerLiter)}/L
                      {fill.station ? ` · ${fill.station}` : ''}
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
    gap: 2,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    marginBottom: 8,
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
    padding: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
});
