/**
 * AllMaintenanceScreen — service history for one vehicle.
 *
 * Restyled to the Meridian v2 reference: a "next service due" panel with a
 * semicircle gauge, the total service spend and a timeline of every log.
 */
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  Fab,
  IconTile,
  Label,
  PressScale,
  Rise,
  Screen,
  SemicircleGauge,
  TimelineItem,
} from '../../../shared/components/meridian';
import {
  useGarageStore,
  getNextServiceInfo,
  isGeneralService,
  type MaintenanceLog,
} from '../store';

type NavigationProp = NativeStackNavigationProp<any>;

const formatCurrency = (paise: number) => {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export default function AllMaintenanceScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { vehicles, fills, maintenance, serviceReminderSettings, setServiceReminderSettings } =
    useGarageStore();
  const [selectedVehicle, setSelectedVehicle] = React.useState(vehicles[0]);
  const [reminderModalVisible, setReminderModalVisible] = React.useState(false);
  const [intervalKmInput, setIntervalKmInput] = React.useState('3000');
  const [intervalMonthsInput, setIntervalMonthsInput] = React.useState('3');

  React.useEffect(() => {
    if (!selectedVehicle && vehicles.length > 0) {
      setSelectedVehicle(vehicles[0]);
    }
  }, [vehicles, selectedVehicle]);

  React.useEffect(() => {
    const s = serviceReminderSettings[selectedVehicle];
    setIntervalKmInput(String(s?.intervalKm ?? 3000));
    setIntervalMonthsInput(String(s?.intervalMonths ?? 3));
  }, [selectedVehicle, serviceReminderSettings]);

  const vehicleMaint = maintenance
    .filter((m) => m.vehicle === selectedVehicle)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalMaintSpend = vehicleMaint.reduce((sum, m) => sum + m.amount, 0);

  const vehicleFills = fills.filter((f) => f.vehicle === selectedVehicle);
  const currentOdometer =
    vehicleFills.length > 0 ? Math.max(...vehicleFills.map((f) => f.odometer || 0)) : 0;

  const reminderSettings = serviceReminderSettings[selectedVehicle];
  const nextService = getNextServiceInfo(
    selectedVehicle,
    maintenance,
    currentOdometer,
    reminderSettings
  );

  // The baseline of the current interval: the newest General Service that
  // has an odometer reading. It is what the gauge measures against.
  const lastService = vehicleMaint
    .filter((m) => isGeneralService(m.serviceType) && m.odometer && m.odometer > 0)
    .sort((a, b) => (b.odometer ?? 0) - (a.odometer ?? 0))[0];
  const intervalKm = reminderSettings?.intervalKm ?? 3000;
  const kmLeft =
    nextService?.dueKm != null ? nextService.dueKm - currentOdometer : null;
  const intervalUsedPct =
    lastService?.odometer != null && intervalKm > 0
      ? Math.min(1, Math.max(0, (currentOdometer - lastService.odometer) / intervalKm))
      : 0;

  const openReminderModal = () => {
    const s = serviceReminderSettings[selectedVehicle];
    setIntervalKmInput(String(s?.intervalKm ?? 3000));
    setIntervalMonthsInput(String(s?.intervalMonths ?? 3));
    setReminderModalVisible(true);
  };

  const saveReminderSettings = () => {
    const km = Math.round(parseFloat(intervalKmInput));
    const months = Math.round(parseFloat(intervalMonthsInput));
    if (!isNaN(km) && km > 0 && !isNaN(months) && months > 0) {
      setServiceReminderSettings(selectedVehicle, { intervalKm: km, intervalMonths: months });
    }
    setReminderModalVisible(false);
  };

  const serviceDueSoon = nextService
    ? (nextService.dueKm !== null && nextService.dueKm - currentOdometer <= 200) ||
      new Date() >= new Date(nextService.dueDate.getTime() - 14 * 86400000)
    : false;

  const serviceIcon = (log: MaintenanceLog) => {
    const type = (log.serviceType || '').toLowerCase();
    if (type.includes('oil')) return 'water-outline' as const;
    if (type.includes('general')) return 'construct-outline' as const;
    return 'construct-outline' as const;
  };

  const serviceColor = (log: MaintenanceLog) => {
    const type = (log.serviceType || '').toLowerCase();
    if (type.includes('oil')) return mc.sky;
    if (type.includes('general')) return mc.violet;
    return mc.amber;
  };

  return (
    <Screen bottomInset={40}>
      {/* Header */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale onPress={() => navigation.goBack()} scale={0.9} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <Text style={styles.appBarTitle}>Service history</Text>
          <Fab
            icon="add"
            size={38}
            onPress={() => navigation.navigate('AddMaintenance', {})}
            accessibilityLabel="Add service"
          />
        </View>
      </Rise>

      {/* Vehicle picker */}
      <Rise index={1}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.vehicleRow,
            vehicles.length <= 1 && styles.vehicleRowCentered,
          ]}
        >
          {vehicles.map((v) => {
            const isSelected = selectedVehicle === v;
            return (
              <PressScale key={v} onPress={() => setSelectedVehicle(v)} scale={0.96}>
                <View style={[styles.vehicleChip, isSelected && styles.vehicleChipActive]}>
                  <Ionicons
                    name="bicycle-outline"
                    size={15}
                    color={isSelected ? mc.red : mc.textDim}
                  />
                  <Text style={[styles.vehicleChipText, isSelected && styles.vehicleChipTextActive]}>
                    {v}
                  </Text>
                </View>
              </PressScale>
            );
          })}
        </ScrollView>
      </Rise>

      {/* Next service due */}
      <Rise index={2}>
        <Card tone={serviceDueSoon ? 'red' : 'default'}>
          <View style={styles.serviceHeader}>
            <View style={styles.serviceHeaderLeft}>
              <Ionicons
                name="construct-outline"
                size={14}
                color={serviceDueSoon ? mc.redSoft : mc.textDim}
              />
              <Label color={serviceDueSoon ? mc.redSoft : mc.textDim}>NEXT SERVICE DUE</Label>
            </View>
            <PressScale onPress={openReminderModal} scale={0.95} style={styles.editReminderBtn}>
              <Ionicons name="create-outline" size={12} color={mc.textDim} />
              <Text style={styles.editReminderText}>Edit</Text>
            </PressScale>
          </View>

          {nextService ? (
            <View style={styles.serviceBody}>
              <SemicircleGauge
                progress={intervalUsedPct}
                width={150}
                height={80}
                stroke={12}
                color={serviceDueSoon ? mc.redSoft : mc.red}
                trackColor={mc.redDim}
              >
                <Text style={styles.gaugeValue}>{Math.round(intervalUsedPct * 100)}%</Text>
                <Text style={styles.gaugeCaption}>of interval used</Text>
              </SemicircleGauge>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceKmLeft}>
                  {kmLeft !== null ? `${Math.max(0, kmLeft).toLocaleString('en-IN')} km` : '—'}
                </Text>
                <Label small>LEFT</Label>
                {nextService.dueKm !== null ? (
                  <Text style={styles.serviceSub}>
                    Due at {nextService.dueKm.toLocaleString('en-IN')} km or{' '}
                    {nextService.dueDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                ) : (
                  <Text style={styles.serviceSub}>
                    Due by{' '}
                    {nextService.dueDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                )}
                <Text style={styles.serviceSub}>
                  Now at {currentOdometer.toLocaleString('en-IN')} km
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.serviceSub}>
              Log a &apos;General Service&apos; with an odometer reading to start reminders.
            </Text>
          )}

          {serviceDueSoon ? (
            <View style={styles.dueSoonBadge}>
              <Ionicons name="alert-circle" size={13} color={mc.redSoft} />
              <Text style={styles.dueSoonText}>Service due soon, book it now</Text>
            </View>
          ) : null}
        </Card>
      </Rise>

      {/* Total spend */}
      <Rise index={3}>
        <Card>
          <View style={styles.spendRow}>
            <View style={styles.spendMain}>
              <Label>TOTAL SERVICE SPEND</Label>
              <Text style={styles.spendValue}>{formatCurrency(totalMaintSpend)}</Text>
              <Text style={styles.spendSub}>
                {vehicleMaint.length} log{vehicleMaint.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <PressScale
              onPress={() => navigation.navigate('AddMaintenance', {})}
              scale={0.95}
              style={styles.addMaintBtn}
            >
              <Ionicons name="construct-outline" size={16} color={mc.white} />
              <Text style={styles.addMaintBtnText}>Add service</Text>
            </PressScale>
          </View>
        </Card>
      </Rise>

      {/* Timeline */}
      {vehicleMaint.length > 0 ? (
        <Rise index={4}>
          <Label style={styles.sectionTitle}>TIMELINE</Label>
          {vehicleMaint.map((log: MaintenanceLog, idx: number) => (
            <TimelineItem
              key={log.id}
              color={serviceColor(log)}
              last={idx === vehicleMaint.length - 1}
              style={styles.timelineItem}
            >
              <PressScale
                onPress={() => navigation.navigate('AddMaintenance', { maintenanceId: log.id })}
                scale={0.99}
              >
                <Card style={styles.timelineCard}>
                  <IconTile icon={serviceIcon(log)} color={serviceColor(log)} size={38} radius={13} />
                  <View style={styles.timelineMain}>
                    <Text style={styles.logTitle} numberOfLines={1}>
                      {log.serviceType}
                    </Text>
                    <Text style={styles.logSub} numberOfLines={1}>
                      {typeof log.odometer === 'number'
                        ? `${log.odometer.toLocaleString('en-IN')} km · `
                        : ''}
                      {log.notes ? log.notes : log.vehicle}
                    </Text>
                  </View>
                  <View style={styles.timelineRight}>
                    <Text style={styles.logAmount}>{formatCurrency(log.amount)}</Text>
                    <Text style={styles.logDate}>
                      {new Date(log.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                </Card>
              </PressScale>
            </TimelineItem>
          ))}
        </Rise>
      ) : (
        <Rise index={4}>
          <Card style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔧</Text>
            <Text style={styles.emptyText}>No service logs yet</Text>
            <PressScale
              onPress={() => navigation.navigate('AddMaintenance', {})}
              scale={0.96}
              style={styles.emptyAddBtn}
            >
              <Ionicons name="add-circle" size={17} color={mc.ink} />
              <Text style={styles.emptyAddBtnText}>Add first service</Text>
            </PressScale>
          </Card>
        </Rise>
      )}

      {/* Edit Service Reminder Modal */}
      <Modal
        visible={reminderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReminderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Service Reminder</Text>
            <Text style={styles.modalSub}>
              Only &apos;General Service&apos; logs count toward the next-service calculation.
            </Text>
            <Text style={styles.modalLabel}>INTERVAL (KM)</Text>
            <TextInput
              style={styles.modalInput}
              value={intervalKmInput}
              onChangeText={setIntervalKmInput}
              keyboardType="number-pad"
              placeholder="3000"
              placeholderTextColor={mc.textFaint}
            />
            <Text style={styles.modalLabel}>INTERVAL (MONTHS)</Text>
            <TextInput
              style={styles.modalInput}
              value={intervalMonthsInput}
              onChangeText={setIntervalMonthsInput}
              keyboardType="number-pad"
              placeholder="3"
              placeholderTextColor={mc.textFaint}
            />
            <View style={styles.modalButtons}>
              <PressScale onPress={() => setReminderModalVisible(false)} scale={0.96}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </PressScale>
              <PressScale onPress={saveReminderSettings} scale={0.96}>
                <Text style={styles.modalSaveText}>Save</Text>
              </PressScale>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    height: 52,
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
    flex: 1,
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },

  vehicleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  vehicleRowCentered: {
    justifyContent: 'center',
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.card,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  vehicleChipActive: {
    backgroundColor: mc.redDim,
  },
  vehicleChipText: {
    fontSize: 14,
    color: mc.textDim,
  },
  vehicleChipTextActive: {
    color: mc.text,
  },

  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editReminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editReminderText: {
    fontSize: 12,
    color: mc.textDim,
  },
  serviceBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  gaugeValue: {
    fontSize: 20,
    fontWeight: '500',
    color: mc.text,
  },
  gaugeCaption: {
    fontSize: 11,
    color: mc.textDim,
  },
  serviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  serviceKmLeft: {
    fontSize: 22,
    fontWeight: '500',
    color: mc.text,
  },
  serviceSub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 6,
  },
  dueSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: mc.redDim,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  dueSoonText: {
    fontSize: 13,
    color: mc.redSoft,
  },

  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spendMain: {
    flex: 1,
    minWidth: 0,
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
  },
  addMaintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.red,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  addMaintBtnText: {
    fontSize: 14,
    color: mc.white,
    fontWeight: '500',
  },

  sectionTitle: {
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  timelineItem: {
    marginBottom: 10,
  },
  timelineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  timelineMain: {
    flex: 1,
    minWidth: 0,
  },
  timelineRight: {
    alignItems: 'flex-end',
  },
  logTitle: {
    fontSize: 15,
    color: mc.text,
  },
  logSub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },
  logAmount: {
    fontSize: 15,
    color: mc.text,
  },
  logDate: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  emptyEmoji: {
    fontSize: 26,
  },
  emptyText: {
    fontSize: 14,
    color: mc.textDim,
    marginTop: 6,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.mint,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 14,
  },
  emptyAddBtnText: {
    fontSize: 14,
    color: mc.ink,
    fontWeight: '600',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: mc.card,
    borderRadius: mr.card,
    padding: 20,
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: mc.text,
  },
  modalSub: {
    fontSize: 12,
    color: mc.textDim,
  },
  modalLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: mc.textFaint,
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: mc.raised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: mc.text,
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 14,
    color: mc.textDim,
  },
  modalSaveText: {
    fontSize: 14,
    color: mc.redSoft,
    fontWeight: '600',
  },
});
