/**
 * PeopleScreen — the "keep in touch" list.
 *
 * Every person has their own cadence (weekly / monthly / every 45 days /
 * every N days). The list is split into the people who are due now, the ones
 * coming up and everyone else. "Mark contacted" moves the next due date one
 * interval forward.
 */
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useAuth } from '../../../services/AuthProvider';
import { usePeopleStore, type Person } from '../store';
import {
  CADENCE_OPTIONS,
  cadenceLabel,
  dueLabel,
  isDue,
  isOverdue,
  MIN_CUSTOM_DAYS,
  type PeopleCadence,
} from '../peopleCadence';
import { usePeopleSync } from '../hooks/usePeopleSync';

type Nav = { goBack: () => void };

export default function PeopleScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const people = usePeopleStore((s) => s.people);
  const addPerson = usePeopleStore((s) => s.addPerson);
  const updatePerson = usePeopleStore((s) => s.updatePerson);
  const deletePerson = usePeopleStore((s) => s.deletePerson);
  const markContacted = usePeopleStore((s) => s.markContacted);
  const getDue = usePeopleStore((s) => s.getDue);
  const getUpcoming = usePeopleStore((s) => s.getUpcoming);
  const getLater = usePeopleStore((s) => s.getLater);
  usePeopleSync();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    cadence: 'monthly' as PeopleCadence,
    customDays: '30',
  });

  const now = useMemo(() => new Date(), [people]);
  const due = useMemo(() => getDue(now), [getDue, now, people]);
  const upcoming = useMemo(() => getUpcoming(30, now), [getUpcoming, now, people]);
  const later = useMemo(() => getLater(now), [getLater, now, people]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', notes: '', cadence: 'monthly', customDays: '30' });
    setShowForm(true);
  };

  const openEdit = (p: Person) => {
    setEditing(p);
    setForm({
      name: p.name,
      phone: p.phone || '',
      email: p.email || '',
      notes: p.notes || '',
      cadence: p.cadence,
      customDays: String(p.intervalDays || 30),
    });
    setShowForm(true);
  };

  const save = () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert('Name required', 'Who do you want to keep in touch with?');
      return;
    }
    const customDays = Math.max(MIN_CUSTOM_DAYS, parseInt(form.customDays, 10) || 30);
    if (editing) {
      updatePerson(
        editing.id,
        {
          name,
          phone: form.phone.trim(),
          email: form.email.trim(),
          notes: form.notes.trim(),
          cadence: form.cadence,
          intervalDays: form.cadence === 'custom' ? customDays : undefined,
        },
        user?.id
      );
    } else {
      addPerson(
        {
          name,
          phone: form.phone.trim(),
          email: form.email.trim(),
          notes: form.notes.trim(),
          cadence: form.cadence,
          intervalDays: form.cadence === 'custom' ? customDays : undefined,
        },
        user?.id
      );
    }
    setShowForm(false);
    setEditing(null);
  };

  const confirmDelete = (p: Person) => {
    Alert.alert('Remove?', `${p.name} will be removed from the list.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deletePerson(p.id, user?.id) },
    ]);
  };

  const renderRow = (p: Person, highlight: boolean) => {
    const overdue = isOverdue(p.nextDueAt, now);
    const dueNow = isDue(p.nextDueAt, now);
    return (
      <View key={p.id} style={[styles.row, highlight && styles.rowDue]}>
        <TouchableOpacity
          style={styles.rowMain}
          activeOpacity={0.7}
          onPress={() => openEdit(p)}
        >
          <View style={[styles.avatar, highlight && styles.avatarDue]}>
            <Text style={[styles.avatarText, highlight && styles.avatarTextDue]}>
              {(p.name || '?').trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName}>{p.name}</Text>
            <View style={styles.rowMetaRow}>
              <Text style={styles.rowCadence}>{cadenceLabel(p.cadence, p.intervalDays)}</Text>
              <Text style={styles.rowDueText}>
                {dueNow ? (overdue ? `• ${dueLabel(p.nextDueAt, now)}` : '• Due today') : `• ${dueLabel(p.nextDueAt, now)}`}
              </Text>
            </View>
            {p.phone ? <Text style={styles.rowSub}>{p.phone}</Text> : null}
          </View>
        </TouchableOpacity>
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => markContacted(p.id, user?.id)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={16} color={colors.onSurface} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => confirmDelete(p)}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const total = people.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle}>Keep in Touch</Text>
          {total > 0 && (
            <Text style={styles.appBarSub}>
              {total} {total === 1 ? 'person' : 'people'}
              {due.length > 0 ? ` · ${due.length} due` : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={openAdd}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {total === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={34} color={colors.primary} />
            <Text style={styles.emptyTitle}>No one yet</Text>
            <Text style={styles.emptyText}>
              Add the people you want to stay in touch with and pick how often —
              weekly, monthly, every 45 days or your own interval.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd} activeOpacity={0.85}>
              <Text style={styles.emptyBtnText}>Add a person</Text>
            </TouchableOpacity>
          </View>
        )}

        {due.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>DUE NOW</Text>
            {due.map((p) => renderRow(p, true))}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>COMING UP</Text>
            {upcoming.map((p) => renderRow(p, false))}
          </>
        )}

        {later.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>LATER</Text>
            {later.map((p) => renderRow(p, false))}
          </>
        )}
      </ScrollView>

      {/* Add / edit */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{editing ? 'Edit person' : 'Add a person'}</Text>

            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              placeholder="Who?"
              placeholderTextColor={colors.onSurfaceVariant}
              autoFocus
            />

            <Text style={styles.fieldLabel}>PHONE (OPTIONAL)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.phone}
              onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))}
              placeholder="+91 …"
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>HOW OFTEN</Text>
            <View style={styles.chipRow}>
              {CADENCE_OPTIONS.map((c) => {
                const active = form.cadence === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setForm((f) => ({ ...f, cadence: c.id }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {form.cadence === 'custom' && (
              <>
                <Text style={styles.fieldLabel}>EVERY HOW MANY DAYS?</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.customDays}
                  onChangeText={(t) => setForm((f) => ({ ...f, customDays: t.replace(/[^0-9]/g, '') }))}
                  placeholder="30"
                  placeholderTextColor={colors.onSurfaceVariant}
                  keyboardType="number-pad"
                />
              </>
            )}

            <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.notes}
              onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
              placeholder="Anything to remember"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Add'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconBtn: { padding: 6 },
  appBarTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  appBarSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  scroll: { padding: spacing.containerPadding, gap: 8, paddingBottom: 40 },

  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.8,
    marginTop: 10,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingRight: 8,
  },
  rowDue: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDue: { backgroundColor: colors.primary },
  avatarText: { fontSize: 15, fontWeight: '800', color: colors.onSurfaceVariant },
  avatarTextDue: { color: colors.onSurface },
  rowName: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rowCadence: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  rowDueText: { fontSize: 11, color: colors.onSurfaceVariant },
  rowSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: { padding: 6 },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  emptyText: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 18 },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: rounded.DEFAULT,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: colors.onSurface },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center', marginBottom: 12 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT,
    height: 44,
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: '500',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  chipTextActive: { color: colors.onSurface },
  saveBtn: {
    backgroundColor: colors.primaryContainer,
    paddingVertical: 14,
    borderRadius: rounded.lg,
    alignItems: 'center',
    marginTop: 18,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  cancelBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  cancelBtnText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
});
