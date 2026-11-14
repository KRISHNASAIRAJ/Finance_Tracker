/**
 * AddFuelFillScreen — form to log a new fuel fill with amount, liters, odometer,
 * station, and automatic transaction creation.
 *
 * Restyled to the Meridian v2 reference (s27): a large title, flat fields,
 * a vehicle chip, a station dropdown, a PAID VIA segmented row and a
 * sky-tinted estimated-total panel. All logic is unchanged.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { Label, PressScale, Screen } from '../../../shared/components/meridian';
import { useGarageStore } from '../store';
import { GarageStackParamList } from '../../../navigation/RootNavigator';
import { useAuth } from '../../../services/AuthProvider';
import CalendarPicker from '../../../shared/components/CalendarPicker';

type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'AddFuelFill'>;

const STATION_OPTIONS = ['HPCL Kondapur', 'HPCL Moinabad', 'Other'];

/** How the fill was paid — "HP Pay" spends the HP Pay wallet. */
const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI' },
  { id: 'card', label: 'Card' },
  { id: 'hp_pay', label: 'HP Pay' },
] as const;

/** Last recorded price/liter (rupees, editable text) for the vehicle, or ''. */
function lastFuelPriceText(vehicle?: string): string {
  if (!vehicle) return '';
  const paise = useGarageStore.getState().getLastFuelPrice(vehicle);
  if (!paise) return '';
  return (paise / 100).toFixed(2);
}

export default function AddFuelFillScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { vehicles, addFuelFill } = useGarageStore();
  const { user } = useAuth();

  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]);
  const [liters, setLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState(() => lastFuelPriceText(vehicles[0]));
  const [odometer, setOdometer] = useState('');
  const [station, setStation] = useState('');
  const [showStationDropdown, setShowStationDropdown] = useState(false);
  const [customStation, setCustomStation] = useState('');
  const [fillDate, setFillDate] = useState(new Date());
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [paymentMode, setPaymentMode] = useState<(typeof PAYMENT_MODES)[number]['id']>('cash');

  const selectVehicle = (v: string) => {
    const suggestion = lastFuelPriceText(v);
    setPricePerLiter((prev) =>
      prev.trim() === '' || prev === lastFuelPriceText(selectedVehicle) ? suggestion : prev
    );
    setSelectedVehicle(v);
  };

  const calculatedTotal = () => {
    const l = parseFloat(liters);
    const p = parseFloat(pricePerLiter);
    if (isNaN(l) || isNaN(p)) return '₹0.00';
    return `₹${(l * p).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  };

  const handleSubmit = () => {
    if (!selectedVehicle) {
      alert('Please add a vehicle first before logging a fuel fill.');
      return;
    }
    const rawLiters = parseFloat(liters);
    const rawPrice = parseFloat(pricePerLiter);
    const rawOdo = parseInt(odometer, 10);

    if (isNaN(rawLiters) || rawLiters <= 0) {
      alert('Please enter valid liters');
      return;
    }
    if (isNaN(rawPrice) || rawPrice <= 0) {
      alert('Please enter a valid price per liter');
      return;
    }
    if (isNaN(rawOdo) || rawOdo <= 0) {
      alert('Please enter a valid odometer reading');
      return;
    }

    const priceInPaise = Math.round(rawPrice * 100);
    const totalAmountInPaise = Math.round(rawLiters * priceInPaise);

    const finalStation = station === 'Other' ? customStation.trim() : station;

    addFuelFill(
      {
        vehicle: selectedVehicle,
        amount: totalAmountInPaise,
        liters: rawLiters,
        pricePerLiter: priceInPaise,
        odometer: rawOdo,
        station: finalStation || undefined,
        date: fillDate.toISOString(),
        paymentMode,
      },
      user?.id
    );
    navigation.goBack();
  };

  return (
    <Screen scroll={false} bottomInset={0}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Large title */}
        <View style={styles.formHeader}>
          <Text style={styles.headerTitle}>Log fuel fill</Text>
          <Text style={styles.headerSubtitle}>Mileage is calculated for you</Text>
        </View>

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
              {vehicles.map((v) => {
                const isSelected = selectedVehicle === v;
                return (
                  <PressScale
                    key={v}
                    onPress={() => selectVehicle(v)}
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

          {/* Fuel station dropdown */}
          <View style={styles.formSection}>
            <Label style={styles.sectionLabel}>FUEL STATION</Label>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowStationDropdown((v) => !v)}
              activeOpacity={0.7}
              accessibilityLabel="Choose fuel station"
            >
              <Text style={[styles.dropdownText, !station && styles.dropdownPlaceholder]}>
                {station || 'Select fuel station'}
              </Text>
              <Ionicons
                name={showStationDropdown ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={mc.textDim}
              />
            </TouchableOpacity>
            {showStationDropdown && (
              <View style={styles.dropdownMenu}>
                {STATION_OPTIONS.map((opt) => {
                  const isSelected = station === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setStation(opt);
                        setShowStationDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, isSelected && { color: mc.redSoft, fontWeight: '600' }]}>
                        {opt}
                      </Text>
                      {isSelected ? <Ionicons name="checkmark" size={14} color={mc.redSoft} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {station === 'Other' && (
              <TextInput
                style={[styles.textInput, { marginTop: 8 }]}
                placeholder="Enter petrol bunk name"
                placeholderTextColor={mc.textGhost}
                value={customStation}
                onChangeText={setCustomStation}
              />
            )}
          </View>

          {/* Liters + price */}
          <View style={styles.gridInputs}>
            <View style={[styles.formSection, { flex: 1 }]}>
              <Label style={styles.sectionLabel}>LITERS</Label>
              <TextInput
                style={styles.textInput}
                placeholder="0.00"
                placeholderTextColor={mc.textGhost}
                keyboardType="decimal-pad"
                value={liters}
                onChangeText={setLiters}
              />
            </View>
            <View style={[styles.formSection, { flex: 1 }]}>
              <Label style={styles.sectionLabel}>PRICE PER LITER</Label>
              <TextInput
                style={styles.textInput}
                placeholder="115.62"
                placeholderTextColor={mc.textGhost}
                keyboardType="decimal-pad"
                value={pricePerLiter}
                onChangeText={setPricePerLiter}
              />
            </View>
          </View>

          {/* Odometer */}
          <View style={styles.formSection}>
            <Label style={styles.sectionLabel}>ODOMETER (KM)</Label>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 5300"
              placeholderTextColor={mc.textGhost}
              keyboardType="number-pad"
              value={odometer}
              onChangeText={setOdometer}
            />
          </View>

          {/* Date */}
          <View style={styles.formSection}>
            <Label style={styles.sectionLabel}>DATE</Label>
            <TouchableOpacity
              style={styles.dateTrigger}
              onPress={() => setCalendarVisible(true)}
              activeOpacity={0.8}
              accessibilityLabel="Choose fill date"
            >
              <Ionicons name="calendar-outline" size={17} color={mc.sky} />
              <Text style={styles.dateTriggerText}>
                {fillDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Paid via segmented */}
          <View style={styles.formSection}>
            <Label style={styles.sectionLabel}>PAID VIA</Label>
            <View style={styles.segmented}>
              {PAYMENT_MODES.map((m) => {
                const isSelected = paymentMode === m.id;
                return (
                  <PressScale
                    key={m.id}
                    onPress={() => setPaymentMode(m.id)}
                    scale={0.97}
                    style={[styles.segment, isSelected && styles.segmentActive]}
                    accessibilityLabel={`Pay with ${m.label}`}
                  >
                    <Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>{m.label}</Text>
                  </PressScale>
                );
              })}
            </View>
            {paymentMode === 'hp_pay' && (
              <Text style={styles.hintText}>The HP Pay wallet balance goes down by this amount.</Text>
            )}
          </View>

          {/* Estimated total */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Estimated total</Text>
            <Text style={styles.summaryValue}>{calculatedTotal()}</Text>
          </View>

          {/* Actions */}
          <PressScale style={styles.submitButton} onPress={handleSubmit} scale={0.98} accessibilityLabel="Log fuel purchase">
            <Text style={styles.submitButtonText}>Log fuel purchase</Text>
          </PressScale>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <CalendarPicker
        visible={calendarVisible}
        selected={fillDate}
        onSelect={setFillDate}
        onClose={() => setCalendarVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  formHeader: {
    paddingHorizontal: 2,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '500',
    color: mc.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 2,
    paddingBottom: 40,
    gap: 16,
  },
  formSection: {
    gap: 8,
  },
  sectionLabel: {
    paddingHorizontal: 4,
  },
  gridInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 2,
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
  textInput: {
    backgroundColor: mc.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: mc.text,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: mc.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdownText: {
    fontSize: 15,
    color: mc.text,
  },
  dropdownPlaceholder: {
    color: mc.textGhost,
  },
  dropdownMenu: {
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingVertical: 4,
    marginTop: 2,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 15,
    color: mc.text,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateTriggerText: {
    fontSize: 15,
    color: mc.text,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: mc.card,
    borderRadius: 20,
    padding: 4,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 16,
  },
  segmentActive: {
    backgroundColor: mc.red,
  },
  segmentText: {
    fontSize: 13,
    color: mc.textDim,
  },
  segmentTextActive: {
    color: mc.white,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 11,
    color: mc.textDim,
    paddingHorizontal: 4,
  },
  summaryCard: {
    backgroundColor: mc.skyDim,
    borderRadius: mr.row,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: mc.sky,
    opacity: 0.85,
  },
  summaryValue: {
    fontSize: 34,
    fontWeight: '500',
    color: mc.sky,
  },
  submitButton: {
    backgroundColor: mc.red,
    borderRadius: 22,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 2,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: mc.white,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    color: mc.textDim,
  },
});
