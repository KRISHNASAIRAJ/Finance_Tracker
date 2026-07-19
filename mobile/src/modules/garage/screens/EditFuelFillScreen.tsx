import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import CalendarPicker from '../../../shared/components/CalendarPicker';
import { useGarageStore } from '../store';
import { GarageStackParamList } from '../../../navigation/RootNavigator';
import { useAuth } from '../../../services/AuthProvider';

type EditFuelFillRouteProp = RouteProp<GarageStackParamList, 'EditFuelFill'>;
type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'EditFuelFill'>;

const STATION_OPTIONS = ['HPCL Kondapur', 'HPCL Moinabad', 'Other'];

export default function EditFuelFillScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EditFuelFillRouteProp>();
  const { fillId } = route.params;

  const { fills, vehicles, editFuelFill, deleteFuelFill } = useGarageStore();
  const { user } = useAuth();
  const fill = fills.find((f) => f.id === fillId);

  if (!fill) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Fuel log not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const [selectedVehicle, setSelectedVehicle] = useState(fill.vehicle);
  const [liters, setLiters] = useState(fill.liters.toString());
  const [pricePerLiter, setPricePerLiter] = useState((fill.pricePerLiter / 100).toString());
  const [odometer, setOdometer] = useState(fill.odometer.toString());
  const [station, setStation] = useState(fill.station || '');
  const [showStationDropdown, setShowStationDropdown] = useState(false);
  const [customStation, setCustomStation] = useState(
    STATION_OPTIONS.includes(fill.station || '') ? '' : (fill.station || '')
  );
  const [note, setNote] = useState(fill.note || '');
  const [fillDate, setFillDate] = useState(new Date(fill.date));
  const [calendarVisible, setCalendarVisible] = useState(false);

  const handleSubmit = () => {
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

    editFuelFill(fill.id, {
      vehicle: selectedVehicle,
      amount: totalAmountInPaise,
      liters: rawLiters,
      pricePerLiter: priceInPaise,
      odometer: rawOdo,
      station: finalStation || undefined,
      note: note.trim() || undefined,
      date: fillDate.toISOString(),
    }, user?.id);

    navigation.goBack();
  };

  // Dynamically calculate estimated total cost
  const calculatedTotal = () => {
    const l = parseFloat(liters);
    const p = parseFloat(pricePerLiter);
    if (isNaN(l) || isNaN(p)) return '₹0.00';
    return `₹${(l * p).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.formHeader}>
            <Text style={styles.headerTitle}>Edit Fuel Fill</Text>
            <Text style={styles.headerSubtitle}>Modify details or location</Text>
          </View>

          {/* Vehicle Selector */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>SELECT VEHICLE</Text>
            <View style={styles.tabRow}>
              {vehicles.map((v) => {
                const isSelected = selectedVehicle === v;
                return (
                  <TouchableOpacity
                    key={v}
                    style={[styles.tabButton, isSelected && styles.tabButtonActive]}
                    onPress={() => setSelectedVehicle(v)}
                  >
                    <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>{v}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Input Fields */}
          <View style={styles.gridInputs}>
            <View style={[styles.formSection, { flex: 1 }]}>
              <Text style={styles.inputLabel}>LITERS</Text>
              <TextInput
                style={styles.textInput}
                placeholder="0.00"
                placeholderTextColor={colors.onSurfaceVariant}
                keyboardType="decimal-pad"
                value={liters}
                onChangeText={setLiters}
              />
            </View>

            <View style={[styles.formSection, { flex: 1 }]}>
              <Text style={styles.inputLabel}>PRICE / LITER</Text>
              <TextInput
                style={styles.textInput}
                placeholder="₹0.00"
                placeholderTextColor={colors.onSurfaceVariant}
                keyboardType="decimal-pad"
                value={pricePerLiter}
                onChangeText={setPricePerLiter}
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>ODOMETER READING (KM)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 42150"
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="number-pad"
              value={odometer}
              onChangeText={setOdometer}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>FUEL STATION / BRAND</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowStationDropdown(!showStationDropdown)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dropdownText, !station && styles.dropdownPlaceholder]}>
                {station || 'Select fuel station'}
              </Text>
              <Ionicons
                name={showStationDropdown ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>
            {showStationDropdown && (
              <View style={styles.dropdownMenu}>
                {STATION_OPTIONS.map((opt) => {
                  const isSelected = station === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                      onPress={() => { setStation(opt); setShowStationDropdown(false); }}
                    >
                      <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {station === 'Other' && (
              <TextInput
                style={[styles.textInput, { marginTop: 8 }]}
                placeholder="Enter petrol bunk name"
                placeholderTextColor={colors.onSurfaceVariant}
                value={customStation}
                onChangeText={setCustomStation}
              />
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>NOTES / FEEDBACK</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Traffic was bad, Good mileage"
              placeholderTextColor={colors.onSurfaceVariant}
              value={note}
              onChangeText={setNote}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>FILL DATE</Text>
            <TouchableOpacity
              style={styles.datePickerTrigger}
              onPress={() => setCalendarVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.datePickerText}>
                {fillDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dynamic Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Amount</Text>
            <Text style={styles.summaryValue}>{calculatedTotal()}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>Save Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert(
                  'Delete Fuel Fill',
                  'Are you sure you want to delete this fuel log? This action cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        deleteFuelFill(fill.id, user?.id);
                        navigation.goBack();
                      },
                    },
                  ],
                );
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.deleteButtonText}>Delete Fuel Fill</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <CalendarPicker
        visible={calendarVisible}
        selected={fillDate}
        onSelect={setFillDate}
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
  keyboardView: {
    flex: 1,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: rounded.DEFAULT,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
  },
  formHeader: {
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.onSurface,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  formSection: {
    gap: spacing.stackGapSm,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: rounded.DEFAULT,
  },
  tabButtonActive: {
    backgroundColor: colors.primaryContainer,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: colors.onSurface,
  },
  gridInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  textInput: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.onSurface,
    fontSize: 16,
  },
  summaryCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.onSurface,
  },
  buttonContainer: {
    gap: spacing.stackGapSm,
    marginTop: 16,
  },
  submitButton: {
    backgroundColor: colors.primaryContainer,
    borderRadius: rounded.DEFAULT,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${colors.error}40`,
    borderRadius: rounded.DEFAULT,
    marginTop: 20,
  },
  deleteButtonText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
  },
  dropdownButton: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: colors.onSurface,
    fontWeight: '500',
  },
  dropdownPlaceholder: {
    color: colors.onSurfaceVariant,
    fontWeight: '400',
  },
  dropdownMenu: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: rounded.DEFAULT,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  dropdownItemActive: {
    backgroundColor: `${colors.primary}20`,
  },
  dropdownItemText: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  datePickerTrigger: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  datePickerText: {
    fontSize: 16,
    color: colors.onSurface,
    fontWeight: '500',
  },
});
