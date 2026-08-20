import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tc, tr } from '../theme/tracend';

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

  // Sync with parent selection whenever the dialog opens (or the selection changes).
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

  const formattedDate = selected.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            {inputMode ? (
              <TextInput
                style={styles.headerInput}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={tc.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                autoFocus
                onSubmitEditing={commitInput}
                onBlur={commitInput}
              />
            ) : (
              <Pressable style={styles.headerDateRow} onPress={() => setInputMode(true)}>
                <View style={styles.headerDateBlock}>
                  <Text style={styles.headerYear}>{selected.getFullYear()}</Text>
                  <Text style={styles.headerDate}>{formattedDate}</Text>
                </View>
                <View style={styles.headerEditBtn}>
                  <Ionicons name="create-outline" size={20} color={tc.onPrimaryContainer} />
                </View>
              </Pressable>
            )}
          </View>

          {/* Month / Year navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => {
                if (inputMode) setInputMode(false);
                else changeMonth(-1);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color={tc.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.monthLabelBtn}
              onPress={() => setView('year')}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              <Text style={styles.monthLabel}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => {
                if (inputMode) setInputMode(false);
                else changeMonth(1);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-forward" size={22} color={tc.onSurface} />
            </TouchableOpacity>
          </View>

          {view === 'day' ? (
            <>
              <View style={styles.weekRow}>
                {WEEKDAYS.map((d, i) => (
                  <Text key={i} style={styles.weekLabel}>{d}</Text>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {getDays().map((day, i) => {
                  if (!day) return <View key={i} style={styles.dayCell} />;
                  const sel = isSelectedDate(day);
                  const isTodayDate = day.getTime() === today.getTime();
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.dayCell, sel && styles.dayCellSelected, isTodayDate && !sel && styles.dayCellToday]}
                      onPress={() => handleCommit(day)}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.dayText, sel && styles.dayTextSelected, isTodayDate && !sel && styles.dayTextToday]}>
                        {day.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : view === 'year' ? (
            <View style={styles.gridList}>
              {years.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.gridCell, y === month.getFullYear() && styles.gridCellActive]}
                  onPress={() => { setMonth(new Date(y, month.getMonth(), 1)); setView('month'); }}
                >
                  <Text style={[styles.gridCellText, y === month.getFullYear() && styles.gridCellTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.gridList}>
              {MONTHS_SHORT.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.gridCell, i === month.getMonth() && styles.gridCellActive]}
                  onPress={() => { setMonth(new Date(month.getFullYear(), i, 1)); setView('day'); }}
                >
                  <Text style={[styles.gridCellText, i === month.getMonth() && styles.gridCellTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.footerBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8 }}>
              <Text style={styles.footerCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerBtn, styles.footerOkBtn]} onPress={handleCommit.bind(null, selected)} hitSlop={{ top: 8, bottom: 8 }}>
              <Text style={styles.footerOkText}>OK</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: tc.surfaceElevated,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  header: {
    backgroundColor: tc.primaryContainer,
    padding: 24,
    paddingTop: 28,
  },
  headerDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerDateBlock: {
    gap: 4,
  },
  headerYear: {
    fontSize: 14,
    fontWeight: '600',
    color: tc.onPrimaryContainer,
    opacity: 0.72,
    letterSpacing: 0.5,
  },
  headerDate: {
    fontSize: 32,
    fontWeight: '700',
    color: tc.onPrimaryContainer,
    letterSpacing: -0.5,
  },
  headerEditBtn: {
    width: 44,
    height: 44,
    borderRadius: tr.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,247,251,0.10)',
  },
  headerInput: {
    height: 56,
    fontSize: 22,
    fontWeight: '700',
    color: tc.onPrimaryContainer,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244,247,251,0.4)',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: tr.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tr.sm,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: tc.onSurface,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: tc.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tr.full,
  },
  dayCellSelected: {
    backgroundColor: tc.action,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: tc.action,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
    color: tc.onSurface,
  },
  dayTextSelected: {
    color: tc.onAction,
    fontWeight: '700',
  },
  dayTextToday: {
    color: tc.action,
    fontWeight: '700',
  },
  gridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    gap: 0,
  },
  gridCell: {
    width: '25%',
    aspectRatio: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tr.sm,
  },
  gridCellActive: {
    backgroundColor: tc.actionDim,
  },
  gridCellText: {
    fontSize: 13,
    fontWeight: '500',
    color: tc.onSurface,
  },
  gridCellTextActive: {
    color: tc.action,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tc.border,
  },
  footerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tr.full,
  },
  footerCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: tc.textSecondary,
  },
  footerOkBtn: {},
  footerOkText: {
    fontSize: 14,
    fontWeight: '700',
    color: tc.action,
  },
});
