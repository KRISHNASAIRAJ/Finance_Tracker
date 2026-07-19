import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { rounded } from '../theme/spacing';

interface CalendarPickerProps {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

export default function CalendarPicker({ visible, selected, onSelect, onClose }: CalendarPickerProps) {
  const [month, setMonth] = useState(new Date(selected));

  const changeMonth = (offset: number) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  };

  const getDays = () => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(new Date(month.getFullYear(), month.getMonth(), i));
    return days;
  };

  const isSelected = (d: Date) =>
    d.getDate() === selected.getDate() &&
    d.getMonth() === selected.getMonth() &&
    d.getFullYear() === selected.getFullYear();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => changeMonth(-1)}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => changeMonth(1)}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={styles.weekLabel}>{d}</Text>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {getDays().map((day, i) =>
              day ? (
                <TouchableOpacity
                  key={i}
                  style={[styles.dayBtn, isSelected(day) && styles.dayBtnSelected]}
                  onPress={() => { onSelect(day); onClose(); }}
                >
                  <Text style={[styles.dayText, isSelected(day) && styles.dayTextSel]}>{day.getDate()}</Text>
                </TouchableOpacity>
              ) : (
                <View key={i} style={styles.dayBtn} />
              )
            )}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
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
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthLabel: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  weekLabel: { width: 32, textAlign: 'center', fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '600' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dayBtn: { width: 36, height: 36, borderRadius: rounded.full, alignItems: 'center', justifyContent: 'center' },
  dayBtnSelected: { backgroundColor: colors.primary },
  dayText: { fontSize: 13, color: colors.onSurface, fontWeight: '500' },
  dayTextSel: { color: '#fff', fontWeight: '700' },
  closeBtn: { alignItems: 'center', paddingVertical: 10 },
  closeText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
});
