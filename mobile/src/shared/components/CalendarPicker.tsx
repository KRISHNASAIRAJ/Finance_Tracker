import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, TextInput, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CalendarPickerProps {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

// Meridian design tokens (from Stitch "Date Picker" screen)
const C = {
  surface: '#15121b',
  surfaceLow: '#1d1a24',
  surfaceContainer: '#221e28',
  onSurface: '#e8dfee',
  onSurfaceVariant: '#ccc3d8',
  primary: '#d2bbff',
  primaryContainer: '#7c3aed',
  onPrimary: '#ffffff',
  outlineVariant: '#4a4455',
  outline: '#958da1',
  dim: 'rgba(204,195,216,0.4)',
  border: 'rgba(255,255,255,0.05)',
  overlay: 'rgba(0,0,0,0.7)',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

export default function CalendarPicker({ visible, selected, onSelect, onClose }: CalendarPickerProps) {
  const [month, setMonth] = useState(() => new Date(selected));
  const [view, setView] = useState<'day' | 'year' | 'month'>('day');
  const [inputMode, setInputMode] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (visible) {
      setMonth(new Date(selected));
      setView('day');
      setInputMode(false);
      setInputValue(toYMD(new Date(selected)));
    }
  }, [visible, selected]);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const changeMonth = (offset: number) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  };

  const getDays = () => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= totalDays; i++) cells.push(new Date(month.getFullYear(), month.getMonth(), i));
    return cells;
  };

  const years = useMemo(() => {
    const current = today.getFullYear();
    const arr: number[] = [];
    for (let y = current - 100; y <= current + 10; y++) arr.push(y);
    return arr;
  }, [today]);

  const isSelectedDate = (d: Date) =>
    d.getDate() === selected.getDate() &&
    d.getMonth() === selected.getMonth() &&
    d.getFullYear() === selected.getFullYear();

  const handleCommit = (d: Date) => {
    onSelect(d);
    onClose();
  };

  const commitInput = () => {
    const parsed = fromYMD(inputValue);
    if (parsed) handleCommit(parsed);
  };

  const isPastDate = (d: Date) => d.getTime() < today.getTime();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={C.onSurfaceVariant} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select Date</Text>
            <View style={styles.iconBtn} />
          </View>

          {/* Selected Date Display */}
          <Pressable style={styles.dateDisplay} onPress={() => setInputMode(true)}>
            {inputMode ? (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.headerInput}
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.dim}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  autoFocus
                  onSubmitEditing={commitInput}
                  onBlur={commitInput}
                />
                <TouchableOpacity style={styles.headerEditBtn} onPress={commitInput}>
                  <Ionicons name="checkmark" size={20} color={C.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.dateDisplayInner}>
                <Text style={styles.dateMonthLabel}>
                  {MONTHS_SHORT[selected.getMonth()]} {selected.getFullYear()}
                </Text>
                <Text style={styles.dateBig}>
                  {selected.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
              </View>
            )}
          </Pressable>

          {view === 'day' ? (
            <>
              {/* Month Navigation */}
              <View style={styles.monthNav}>
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => changeMonth(-1)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={22} color={C.onSurfaceVariant} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.monthLabelBtn} onPress={() => setView('year')} hitSlop={{ top: 8, bottom: 8 }}>
                  <Text style={styles.monthLabel}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => changeMonth(1)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={22} color={C.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              {/* Weekday header */}
              <View style={styles.weekRow}>
                {WEEKDAYS.map((d, i) => (
                  <Text key={i} style={styles.weekLabel}>{d}</Text>
                ))}
              </View>

              {/* Days grid */}
              <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
                <View style={styles.daysGrid}>
                  {getDays().map((day, i) => {
                    if (!day) return <View key={i} style={styles.dayCell} />;
                    const sel = isSelectedDate(day);
                    const isTodayDate = day.getTime() === today.getTime();
                    const past = isPastDate(day);
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.dayCell,
                          sel && styles.dayCellSelected,
                          isTodayDate && !sel && styles.dayCellToday,
                        ]}
                        onPress={() => handleCommit(day)}
                        activeOpacity={0.6}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            past && !sel && styles.dayTextPast,
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

                {/* Available dates indicator */}
                <View style={styles.availableRow}>
                  <View style={styles.availableDot} />
                  <Text style={styles.availableText}>Available Dates</Text>
                </View>
              </ScrollView>
            </>
          ) : (
            <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
              <View style={styles.gridList}>
                {view === 'year'
                  ? years.map((y) => (
                      <TouchableOpacity
                        key={y}
                        style={[styles.gridCell, y === month.getFullYear() && styles.gridCellActive]}
                        onPress={() => { setMonth(new Date(y, month.getMonth(), 1)); setView('month'); }}
                      >
                        <Text style={[styles.gridCellText, y === month.getFullYear() && styles.gridCellTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    ))
                  : MONTHS_SHORT.map((m, i) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.gridCell, i === month.getMonth() && styles.gridCellActive]}
                        onPress={() => { setMonth(new Date(month.getFullYear(), i, 1)); setView('day'); }}
                      >
                        <Text style={[styles.gridCellText, i === month.getMonth() && styles.gridCellTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
              </View>
            </ScrollView>
          )}

          {/* Bottom action bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.selectBtn]}
              onPress={() => handleCommit(selected)}
              activeOpacity={0.85}
            >
              <Text style={styles.selectText}>Select</Text>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: 'rgba(29,26,36,0.5)',
  },
  iconBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.onSurface,
    letterSpacing: -0.3,
  },
  dateDisplay: {
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: 'rgba(34,30,40,0.25)',
  },
  dateDisplayInner: { alignItems: 'center', gap: 6 },
  dateMonthLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  dateBig: {
    fontSize: 36,
    fontWeight: '700',
    color: C.onSurface,
    letterSpacing: -0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  headerInput: {
    flex: 1,
    height: 52,
    fontSize: 20,
    fontWeight: '700',
    color: C.onSurface,
    backgroundColor: C.surfaceLow,
    borderRadius: 12,
    paddingHorizontal: 16,
    textAlign: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  headerEditBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabelBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  monthLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: C.onSurface,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 6,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(204,195,216,0.5)',
    textTransform: 'uppercase',
  },
  scrollBody: { flexShrink: 1 },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 4,
    rowGap: 4,
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  dayCellSelected: {
    backgroundColor: C.primaryContainer,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: C.primary,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: C.onSurface,
  },
  dayTextPast: { color: C.dim },
  dayTextSelected: {
    color: C.onPrimary,
    fontWeight: '600',
  },
  dayTextToday: {
    color: C.primary,
    fontWeight: '600',
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  availableDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primaryContainer,
  },
  availableText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.onSurfaceVariant,
  },
  gridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  gridCell: {
    width: '25%',
    aspectRatio: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  gridCellActive: {
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  gridCellText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.onSurface,
  },
  gridCellTextActive: {
    color: C.primary,
    fontWeight: '700',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    backgroundColor: 'rgba(29,26,36,0.9)',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: C.primaryContainer,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.primary,
  },
  selectBtn: {
    backgroundColor: C.primaryContainer,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  selectText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.onPrimary,
  },
});
