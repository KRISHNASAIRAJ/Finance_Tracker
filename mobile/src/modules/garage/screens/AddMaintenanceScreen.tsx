/**
 * AddMaintenanceScreen — form to log a vehicle service record with service type,
 * odometer, amount, and notes.
 *
 * Restyled to the Meridian v2 reference (s28): a top bar with a Save action,
 * a vehicle chip, icon service-type chips, flat fields and large type.
 * All save/edit logic is unchanged.
 */
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { Label, PressScale, Screen, TopBar } from '../../../shared/components/meridian';
import { useGarageStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { GarageStackParamList } from '../../../navigation/RootNavigator';
import CalendarPicker from '../../../shared/components/CalendarPicker';

type RouteProps = RouteProp<GarageStackParamList, 'AddMaintenance'>;

const SERVICE_TYPES: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'General Service', icon: 'construct-outline' },
  { label: 'Insurance', icon: 'shield-outline' },
  { label: 'Part Change', icon: 'settings-outline' },
  { label: 'Tyre Change', icon: 'ellipse-outline' },
  { label: 'PUC', icon: 'leaf-outline' },
  { label: 'AMC', icon: 'document-text-outline' },
  { label: 'Water Wash', icon: 'water-outline' },
  { label: 'Battery', icon: 'battery-charging-outline' },
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
    if (isEditing) {
      // Explicit assignment so clearing the field removes the old value
      // (spread-merge would otherwise keep the previous odometer).
      payload.odometer = typeof odoNum === 'number' ? odoNum : undefined;
    } else if (typeof odoNum === 'number') {
      payload.odometer = odoNum;
    }

    if (isEditing && editId) {
      editMaintenanceLog(editId, payload, user?.id);
    } else {
      addMaintenanceLog(payload, user?.id);
    }
    navigation.goBack();
  };

  return (
    <Screen scroll={false} bottomInset={0}>
      <TopBar
        title="Log service"
        onBack={() => navigation.goBack()}
        variant="center"
        right={
          <PressScale onPress={handleSave} scale={0.94} style={styles.saveChip} accessibilityLabel="Save">
            <Text style={styles.saveChipText}>Save</Text>
          </PressScale>
        }
      />

      <ScrollView
        style={styles.keyboardView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Vehicle chip */}
        <View style={styles.formSection}>
          <Label style={styles.sectionLabel}>VEHICLE</Label>
          <View style={styles.chipRow}>
            {vehicles.map((v: string) => {
              const isSelected = vehicle === v;
              return (
                <PressScale
                  key={v}
                  onPress={() => setVehicle(v)}
                  scale={0.95}
                  style={[styles.vehicleChip, isSelected && styles.vehicleChipActive]}
                  accessibilityLabel={`Select ${v}`}
                >
                  <Ionicons name="bicycle-outline" size={14} color={isSelected ? mc.redSoft : mc.textDim} />
                  <Text style={[styles.vehicleChipText, isSelected && styles.vehicleChipTextActive]} numberOfLines={1}>
                    {v}
                  </Text>
                </PressScale>
              );
            })}
          </View>
        </View>

        {/* Service type */}
        <View style={styles.formSection}>
          <Label style={styles.sectionLabel}>SERVICE TYPE</Label>
          <View style={styles.chipRow}>
            {SERVICE_TYPES.map(({ label, icon }) => {
              const isSelected = serviceType === label;
              return (
                <PressScale
                  key={label}
                  onPress={() => setServiceType(label)}
                  scale={0.95}
                  style={[styles.typeChip, isSelected && styles.typeChipActive]}
                  accessibilityLabel={`Service type ${label}`}
                >
                  <Ionicons name={icon} size={13} color={isSelected ? mc.redSoft : mc.textDim} />
                  <Text style={[styles.typeChipText, isSelected && styles.typeChipTextActive]}>
                    {label}
                  </Text>
                </PressScale>
              );
            })}
          </View>
        </View>

        {/* Amount */}
        <View style={styles.formSection}>
          <Label style={styles.sectionLabel}>AMOUNT (₹)</Label>
          <TextInput
            style={[styles.textInput, styles.amountInput]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="₹ 0.00"
            placeholderTextColor={mc.textGhost}
          />
        </View>

        {/* Odometer (optional) */}
        <View style={styles.formSection}>
          <Label style={styles.sectionLabel}>ODOMETER (KM), OPTIONAL</Label>
          <TextInput
            style={styles.textInput}
            value={odometer}
            onChangeText={setOdometer}
            keyboardType="number-pad"
            placeholder="e.g. 5600"
            placeholderTextColor={mc.textGhost}
          />
        </View>

        {/* Service date */}
        <View style={styles.formSection}>
          <Label style={styles.sectionLabel}>SERVICE DATE</Label>
          <TouchableOpacity
            style={styles.dateTrigger}
            onPress={() => setCalendarVisible(true)}
            activeOpacity={0.8}
            accessibilityLabel="Choose service date"
          >
            <Text style={styles.dateTriggerText}>
              {serviceDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <Ionicons name="calendar-outline" size={17} color={mc.amber} />
          </TouchableOpacity>
        </View>

        {/* Notes (optional) */}
        <View style={styles.formSection}>
          <Label style={styles.sectionLabel}>NOTES, OPTIONAL</Label>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Garage name, next due, and so on"
            placeholderTextColor={mc.textGhost}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  saveChip: {
    backgroundColor: mc.redDim,
    borderRadius: mr.chip,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  saveChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: mc.redSoft,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 40,
    gap: 18,
  },
  formSection: {
    gap: 8,
  },
  sectionLabel: {
    paddingHorizontal: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: mc.raised,
    borderRadius: mr.chip,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  vehicleChipActive: {
    backgroundColor: mc.redDim,
    borderColor: mc.redDim,
  },
  vehicleChipText: {
    fontSize: 13,
    color: mc.textDim,
  },
  vehicleChipTextActive: {
    color: mc.redSoft,
    fontWeight: '600',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.raised,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeChipActive: {
    backgroundColor: mc.redDim,
    borderColor: mc.redDim,
  },
  typeChipText: {
    fontSize: 13,
    color: mc.textDim,
  },
  typeChipTextActive: {
    color: mc.redSoft,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: mc.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: mc.text,
  },
  amountInput: {
    fontSize: 22,
    paddingVertical: 15,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: mc.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateTriggerText: {
    flex: 1,
    fontSize: 15,
    color: mc.text,
  },
  notesInput: {
    minHeight: 76,
    paddingTop: 13,
  },
});
