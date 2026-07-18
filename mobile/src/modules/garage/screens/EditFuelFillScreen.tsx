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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useGarageStore } from '../store';
import { GarageStackParamList } from '../../../navigation/RootNavigator';

type EditFuelFillRouteProp = RouteProp<GarageStackParamList, 'EditFuelFill'>;
type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'EditFuelFill'>;

export default function EditFuelFillScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EditFuelFillRouteProp>();
  const { fillId } = route.params;

  const { fills, vehicles, editFuelFill } = useGarageStore();
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
  const [note, setNote] = useState(fill.note || '');

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

    editFuelFill(fill.id, {
      vehicle: selectedVehicle,
      amount: totalAmountInPaise,
      liters: rawLiters,
      pricePerLiter: priceInPaise,
      odometer: rawOdo,
      station: station.trim() || undefined,
      note: note.trim() || undefined,
    });

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
            <TextInput
              style={styles.textInput}
              placeholder="e.g. HPCL Kondapur"
              placeholderTextColor={colors.onSurfaceVariant}
              value={station}
              onChangeText={setStation}
            />
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
});
