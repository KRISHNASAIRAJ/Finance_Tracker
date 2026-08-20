import React, { useState, useEffect } from 'react';
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useGarageStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { GarageStackParamList } from '../../../navigation/RootNavigator';
import CalendarPicker from '../../../shared/components/CalendarPicker';

type RouteProps = RouteProp<GarageStackParamList, 'AddMaintenance'>;

const SERVICE_TYPES = [
  'Oil Change',
  'Engine Oil',
  'Air Filter',
  'Spark Plug',
  'Chain Service',
  'Brake Service',
  'Tyre Change',
  'Battery',
  'General Service',
  'Wash & Polish',
  'Insurance',
  'PUC',
  'Other',
];

export default function AddMaintenanceScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const editId = route.params?.maintenanceId;
  const { user } = useAuth();
  const { vehicles, maintenance, addMaintenanceLog, editMaintenanceLog } = useGarageStore() as any;

  const isEditing = !!editId;

  const [vehicle, setVehicle] = useState(vehicles[0] || '');
  const [serviceType, setServiceType] = useState('');
  const [amount, setAmount] = useState('');
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date());
  const [calendarVisible, setCalendarVisible] = useState(false);

  useEffect(() => {
    if (isEditing) {
      const existing = maintenance.find((m: any) => m.id === editId);
      if (existing) {
        setVehicle(existing.vehicle);
        setServiceType(existing.serviceType);
        setAmount((existing.amount / 100).toString());
        if (typeof existing.odometer === 'number') setOdometer(existing.odometer.toString());
        setNotes(existing.notes || '');
        if (existing.date) setServiceDate(new Date(existing.date));
      }
    }
  }, [editId, isEditing, maintenance]);

  const handleSave = () => {
    const amountPaise = Math.round(parseFloat(amount) * 100);
    if (!vehicle || !serviceType || isNaN(amountPaise) || amountPaise <= 0) {
      alert('Please fill all required fields (vehicle, service type, amount)');
      return;
    }
    const odoNum = odometer.trim() ? Math.round(parseFloat(odometer)) : undefined;
    if (odometer.trim() && (isNaN(odoNum as number) || (odoNum as number) <= 0)) {
      alert('Enter a valid odometer reading (km)');
      return;
    }

    const payload: any = { vehicle, serviceType, amount: amountPaise, notes, date: serviceDate.toISOString() };
    if (typeof odoNum === 'number') payload.odometer = odoNum;

    if (isEditing && editId) {
      editMaintenanceLog(editId, payload, user?.id);
    } else {
      addMaintenanceLog(payload, user?.id);
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{isEditing ? 'Edit Service' : 'Log Service'}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{isEditing ? 'Update' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Vehicle Selector */}
        <View style={styles.field}>
          <Text style={styles.label}>VEHICLE</Text>
          <View style={styles.chipRow}>
            {vehicles.map((v: string) => (
              <TouchableOpacity
                key={v}
                style={[styles.chip, vehicle === v && styles.chipActive]}
                onPress={() => setVehicle(v)}
              >
                <Text style={[styles.chipText, vehicle === v && styles.chipTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Service Type */}
        <View style={styles.field}>
          <Text style={styles.label}>SERVICE TYPE</Text>
          <View style={styles.typeGrid}>
            {SERVICE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeChip, serviceType === type && styles.typeChipActive]}
                onPress={() => setServiceType(type)}
              >
                <Text style={[styles.typeChipText, serviceType === type && styles.typeChipTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Amount */}
        <View style={styles.field}>
          <Text style={styles.label}>AMOUNT ({'\u20B9'})</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.outline}
          />
        </View>

        {/* Odometer */}
        <View style={styles.field}>
          <Text style={styles.label}>ODOMETER (KM) — OPTIONAL</Text>
          <TextInput
            style={styles.input}
            value={odometer}
            onChangeText={setOdometer}
            keyboardType="number-pad"
            placeholder="e.g. 5600"
            placeholderTextColor={colors.outline}
          />
          <Text style={styles.hint}>Used for service reminders (next service = this + 3000 km)</Text>
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.label}>SERVICE DATE</Text>
          <TouchableOpacity
            style={[styles.input, styles.dateTrigger]}
            onPress={() => setCalendarVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.dateTriggerText}>
              {serviceDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>NOTES (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Garage name, next due, etc."
            placeholderTextColor={colors.outline}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <CalendarPicker
        visible={calendarVisible}
        selected={serviceDate}
        onSelect={(d) => {
          setServiceDate(d);
          setCalendarVisible(false);
        }}
        onClose={() => setCalendarVisible(false)}
      />
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
  appBarTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  iconButton: { padding: 8, borderRadius: rounded.full },
  saveBtn: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: rounded.DEFAULT,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  scrollContent: { padding: spacing.containerPadding, gap: 24, paddingBottom: 40 },
  field: { gap: 10 },
  label: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: rounded.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  chipTextActive: { color: colors.textPrimary },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipActive: { backgroundColor: `${colors.primary}20`, borderColor: colors.primary },
  typeChipText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  typeChipTextActive: { color: colors.primary },
  input: {
    backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    height: 48,
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: '600',
  },
  notesInput: { height: 80, paddingTop: 12 },
  hint: { fontSize: 11, color: colors.onSurfaceVariant },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTriggerText: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: '600',
  },
});
