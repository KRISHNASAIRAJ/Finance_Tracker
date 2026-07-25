import React, { useState, useCallback } from 'react';
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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

  const isSelected = useCallback(
    (d: Date) =>
      d.getDate() === selected.getDate() &&
      d.getMonth() === selected.getMonth() &&
      d.getFullYear() === selected.getFullYear(),
    [selected]
  );

  const formattedDate = selected.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerYear}>{selected.getFullYear()}</Text>
            <Text style={styles.headerDate}>{formattedDate}</Text>
          </View>

          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)}>
              <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </Text>
            <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)}>
              <Ionicons name="chevron-forward" size={22} color={colors.onSurface} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {DAYS.map((d, i) => (
              <Text key={i} style={styles.weekLabel}>{d}</Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {getDays().map((day, i) => {
              if (!day) return <View key={i} style={styles.dayCell} />;
              const sel = isSelected(day);
              const isTodayDate = day.toDateString() === new Date().toDateString();
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.dayCell,
                    sel && styles.dayCellSelected,
                    isTodayDate && !sel && styles.dayCellToday,
                  ]}
                  onPress={() => { onSelect(day); onClose(); }}
                  activeOpacity={0.6}
                >
                  <Text
                    style={[
                      styles.dayText,
                      sel && styles.dayTextSelected,
                      isTodayDate && !sel && styles.dayTextToday,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.footerBtn} onPress={onClose}>
              <Text style={styles.footerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e1b2e',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  header: {
    backgroundColor: colors.primaryContainer,
    padding: 24,
    paddingTop: 28,
    gap: 4,
    alignItems: 'flex-start',
  },
  headerYear: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  headerDate: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.onSurface,
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  footerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: rounded.DEFAULT,
  },
  footerCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
});
