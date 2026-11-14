/**
 * VehicleSpendScreen — per-vehicle service log with a quick-add form and
 * filter by vehicle.
 *
 * Restyled to the same Meridian v2 service-history layout (s7 family) as
 * the All Maintenance screen: a total spend panel and a timeline of the
 * vehicle's service records. The inline quick-add form still works.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  EmptyState,
  IconTile,
  Label,
  PressScale,
  Rise,
  Screen,
  TimelineItem,
} from '../../../shared/components/meridian';
import { useGarageStore } from '../store';
import { GarageStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'VehicleSpend'>;

const SERVICE_TYPES = ['General Service', 'Insurance', 'Part Change', 'Tyre Change', 'PUC', 'AMC', 'Water Wash', 'Battery'];

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

  const serviceIcon = (log: (typeof vehicleMaint)[number]) => {
    const type = (log.serviceType || '').toLowerCase();
    if (type.includes('oil')) return 'water-outline' as const;
    return 'construct-outline' as const;
  };

  const serviceColor = (log: (typeof vehicleMaint)[number]) => {
    const type = (log.serviceType || '').toLowerCase();
    if (type.includes('oil')) return mc.sky;
    if (type.includes('general')) return mc.violet;
    return mc.amber;
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
    <Screen bottomInset={40}>
      {/* Header */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale onPress={() => navigation.goBack()} scale={0.9} style={styles.iconButton} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <Text style={styles.appBarTitle}>Vehicle spend</Text>
          <PressScale
            onPress={() => setShowForm((v) => !v)}
            scale={0.92}
            style={styles.fabCircle}
            accessibilityLabel={showForm ? 'Close quick add' : 'Add service record'}
          >
            <Ionicons name={showForm ? 'close' : 'add'} size={19} color={mc.white} />
          </PressScale>
        </View>
      </Rise>

      {/* Vehicle chips */}
      <Rise index={1}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.vehicleRow, vehicles.length <= 1 && styles.vehicleRowCentered]}
        >
          {vehicles.map((v) => {
            const isSelected = selectedVehicle === v;
            return (
              <PressScale key={v} onPress={() => setSelectedVehicle(v)} scale={0.96}>
                <View style={[styles.vehicleChip, isSelected && styles.vehicleChipActive]}>
                  <Ionicons
                    name="bicycle-outline"
                    size={15}
                    color={isSelected ? mc.redSoft : mc.textDim}
                  />
                  <Text style={[styles.vehicleChipText, isSelected && styles.vehicleChipTextActive]} numberOfLines={1}>
                    {v}
                  </Text>
                </View>
              </PressScale>
            );
          })}
        </ScrollView>
      </Rise>

      {/* Total spend */}
      <Rise index={2}>
        <Card>
          <View style={styles.spendRow}>
            <View style={styles.spendMain}>
              <Label>TOTAL SERVICE SPEND</Label>
              <Text style={styles.spendValue}>{formatCurrency(totalSpend)}</Text>
              <Text style={styles.spendSub}>
                {vehicleMaint.length} log{vehicleMaint.length !== 1 ? 's' : ''} for {selectedVehicle ?? 'vehicle'}
              </Text>
            </View>
            <PressScale
              onPress={() => setShowForm((v) => !v)}
              scale={0.95}
              style={styles.addBtn}
              accessibilityLabel="Log service"
            >
              <Ionicons name="construct-outline" size={15} color={mc.white} />
              <Text style={styles.addBtnText}>{showForm ? 'Close' : 'Add service'}</Text>
            </PressScale>
          </View>
        </Card>
      </Rise>

      {/* Quick-add form */}
      {showForm ? (
        <Rise index={3}>
          <Card style={styles.formCard}>
            <Label>LOG SERVICE EXPENSE</Label>
            <View style={styles.formSection}>
              <Label small style={styles.inputLabel}>AMOUNT (₹)</Label>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 1500"
                placeholderTextColor={mc.textGhost}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
            <View style={styles.formSection}>
              <Label small style={styles.inputLabel}>SERVICE TYPE</Label>
              <View style={styles.chipRow}>
                {SERVICE_TYPES.map((st) => {
                  const isSelected = serviceType === st;
                  return (
                    <PressScale
                      key={st}
                      onPress={() => setServiceType(st)}
                      scale={0.95}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{st}</Text>
                    </PressScale>
                  );
                })}
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="Or type a custom service..."
                placeholderTextColor={mc.textGhost}
                value={serviceType}
                onChangeText={setServiceType}
              />
            </View>
            <View style={styles.formSection}>
              <Label small style={styles.inputLabel}>NOTES (OPTIONAL)</Label>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Changed engine oil at 5000km"
                placeholderTextColor={mc.textGhost}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
            <View style={styles.formActions}>
              <PressScale onPress={() => setShowForm(false)} scale={0.97} style={styles.cancelBtn} accessibilityLabel="Cancel">
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </PressScale>
              <PressScale onPress={handleAdd} scale={0.97} style={styles.saveBtn} accessibilityLabel="Save service record">
                <Text style={styles.saveBtnText}>Save</Text>
              </PressScale>
            </View>
          </Card>
        </Rise>
      ) : null}

      {/* Service history timeline */}
      {vehicleMaint.length > 0 ? (
        <Rise index={4}>
          <Label style={styles.sectionTitle}>SERVICE HISTORY</Label>
          {vehicleMaint.map((log, idx) => (
            <TimelineItem
              key={log.id}
              color={serviceColor(log)}
              last={idx === vehicleMaint.length - 1}
              style={styles.timelineItem}
            >
              <Card style={styles.timelineCard}>
                <IconTile icon={serviceIcon(log)} color={serviceColor(log)} size={38} radius={13} />
                <View style={styles.timelineMain}>
                  <Text style={styles.logTitle} numberOfLines={1}>
                    {log.serviceType}
                  </Text>
                  <Text style={styles.logSub} numberOfLines={1}>
                    {typeof log.odometer === 'number' && log.odometer > 0
                      ? `${log.odometer.toLocaleString('en-IN')} km · `
                      : ''}
                    {log.notes ? log.notes : log.vehicle}
                  </Text>
                </View>
                <View style={styles.timelineRight}>
                  <Text style={styles.logAmount}>{formatCurrency(log.amount)}</Text>
                  <Text style={styles.logDate}>
                    {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </Card>
            </TimelineItem>
          ))}
        </Rise>
      ) : (
        <Rise index={4}>
          <EmptyState
            icon="construct-outline"
            title="No service logs yet"
            subtitle="Add your first service record above"
          />
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
    height: 52,
    paddingHorizontal: 2,
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
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },
  fabCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Vehicle chips
  vehicleRow: {
    gap: 8,
    paddingHorizontal: 2,
  },
  vehicleRowCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.card,
    borderRadius: mr.chip,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    maxWidth: 140,
  },
  vehicleChipTextActive: {
    color: mc.redSoft,
    fontWeight: '600',
  },

  // Total spend card
  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  spendMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
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
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: mc.red,
    borderRadius: mr.chip,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: mc.white,
  },

  // Quick-add form
  formCard: {
    gap: 12,
  },
  formSection: {
    gap: 6,
  },
  inputLabel: {
    paddingHorizontal: 4,
  },
  textInput: {
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: mc.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: mc.raised,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: mc.redDim,
    borderColor: mc.redDim,
  },
  chipText: {
    fontSize: 13,
    color: mc.textDim,
  },
  chipTextActive: {
    color: mc.redSoft,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  saveBtn: {
    flex: 1.4,
    backgroundColor: mc.red,
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.white,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: mc.raised,
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: mc.textDim,
  },

  // Timeline
  sectionTitle: {
    paddingHorizontal: 4,
    marginTop: 2,
  },
  timelineItem: {
    marginBottom: 10,
  },
  timelineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  timelineMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  logTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },
  logSub: {
    fontSize: 12,
    color: mc.textDim,
  },
  timelineRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  logAmount: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },
  logDate: {
    fontSize: 11,
    color: mc.textDim,
  },
});
