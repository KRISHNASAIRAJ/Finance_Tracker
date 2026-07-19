import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { rounded } from '../theme/spacing';

interface TimePickerProps {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 15, 30, 45];

export default function TimePicker({ visible, selected, onSelect, onClose }: TimePickerProps) {
  const hours24 = selected.getHours();
  const [period, setPeriod] = useState<'AM' | 'PM'>(hours24 >= 12 ? 'PM' : 'AM');
  const [hour, setHour] = useState(hours24 % 12 || 12);
  const [minute, setMinute] = useState(selected.getMinutes());

  const handleDone = () => {
    let h = hour % 12;
    if (period === 'PM') h += 12;
    const d = new Date(selected);
    d.setHours(h, minute, 0, 0);
    onSelect(d);
    onClose();
  };

  const format02 = (n: number) => String(n).padStart(2, '0');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Select Time</Text>

          <View style={styles.pickerRow}>
            <View style={styles.column}>
              <Text style={styles.colLabel}>HOUR</Text>
              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.item, hour === h && styles.itemActive]}
                    onPress={() => setHour(h)}
                  >
                    <Text style={[styles.itemText, hour === h && styles.itemTextActive]}>
                      {format02(h)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.separator}>:</Text>

            <View style={styles.column}>
              <Text style={styles.colLabel}>MIN</Text>
              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {MINUTES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.item, minute === m && styles.itemActive]}
                    onPress={() => setMinute(m)}
                  >
                    <Text style={[styles.itemText, minute === m && styles.itemTextActive]}>
                      {format02(m)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.column}>
              <Text style={styles.colLabel}></Text>
              <View style={styles.periodGroup}>
                {(['AM', 'PM'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                    onPress={() => setPeriod(p)}
                  >
                    <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  pickerRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, alignItems: 'flex-start' },
  column: { alignItems: 'center', gap: 8 },
  colLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  scroll: { maxHeight: 180 },
  item: {
    width: 56,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rounded.DEFAULT,
    marginVertical: 2,
  },
  itemActive: { backgroundColor: `${colors.primary}20` },
  itemText: { fontSize: 18, fontWeight: '600', color: colors.onSurfaceVariant },
  itemTextActive: { color: colors.primary, fontWeight: '700' },
  separator: { fontSize: 22, fontWeight: '300', color: colors.onSurfaceVariant, marginTop: 24 },
  periodGroup: { gap: 6, marginTop: 24 },
  periodBtn: {
    width: 52,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  periodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  periodTextActive: { color: '#fff' },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: rounded.DEFAULT },
  cancelText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: rounded.DEFAULT,
  },
  doneText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});
