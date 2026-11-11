/**
 * SleepHistoryScreen — every sleep log in one place.
 *
 * The dashboard keeps its history compact; this page shows the full list with
 * the details of each night and lets you edit or delete a log.
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
import {
  useSleepStore,
  SleepEntry,
  sleepDurationHours,
  formatSleepDuration,
} from '../store';
import { toLocalInput, parseLocalInput } from './sleepTime';

export default function SleepHistoryScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const entries = useSleepStore((s) => s.entries) || [];
  const editEntry = useSleepStore((s) => s.editEntry);
  const deleteEntry = useSleepStore((s) => s.deleteEntry);

  const [showLog, setShowLog] = useState(false);
  const [editing, setEditing] = useState<SleepEntry | null>(null);
  const [form, setForm] = useState({ bed: '', wake: '', quality: '', interruptions: '', notes: '' });

  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [entries]
  );

  const stats = useMemo(() => {
    if (sorted.length === 0) return null;
    const durations = sorted.map((e) => sleepDurationHours(e));
    const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
    const total = durations.reduce((s, d) => s + d, 0);
    return { nights: sorted.length, avg, total };
  }, [sorted]);

  const openEdit = (e: SleepEntry) => {
    setEditing(e);
    setForm({
      bed: toLocalInput(new Date(e.startTime)),
      wake: toLocalInput(new Date(e.endTime)),
      quality: e.quality ? String(e.quality) : '',
      interruptions: String(e.interruptions ?? 0),
      notes: e.notes || '',
    });
    setShowLog(true);
  };

  const handleSave = () => {
    const bed = parseLocalInput(form.bed);
    const wake = parseLocalInput(form.wake);
    if (!bed || !wake) {
      Alert.alert('Invalid times', 'Enter bedtime and wake time as YYYY-MM-DD HH:MM');
      return;
    }
    if (wake <= bed) {
      Alert.alert('Invalid range', 'Wake time must be after bedtime.');
      return;
    }
    const quality = form.quality ? parseInt(form.quality, 10) : null;
    if (quality !== null && (quality < 1 || quality > 5)) {
      Alert.alert('Invalid quality', 'Quality must be 1–5');
      return;
    }
    const interruptions = Math.max(0, parseInt(form.interruptions, 10) || 0);
    if (editing) {
      editEntry(
        editing.id,
        {
          startTime: bed.toISOString(),
          endTime: wake.toISOString(),
          quality,
          mood: editing.mood,
          interruptions,
          notes: form.notes,
          source: editing.source,
        },
        user?.id
      );
    }
    setShowLog(false);
    setEditing(null);
  };

  const confirmDelete = (e: SleepEntry) => {
    Alert.alert('Delete entry?', 'This sleep log will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(e.id, user?.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle}>All Sleep Logs</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {stats ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{stats.nights}</Text>
              <Text style={styles.summaryLabel}>NIGHTS</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{formatSleepDuration(stats.avg)}</Text>
              <Text style={styles.summaryLabel}>AVG / NIGHT</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{formatSleepDuration(stats.total)}</Text>
              <Text style={styles.summaryLabel}>TOTAL SLEEP</Text>
            </View>
          </View>
        ) : null}

        {sorted.length === 0 ? (
          <Text style={styles.emptyText}>No sleep logs yet.</Text>
        ) : (
          sorted.map((e) => {
            const d = sleepDurationHours(e);
            const below = d < 6;
            const good = d >= 7;
            return (
              <View key={e.id} style={styles.entryCard}>
                <TouchableOpacity style={styles.entryMain} onPress={() => openEdit(e)} activeOpacity={0.7}>
                  <View style={styles.entryIcon}>
                    <Ionicons
                      name={e.source?.startsWith('auto') ? 'sparkles-outline' : 'moon-outline'}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryDate}>
                      {new Date(e.startTime).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.entryTimes}>
                      {new Date(e.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} –{' '}
                      {new Date(e.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      {e.interruptions > 0 ? `  ·  ${e.interruptions} wake${e.interruptions > 1 ? 's' : ''}` : ''}
                    </Text>
                    {e.notes ? <Text style={styles.entryNote} numberOfLines={2}>{e.notes}</Text> : null}
                  </View>
                  <View style={styles.entryStats}>
                    <Text style={[styles.entryDur, { color: below ? colors.error : good ? colors.success : colors.onSurface }]}>
                      {formatSleepDuration(d)}
                    </Text>
                    {e.quality ? <Text style={styles.entryQuality}>Q {e.quality}/5</Text> : null}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.entryDelete} onPress={() => confirmDelete(e)}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showLog} transparent animationType="slide" onRequestClose={() => setShowLog(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Edit Sleep</Text>

            <Text style={styles.fieldLabel}>Bed time (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.bed}
              onChangeText={(t) => setForm((f) => ({ ...f, bed: t }))}
              placeholder="e.g. 2026-09-12 23:30"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <Text style={styles.fieldLabel}>Wake time (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.wake}
              onChangeText={(t) => setForm((f) => ({ ...f, wake: t }))}
              placeholder="e.g. 2026-09-13 07:15"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <Text style={styles.fieldLabel}>Quality (1–5, optional)</Text>
            <View style={styles.qualityRow}>
              {[1, 2, 3, 4, 5].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.qualityBtn, form.quality === String(q) && styles.qualityBtnActive]}
                  onPress={() => setForm((f) => ({ ...f, quality: f.quality === String(q) ? '' : String(q) }))}
                >
                  <Ionicons name={q <= (parseInt(form.quality, 10) || 0) ? 'star' : 'star-outline'} size={20} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Interruptions (night wakes)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.interruptions}
              onChangeText={(t) => setForm((f) => ({ ...f, interruptions: t.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.notes}
              onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
              placeholder="Optional"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Update</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLog(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0 },
  appBar: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: spacing.containerPadding, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconBtn: { padding: 8, borderRadius: rounded.full },
  appBarTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  scroll: { padding: spacing.containerPadding, gap: 10, paddingBottom: 40 },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  summaryStat: { flex: 1, alignItems: 'center', gap: 3 },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.border },
  summaryValue: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  summaryLabel: { fontSize: 9, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.6 },

  emptyText: { fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 24 },

  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  entryMain: { flex: 1, flexDirection: 'row', padding: 12, gap: 12, alignItems: 'center' },
  entryIcon: { width: 38, height: 38, borderRadius: rounded.DEFAULT, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  entryInfo: { flex: 1, gap: 2 },
  entryDate: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  entryTimes: { fontSize: 11, color: colors.onSurfaceVariant },
  entryNote: { fontSize: 11, color: colors.onSurfaceVariant },
  entryStats: { alignItems: 'flex-end', gap: 2 },
  entryDur: { fontSize: 15, fontWeight: '700' },
  entryQuality: { fontSize: 11, color: colors.onSurfaceVariant },
  entryDelete: { padding: 12, paddingLeft: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center', marginBottom: 16 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginBottom: 4, marginTop: 8 },
  fieldInput: { backgroundColor: colors.surface, borderRadius: rounded.DEFAULT, height: 44, paddingHorizontal: 14, color: colors.onSurface, fontSize: 15, fontWeight: '500', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  qualityRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  qualityBtn: { padding: 8, borderRadius: rounded.DEFAULT, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  qualityBtnActive: { backgroundColor: colors.primaryContainer },
  saveBtn: { backgroundColor: colors.primaryContainer, paddingVertical: 14, borderRadius: rounded.lg, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  cancelBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.onSurfaceVariant },
});
