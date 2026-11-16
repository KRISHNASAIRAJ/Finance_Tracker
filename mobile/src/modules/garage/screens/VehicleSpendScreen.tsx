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
import {
  useServiceIssuesStore,
  openIssuesFor,
  type ServiceIssueSeverity,
} from '../serviceIssuesStore';
import { useAuth } from '../../../services/AuthProvider';
import { GarageStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<GarageStackParamList, 'VehicleSpend'>;

const SERVICE_TYPES = ['General Service', 'Insurance', 'Part Change', 'Tyre Change', 'PUC', 'AMC', 'Water Wash', 'Battery'];

export default function VehicleSpendScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { vehicles, fills, maintenance, addMaintenanceLog } = useGarageStore();
  const { user } = useAuth();
  const issues = useServiceIssuesStore((s) => s.issues);
  const addIssue = useServiceIssuesStore((s) => s.addIssue);
  const toggleIssueFixed = useServiceIssuesStore((s) => s.toggleFixed);
  const deleteIssue = useServiceIssuesStore((s) => s.deleteIssue);
  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [notes, setNotes] = useState('');

  // The vehicle list hydrates asynchronously — derive a fallback so the first
  // frame already has a selection (no empty flash).
  const activeVehicle = selectedVehicle || vehicles[0];
  React.useEffect(() => {
    if (!selectedVehicle && vehicles.length > 0) setSelectedVehicle(vehicles[0]);
  }, [selectedVehicle, vehicles]);

  // Issues to tell the service centre about.
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueNotes, setIssueNotes] = useState('');
  const [issueSeverity, setIssueSeverity] = useState<ServiceIssueSeverity>('medium');
  const [issueOdo, setIssueOdo] = useState('');
  const [showFixed, setShowFixed] = useState(false);
  const openIssues = activeVehicle ? openIssuesFor(issues, activeVehicle) : [];
  const fixedIssues = activeVehicle
    ? issues
        .filter((i) => i.vehicle === activeVehicle && i.status === 'fixed')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    : [];
  const visibleIssues = showFixed ? [...openIssues, ...fixedIssues] : openIssues;

  const vehicleMaint = maintenance
    .filter((m) => m.vehicle === activeVehicle)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Vehicle spend = BOTH running costs: fuel fills + maintenance logs.
  // This matches the dashboard's PER KM tile (which divides fuel + service
  // by km), so the tile and this breakdown screen always agree. Fuel is
  // usually the largest running cost - leaving it out understated the
  // total several-fold.
  const vehicleFills = fills.filter((f) => f.vehicle === activeVehicle);
  const totalFuelSpend = vehicleFills.reduce((sum, f) => sum + f.amount, 0);
  const totalMaintSpend = vehicleMaint.reduce((sum, m) => sum + m.amount, 0);
  const totalSpend = totalFuelSpend + totalMaintSpend;

  // Cost per km — the same maths as the dashboard tile: total spend over
  // the odometer range actually covered.
  const odoSorted = [...vehicleFills].sort((a, b) => a.odometer - b.odometer);
  const totalKm =
    odoSorted.length >= 2 ? odoSorted[odoSorted.length - 1].odometer - odoSorted[0].odometer : 0;
  const costPerKm = totalKm > 0 ? totalSpend / 100 / totalKm : null;

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
      vehicle: activeVehicle,
      amount: Math.round(rawAmount * 100),
      serviceType: serviceType.trim(),
      notes: notes.trim() || undefined,
    });
    setAmount('');
    setServiceType('');
    setNotes('');
    setShowForm(false);
  };

  const handleAddIssue = () => {
    if (!activeVehicle) return;
    if (!issueTitle.trim()) {
      alert('Please describe the issue');
      return;
    }
    const odo = issueOdo.trim() ? Number(issueOdo) : null;
    if (issueOdo.trim() && (!Number.isFinite(odo) || (odo as number) < 0)) {
      alert('Enter a valid odometer reading');
      return;
    }
    addIssue(
      {
        vehicle: activeVehicle,
        title: issueTitle.trim(),
        notes: issueNotes.trim(),
        severity: issueSeverity,
        odometerKm: odo,
      },
      user?.id
    );
    setIssueTitle('');
    setIssueNotes('');
    setIssueSeverity('medium');
    setIssueOdo('');
    setShowIssueForm(false);
  };

  const severityColor = (s: ServiceIssueSeverity) =>
    s === 'high' ? mc.red : s === 'medium' ? mc.amber : mc.mint;

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
            const isSelected = activeVehicle === v;
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
              <Label>TOTAL SPEND</Label>
              <Text style={styles.spendValue}>{formatCurrency(totalSpend)}</Text>
              <Text style={styles.spendSub}>
                {formatCurrency(totalFuelSpend)} fuel + {formatCurrency(totalMaintSpend)}{' '}
                service · {vehicleMaint.length} service log
                {vehicleMaint.length !== 1 ? 's' : ''}
              </Text>
              {costPerKm !== null ? (
                <Text style={styles.spendSub}>
                  ₹{costPerKm.toFixed(2)} per km · {totalKm.toLocaleString('en-IN')} km covered
                </Text>
              ) : null}
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
              <PressScale onPress={() => setShowForm(false)} scale={0.97} style={styles.cancelBtn} wrapStyle={{ flex: 1 }} accessibilityLabel="Cancel">
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </PressScale>
              <PressScale onPress={handleAdd} scale={0.97} style={styles.saveBtn} wrapStyle={{ flex: 1.4 }} accessibilityLabel="Save service record">
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

      {/* Issues to report at the next service */}
      <Rise index={5}>
        <Card style={styles.issuesCard}>
          <View style={styles.issuesHead}>
            <View style={styles.issuesTitleWrap}>
              <IconTile icon="alert-circle-outline" color={mc.red} size={36} radius={12} />
              <View style={{ flex: 1 }}>
                <Label>ISSUES TO REPORT</Label>
                <Text style={styles.issuesSub}>
                  {openIssues.length} open · tell the service centre at the next service
                </Text>
              </View>
            </View>
            <PressScale
              onPress={() => setShowIssueForm((v) => !v)}
              scale={0.92}
              style={styles.issueAddBtn}
              accessibilityLabel={showIssueForm ? 'Close issue form' : 'Add issue'}
            >
              <Ionicons name={showIssueForm ? 'close' : 'add'} size={18} color={mc.white} />
            </PressScale>
          </View>

          {showIssueForm ? (
            <View style={styles.issueForm}>
              <TextInput
                style={styles.textInput}
                placeholder="What's the issue? e.g. squeaky front brake"
                placeholderTextColor={mc.textGhost}
                value={issueTitle}
                onChangeText={setIssueTitle}
              />
              <TextInput
                style={[styles.textInput, styles.issueNotesInput]}
                placeholder="Details (optional)"
                placeholderTextColor={mc.textGhost}
                value={issueNotes}
                onChangeText={setIssueNotes}
                multiline
              />
              <View style={styles.issueRow}>
                {(['low', 'medium', 'high'] as ServiceIssueSeverity[]).map((s) => (
                  <PressScale
                    key={s}
                    onPress={() => setIssueSeverity(s)}
                    scale={0.96}
                    style={[
                      styles.severityChip,
                      issueSeverity === s && { borderColor: severityColor(s) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.severityText,
                        issueSeverity === s && { color: severityColor(s) },
                      ]}
                    >
                      {s.toUpperCase()}
                    </Text>
                  </PressScale>
                ))}
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="Odometer in km (optional)"
                placeholderTextColor={mc.textGhost}
                keyboardType="numeric"
                value={issueOdo}
                onChangeText={setIssueOdo}
              />
              <PressScale onPress={handleAddIssue} scale={0.97} style={styles.saveBtn} accessibilityLabel="Save issue">
                <Text style={styles.saveBtnText}>SAVE ISSUE</Text>
              </PressScale>
            </View>
          ) : null}

          {visibleIssues.map((issue) => (
            <View key={issue.id} style={styles.issueRowItem}>
              <View style={[styles.severityDot, { backgroundColor: severityColor(issue.severity) }]} />
              <View style={styles.issueBody}>
                <Text
                  style={[
                    styles.issueTitle,
                    issue.status === 'fixed' && styles.issueTitleFixed,
                  ]}
                  numberOfLines={2}
                >
                  {issue.title}
                </Text>
                <Text style={styles.issueMeta} numberOfLines={2}>
                  {issue.notes}
                  {issue.odometerKm !== null
                    ? `${issue.notes ? ' · ' : ''}${issue.odometerKm.toLocaleString('en-IN')} km`
                    : ''}
                </Text>
              </View>
              <PressScale
                onPress={() => toggleIssueFixed(issue.id, user?.id)}
                scale={0.9}
                style={styles.issueCheck}
                accessibilityLabel={issue.status === 'open' ? 'Mark fixed' : 'Reopen issue'}
              >
                <Ionicons
                  name={issue.status === 'fixed' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={issue.status === 'fixed' ? mc.mint : mc.textDim}
                />
              </PressScale>
              <PressScale
                onPress={() => deleteIssue(issue.id, user?.id)}
                scale={0.9}
                style={styles.issueDelete}
                accessibilityLabel="Delete issue"
              >
                <Ionicons name="trash-outline" size={17} color={mc.textFaint} />
              </PressScale>
            </View>
          ))}

          {visibleIssues.length === 0 ? (
            <Text style={styles.issuesEmpty}>
              No issues noted. Add anything you want the service centre to check.
            </Text>
          ) : null}

          {fixedIssues.length > 0 ? (
            <PressScale onPress={() => setShowFixed((v) => !v)} scale={0.98}>
              <Text style={styles.showFixedText}>
                {showFixed ? 'Hide fixed' : `Show ${fixedIssues.length} fixed`}
              </Text>
            </PressScale>
          ) : null}
        </Card>
      </Rise>
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

  // Issues to report at next service
  issuesCard: {
    gap: 12,
    marginTop: 4,
  },
  issuesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  issuesTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  issuesSub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 3,
  },
  issueAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  issueForm: {
    gap: 10,
    paddingTop: 4,
  },
  issueNotesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  issueRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityChip: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: mc.lineSoft,
    paddingVertical: 8,
    alignItems: 'center',
  },
  severityText: {
    fontSize: 11,
    fontWeight: '600',
    color: mc.textDim,
  },
  issueRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: mc.line,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  issueBody: {
    flex: 1,
    minWidth: 0,
  },
  issueTitle: {
    fontSize: 14,
    color: mc.text,
  },
  issueTitleFixed: {
    color: mc.textFaint,
    textDecorationLine: 'line-through',
  },
  issueMeta: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  issueCheck: {
    padding: 4,
  },
  issueDelete: {
    padding: 4,
  },
  issuesEmpty: {
    fontSize: 12,
    color: mc.textFaint,
    lineHeight: 17,
  },
  showFixedText: {
    fontSize: 12,
    color: mc.textDim,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
