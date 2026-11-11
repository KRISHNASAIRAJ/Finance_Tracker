/**
 * PillReminderScreen — medication list with daily dose times.
 *
 * Every active medication sends a local notification per dose with two
 * action buttons in the notification panel:
 *   ⏭  Skip              → the dose is skipped for that day
 *   ⏰ Remind in 30 min  → the reminder comes back in 30 minutes
 */
import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { useMedicationsStore, parseDoseTimes, type Medication } from '../store';
import { useMedicationsSync } from '../hooks/useMedicationsSync';
import { scheduleMedicationReminders } from '../../../services/medicationReminders';

const emptyDraft = { name: '', dosage: '', times: '', notes: '' };

export default function PillReminderScreen() {
  const navigation = useNavigation<any>();
  const { medications, addMedication, updateMedication, deleteMedication } = useMedicationsStore();
  const { pullFromCloud } = useMedicationsSync();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const openAdd = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setShowModal(true);
  };

  const openEdit = (med: Medication) => {
    setEditing(med);
    setDraft({
      name: med.name,
      dosage: med.dosage,
      times: (med.times || []).join(', '),
      notes: med.notes,
    });
    setShowModal(true);
  };

  const save = () => {
    const name = draft.name.trim();
    const times = parseDoseTimes(draft.times);
    if (!name) { Alert.alert('Name required', 'Enter the medicine name'); return; }
    if (times.length === 0) { Alert.alert('Dose time required', 'Add at least one time, e.g. 08:00, 20:00'); return; }

    const payload = {
      name,
      dosage: draft.dosage.trim(),
      times,
      notes: draft.notes.trim(),
    };

    if (editing) {
      updateMedication(editing.id, payload);
    } else {
      addMedication(payload);
    }
    setShowModal(false);
    setDraft(emptyDraft);
    scheduleMedicationReminders().catch(() => {});
  };

  const confirmDelete = (med: Medication) => {
    Alert.alert('Delete medicine', `Remove ${med.name} and its reminders?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMedication(med.id);
          scheduleMedicationReminders().catch(() => {});
        },
      },
    ]);
  };

  const toggleActive = (med: Medication) => {
    updateMedication(med.id, { active: !med.active });
    scheduleMedicationReminders().catch(() => {});
  };

  const activeCount = useMemo(() => medications.filter((m) => m.active).length, [medications]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarLabel}>health</Text>
          <Text style={styles.appBarTitle}>Pill Reminder</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={openAdd}>
          <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Ionicons name="notifications-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            {activeCount > 0
              ? `${activeCount} medicine${activeCount === 1 ? '' : 's'} active. Each dose notification has Skip and Remind-in-30-min buttons.`
              : 'Add a medicine to get reminders. Each dose notification comes with Skip and Remind-in-30-min buttons.'}
          </Text>
        </View>

        {medications.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="medkit-outline" size={42} color={colors.outline} />
            <Text style={styles.emptyText}>No medicines yet</Text>
            <Text style={styles.emptySub}>Tap + to add your first pill reminder</Text>
          </View>
        )}

        {medications.map((med) => (
          <View key={med.id} style={[styles.card, !med.active && { opacity: 0.55 }]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{med.name}</Text>
                {med.dosage ? <Text style={styles.medDosage}>{med.dosage}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => toggleActive(med)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons
                  name={med.active ? 'notifications' : 'notifications-off-outline'}
                  size={20}
                  color={med.active ? colors.primary : colors.onSurfaceVariant}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEdit(med)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={19} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(med)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={19} color={colors.error} />
              </TouchableOpacity>
            </View>

            <View style={styles.timeRow}>
              {(med.times || []).map((t) => (
                <View key={t} style={styles.timePill}>
                  <Ionicons name="alarm-outline" size={12} color={colors.primary} />
                  <Text style={styles.timePillText}>{t}</Text>
                </View>
              ))}
              {!med.active && <Text style={styles.pausedText}>PAUSED</Text>}
            </View>

            {med.notes ? <Text style={styles.medNotes}>{med.notes}</Text> : null}
          </View>
        ))}

        <TouchableOpacity style={styles.syncBtn} onPress={() => pullFromCloud()}>
          <Ionicons name="sync-outline" size={16} color={colors.onSurfaceVariant} />
          <Text style={styles.syncText}>Sync from cloud</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editing ? 'Edit medicine' : 'Add medicine'}</Text>

            <Text style={styles.label}>NAME</Text>
            <TextInput
              style={styles.input}
              value={draft.name}
              onChangeText={(t) => setDraft({ ...draft, name: t })}
              placeholder="e.g. Metformin"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <Text style={styles.label}>DOSAGE</Text>
            <TextInput
              style={styles.input}
              value={draft.dosage}
              onChangeText={(t) => setDraft({ ...draft, dosage: t })}
              placeholder="e.g. 500 mg"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <Text style={styles.label}>DOSE TIMES</Text>
            <TextInput
              style={styles.input}
              value={draft.times}
              onChangeText={(t) => setDraft({ ...draft, times: t })}
              placeholder="08:00, 20:00"
              placeholderTextColor={colors.onSurfaceVariant}
              autoCapitalize="none"
            />
            <Text style={styles.hint}>24-hour times, separated by commas</Text>

            <Text style={styles.label}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={draft.notes}
              onChangeText={(t) => setDraft({ ...draft, notes: t })}
              placeholder="e.g. after food"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={save}>
                <Text style={styles.modalSaveText}>{editing ? 'Save' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconButton: { padding: 6 },
  appBarLabel: { fontSize: 11, color: colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 },
  appBarTitle: { fontSize: 20, fontWeight: '800', color: colors.onSurface },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 40, gap: 12 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  infoText: { flex: 1, fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medName: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  medDosage: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.actionDim,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timePillText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  pausedText: { fontSize: 10, fontWeight: '800', color: colors.onSurfaceVariant, letterSpacing: 1 },
  medNotes: { fontSize: 12, color: colors.onSurfaceVariant },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyText: { fontSize: 15, color: colors.onSurface },
  emptySub: { fontSize: 12, color: colors.onSurfaceVariant },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 10 },
  syncText: { fontSize: 12, color: colors.onSurfaceVariant },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.onSurface, marginBottom: 6 },
  label: { fontSize: 10, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 1, marginTop: 8 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.onSurface,
  },
  hint: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  modalBtnCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  modalCancelText: { color: colors.onSurfaceVariant, fontWeight: '700', fontSize: 13 },
  modalBtnSave: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  modalSaveText: { color: colors.background, fontWeight: '800', fontSize: 13 },
});
