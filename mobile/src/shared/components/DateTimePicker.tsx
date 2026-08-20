import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DateTimePickerProps {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

// Meridian design tokens (from Stitch "Date & Time Picker" screen)
const C = {
  surface: '#15121b',
  surfaceLow: '#1d1a24',
  surfaceContainer: '#221e28',
  surfaceBright: '#3c3742',
  onSurface: '#e8dfee',
  onSurfaceVariant: '#ccc3d8',
  primary: '#d2bbff',
  primaryContainer: '#7c3aed',
  onPrimary: '#ffffff',
  outlineVariant: '#4a4455',
  border: 'rgba(255,255,255,0.05)',
  dim: 'rgba(204,195,216,0.4)',
  overlay: 'rgba(0,0,0,0.7)',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

const SPIN_ITEM_H = 42;
const SPIN_PAD = 49;
const SPIN_H = 140;

export default function DateTimePicker({ visible, selected, onSelect, onClose }: DateTimePickerProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date(selected));
  const [tempDate, setTempDate] = useState<Date>(() => new Date(selected));
  const [period, setPeriod] = useState<'AM' | 'PM'>(selected.getHours() >= 12 ? 'PM' : 'AM');
  const [hour, setHour] = useState(selected.getHours() % 12 || 12);
  const [minute, setMinute] = useState(Math.round(selected.getMinutes() / 5) * 5);
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  const scrollToHour = (h: number) => {
    hourScrollRef.current?.scrollTo({ y: Math.max(0, (h - 1) * SPIN_ITEM_H), animated: false });
  };
  const scrollToMinute = (m: number) => {
    minuteScrollRef.current?.scrollTo({ y: (m / 5) * SPIN_ITEM_H, animated: false });
  };

  useEffect(() => {
    if (visible) {
      const s = selected;
      setViewMonth(new Date(s));
      setTempDate(new Date(s));
      setPeriod(s.getHours() >= 12 ? 'PM' : 'AM');
      setHour(s.getHours() % 12 || 12);
      setMinute(Math.round(s.getMinutes() / 5) * 5);
      setTimeout(() => {
        scrollToHour(s.getHours() % 12 || 12);
        scrollToMinute(Math.round(s.getMinutes() / 5) * 5);
      }, 120);
    }
  }, [visible, selected]);

  const isSelected = useCallback(
    (d: Date) =>
      d.getDate() === tempDate.getDate() &&
      d.getMonth() === tempDate.getMonth() &&
      d.getFullYear() === tempDate.getFullYear(),
    [tempDate]
  );

  const changeMonth = (offset: number) => {
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() + offset);
    setViewMonth(d);
  };

  const getDays = () => {
    const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
    const totalDays = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i));
    }
    return days;
  };

  const handleDateSelect = (d: Date) => {
    const updated = new Date(tempDate);
    updated.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setTempDate(updated);
  };

  const handleConfirm = () => {
    let h = hour % 12;
    if (period === 'PM') h += 12;
    const result = new Date(tempDate);
    result.setHours(h, minute, 0, 0);
    onSelect(result);
    onClose();
  };

  const fmtTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={C.onSurfaceVariant} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select Date & Time</Text>
            <View style={styles.iconBtn} />
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Selection Summary Card */}
            <View style={styles.summaryCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>SELECTED DATE</Text>
                <Text style={styles.summaryValue}>
                  {tempDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>TIME</Text>
                <Text style={styles.summaryValue}>{fmtTime}</Text>
              </View>
            </View>

            {/* Calendar Card */}
            <View style={styles.card}>
              <View style={styles.calHeader}>
                <Text style={styles.calTitle}>{MONTHS[viewMonth.getMonth()].toUpperCase()} {viewMonth.getFullYear()}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={styles.calNavBtn} onPress={() => changeMonth(-1)} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={16} color={C.onSurfaceVariant} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.calNavBtn} onPress={() => changeMonth(1)} activeOpacity={0.7}>
                    <Ionicons name="chevron-forward" size={16} color={C.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
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
                      style={[styles.dayCell, sel && styles.dayCellSelected, isTodayDate && !sel && styles.dayCellToday]}
                      onPress={() => handleDateSelect(day)}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.dayText, sel && styles.dayTextSelected, isTodayDate && !sel && styles.dayTextToday]}>
                        {day.getDate()}
                      </Text>
                      {isTodayDate && !sel && <View style={styles.todayDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Time Card */}
            <View style={styles.card}>
              <Text style={styles.timeTitle}>SET TIME</Text>
              <View style={styles.spinnerRow}>
                <View style={styles.spinnerHighlight} />
                <View style={styles.spinnerColumn}>
                  <ScrollView
                    ref={hourScrollRef}
                    style={styles.spinner}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={SPIN_ITEM_H}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / SPIN_ITEM_H);
                      const h = HOURS[Math.min(Math.max(idx, 0), HOURS.length - 1)];
                      setHour(h);
                    }}
                  >
                    <View style={{ height: SPIN_PAD }} />
                    {HOURS.map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={styles.spinItem}
                        onPress={() => { setHour(h); scrollToHour(h); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.spinItemText, hour === h && styles.spinItemTextActive]}>
                          {String(h).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <View style={{ height: SPIN_PAD }} />
                  </ScrollView>
                </View>

                <Text style={styles.spinnerColon}>:</Text>

                <View style={styles.spinnerColumn}>
                  <ScrollView
                    ref={minuteScrollRef}
                    style={styles.spinner}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={SPIN_ITEM_H}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(e) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.y / SPIN_ITEM_H);
                      const m = MINUTES[Math.min(Math.max(idx, 0), MINUTES.length - 1)];
                      setMinute(m);
                    }}
                  >
                    <View style={{ height: SPIN_PAD }} />
                    {MINUTES.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={styles.spinItem}
                        onPress={() => { setMinute(m); scrollToMinute(m); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.spinItemText, minute === m && styles.spinItemTextActive]}>
                          {String(m).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <View style={{ height: SPIN_PAD }} />
                  </ScrollView>
                </View>

                {/* AM/PM segmented control */}
                <View style={styles.periodGroup}>
                  {(['AM', 'PM'] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                      onPress={() => setPeriod(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Bottom action bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.applyBtn]} onPress={handleConfirm} activeOpacity={0.85}>
              <Text style={styles.applyText}>Apply Selection</Text>
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
    maxHeight: '94%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: 'rgba(21,18,27,0.9)',
  },
  iconBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.onSurface,
    letterSpacing: -0.3,
  },
  body: { flexShrink: 1, paddingHorizontal: 24, paddingVertical: 20, gap: 14 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,30,40,0.6)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: 16,
    marginBottom: 14,
    gap: 16,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: C.primary,
    letterSpacing: -0.3,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  card: {
    backgroundColor: C.surfaceLow,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: 16,
    marginBottom: 14,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  calTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.onSurface,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(204,195,216,0.5)',
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  dayCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    position: 'relative',
  },
  dayCellSelected: {
    backgroundColor: C.primaryContainer,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: 'rgba(124,58,237,0.1)',
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: C.onSurface,
  },
  dayTextSelected: {
    color: C.onPrimary,
    fontWeight: '700',
  },
  dayTextToday: {
    color: C.primary,
    fontWeight: '700',
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.primary,
  },
  timeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.onSurface,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 14,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    position: 'relative',
  },
  spinnerHighlight: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: (SPIN_H - SPIN_ITEM_H) / 2,
    height: SPIN_ITEM_H,
    backgroundColor: 'rgba(60,55,66,0.6)',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    pointerEvents: 'none',
  },
  spinnerColumn: {
    width: 64,
    alignItems: 'center',
  },
  spinner: {
    height: SPIN_H,
  },
  spinItem: {
    height: SPIN_ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinItemText: {
    fontSize: 18,
    fontWeight: '500',
    color: C.onSurfaceVariant,
  },
  spinItemTextActive: {
    fontSize: 24,
    fontWeight: '800',
    color: C.primary,
  },
  spinnerColon: {
    fontSize: 26,
    fontWeight: '300',
    color: 'rgba(204,195,216,0.3)',
  },
  periodGroup: {
    marginLeft: 4,
    backgroundColor: C.surfaceContainer,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: 4,
    gap: 4,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  periodBtnActive: {
    backgroundColor: C.primaryContainer,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.onSurfaceVariant,
  },
  periodBtnTextActive: {
    color: C.onPrimary,
    fontWeight: '700',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    backgroundColor: 'rgba(29,26,36,0.9)',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: C.outlineVariant,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.onSurface,
  },
  applyBtn: {
    backgroundColor: C.primaryContainer,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  applyText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.onPrimary,
  },
});
