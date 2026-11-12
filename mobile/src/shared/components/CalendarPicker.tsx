/**
 * CalendarPicker — the date picker (OnePlus OxygenOS).
 *
 * A centred popup card: the selected date on top, the month grid below and
 * the month / year drill-down. It opens inside the app window — never the
 * system dialog — and it uses the same palette as the widgets.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { op, OP_CARD_RADIUS, OP_CHIP_RADIUS } from '../theme/oneplus';

interface CalendarPickerProps {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

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
    for (let i = 1; i <= totalDays; i++) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), i));
    }
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* The backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          {/* Header — the selected date */}
          <View style={styles.header}>
            {inputMode ? (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={op.faint}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  autoFocus
                  onSubmitEditing={commitInput}
                  onBlur={commitInput}
                />
                <Pressable style={styles.checkBtn} onPress={commitInput}>
                  <Ionicons name="checkmark" size={18} color={op.white} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={{ flex: 1 }} onPress={() => setInputMode(true)}>
                <Text style={styles.headerLabel}>
                  {MONTHS_SHORT[selected.getMonth()]} {selected.getFullYear()}
                </Text>
                <Text style={styles.headerValue}>
                  {selected.toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </Pressable>
            )}
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={op.muted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {view === 'day' ? (
              <>
                {/* Month navigation */}
                <View style={styles.monthNav}>
                  <Pressable style={styles.navBtn} onPress={() => changeMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="chevron-back" size={20} color={op.whiteDim} />
                  </Pressable>
                  <Pressable style={styles.monthLabelBtn} onPress={() => setView('year')}>
                    <Text style={styles.monthLabel}>
                      {MONTHS[month.getMonth()]} {month.getFullYear()}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.navBtn} onPress={() => changeMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="chevron-forward" size={20} color={op.whiteDim} />
                  </Pressable>
                </View>

                {/* The weekday header */}
                <View style={styles.weekRow}>
                  {WEEKDAYS.map((d, i) => (
                    <Text key={i} style={styles.weekLabel}>
                      {d}
                    </Text>
                  ))}
                </View>

                {/* The days */}
                <View style={styles.daysGrid}>
                  {getDays().map((day, i) => {
                    if (!day) return <View key={i} style={styles.dayCell} />;
                    const sel = isSelectedDate(day);
                    const isTodayDate = day.getTime() === today.getTime();
                    const past = isPastDate(day);
                    return (
                      <Pressable
                        key={i}
                        style={[
                          styles.dayCell,
                          sel && styles.dayCellSelected,
                          isTodayDate && !sel && styles.dayCellToday,
                        ]}
                        onPress={() => handleCommit(day)}
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
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.gridList}>
                {view === 'year'
                  ? years.map((y) => (
                      <Pressable
                        key={y}
                        style={[styles.gridCell, y === month.getFullYear() && styles.gridCellActive]}
                        onPress={() => {
                          setMonth(new Date(y, month.getMonth(), 1));
                          setView('month');
                        }}
                      >
                        <Text
                          style={[
                            styles.gridCellText,
                            y === month.getFullYear() && styles.gridCellTextActive,
                          ]}
                        >
                          {y}
                        </Text>
                      </Pressable>
                    ))
                  : MONTHS_SHORT.map((m, i) => (
                      <Pressable
                        key={m}
                        style={[styles.gridCell, i === month.getMonth() && styles.gridCellActive]}
                        onPress={() => {
                          setMonth(new Date(month.getFullYear(), i, 1));
                          setView('day');
                        }}
                      >
                        <Text
                          style={[
                            styles.gridCellText,
                            i === month.getMonth() && styles.gridCellTextActive,
                          ]}
                        >
                          {m}
                        </Text>
                      </Pressable>
                    ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.doneBtn]} onPress={() => handleCommit(selected)}>
              <Text style={styles.doneText}>Select</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: op.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '88%',
    backgroundColor: op.card,
    borderRadius: OP_CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: op.hairline,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: op.red,
  },
  headerValue: {
    marginTop: 3,
    fontSize: 24,
    fontWeight: '700',
    color: op.white,
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: op.surface,
    marginLeft: 10,
  },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 46,
    fontSize: 18,
    fontWeight: '700',
    color: op.white,
    backgroundColor: op.surface,
    borderRadius: OP_CHIP_RADIUS,
    paddingHorizontal: 14,
    textAlign: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: op.hairline,
  },
  checkBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: op.red,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: op.surface,
  },
  monthLabelBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: op.white,
  },
  weekRow: {
    flexDirection: 'row',
    paddingBottom: 4,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: op.faint,
    letterSpacing: 0.8,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 6,
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  dayCellSelected: {
    backgroundColor: op.red,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: op.red,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: op.white,
  },
  dayTextPast: { color: op.faint },
  dayTextSelected: {
    color: op.white,
    fontWeight: '700',
  },
  dayTextToday: {
    color: op.red,
    fontWeight: '700',
  },
  gridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  gridCell: {
    width: '25%',
    aspectRatio: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: OP_CHIP_RADIUS,
  },
  gridCellActive: {
    backgroundColor: op.redDim,
  },
  gridCellText: {
    fontSize: 14,
    fontWeight: '500',
    color: op.white,
  },
  gridCellTextActive: {
    color: op.red,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: op.hairline,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: OP_CHIP_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: op.hairline,
    backgroundColor: op.surface,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: op.whiteDim,
  },
  doneBtn: {
    backgroundColor: op.red,
  },
  doneText: {
    fontSize: 14,
    fontWeight: '700',
    color: op.white,
  },
});
