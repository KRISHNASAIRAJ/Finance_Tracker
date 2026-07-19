import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
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

type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'VehicleSpend'>;

const SERVICE_TYPES = ['Oil Change', 'Tyre Replacement', 'General Service', 'Brake Service', 'Battery', 'Accident Repair', 'Other'];

export default function VehicleSpendScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { vehicles, maintenance, addMaintenanceLog } = useGarageStore();
  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [notes, setNotes] = useState('');

  const vehicleMaint = maintenance
    .filter((m) => m.vehicle === selectedVehicle)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalSpend = vehicleMaint.reduce((sum, m) => sum + m.amount, 0);

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const handleAdd = () => {
    const rawAmount = parseFloat(amount);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!serviceType.trim()) {
      alert('Please select or enter a service type');
      return;
    }
    addMaintenanceLog({
      vehicle: selectedVehicle,
      amount: Math.round(rawAmount * 100),
      serviceType: serviceType.trim(),
      notes: notes.trim() || undefined,
    });
    setAmount('');
    setServiceType('');
    setNotes('');
    setShowForm(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Vehicle Spend</Text>
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
        {/* Total Spend Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>TOTAL SERVICE SPEND</Text>
          <Text style={styles.heroValue}>{formatCurrency(totalSpend)}</Text>
          <Text style={styles.heroSub}>{vehicleMaint.length} service{vehicleMaint.length !== 1 ? 's' : ''} logged</Text>
        </View>

        {/* Add Form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Log Service Expense</Text>
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 1500"
                placeholderTextColor={colors.onSurfaceVariant}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>SERVICE TYPE</Text>
              <View style={styles.chipRow}>
                {SERVICE_TYPES.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.chip, serviceType === st && styles.chipActive]}
                    onPress={() => setServiceType(st)}
                  >
                    <Text style={[styles.chipText, serviceType === st && styles.chipTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="Or type custom service..."
                placeholderTextColor={colors.onSurfaceVariant}
                value={serviceType}
                onChangeText={setServiceType}
              />
            </View>
            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Changed engine oil at 5000km"
                placeholderTextColor={colors.onSurfaceVariant}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Service Logs */}
        <View style={styles.logsSection}>
          <View style={styles.logsHeaderRow}>
            <Text style={styles.sectionTitle}>SERVICE HISTORY</Text>
          </View>
          {vehicleMaint.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="construct-outline" size={40} color={colors.outline} />
              <Text style={styles.emptyText}>No service logs yet</Text>
            </View>
          ) : (
            vehicleMaint.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: '#f59e0b18' }]}>
                    <Ionicons name="construct-outline" size={16} color="#f59e0b" />
                  </View>
                  <View style={{ flex: 1, flexShrink: 1 }}>
                    <Text style={styles.logTitle}>{log.serviceType}</Text>
                    <Text style={styles.logSub} numberOfLines={1}>
                      {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {log.notes ? ` · ${log.notes}` : ''}
                    </Text>
                  </View>
                </View>
                <Text style={styles.logAmount}>{formatCurrency(log.amount)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      {!showForm && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowForm(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      )}
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
    gap: spacing.stackGapLg,
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: '#0f0f1a',
    borderColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 20,
    gap: 4,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  formCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 16,
    gap: 14,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  formSection: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: colors.background,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.onSurface,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: colors.background,
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: rounded.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: `${colors.primary}25`,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primaryContainer,
    borderRadius: rounded.DEFAULT,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelBtnText: {
    color: colors.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 14,
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
  logAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
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
});
