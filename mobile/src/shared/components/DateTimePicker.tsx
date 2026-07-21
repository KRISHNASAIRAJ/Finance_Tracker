import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { rounded } from '../theme/spacing';

interface DateTimePickerProps {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function DateTimePicker({ visible, selected, onSelect, onClose }: DateTimePickerProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date(selected));
  const [tempDate, setTempDate] = useState<Date>(() => new Date(selected));
  const [mode, setMode] = useState<'date' | 'time'>('date');
  const [period, setPeriod] = useState<'AM' | 'PM'>(selected.getHours() >= 12 ? 'PM' : 'AM');
  const [hour, setHour] = useState(selected.getHours() % 12 || 12);
  const [minute, setMinute] = useState(selected.getMinutes());

  const isSelected = useCallback(
    (d: Date) =>
      d.getDate() === tempDate.getDate() &&
      d.getMonth() === tempDate.getMonth() &&
      d.getFullYear() === tempDate.getFullYear(),
    [tempDate]
  );

  const isToday = useCallback((d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }, []);

  const changeMonth = (offset: number) => {
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() + offset);
    setViewMonth(d);
  };

  const getDays = () => {
    const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
    const totalDays = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const today = new Date();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i);
      if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() < today.getDate()) {
        d.setHours(0, 0, 0, -1);
      }
      days.push(d);
    }
    return days;
  };

  const handleDateSelect = (d: Date) => {
    const updated = new Date(tempDate);
    updated.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setTempDate(updated);
    setMode('time');
  };

  const handleConfirm = () => {
    let h = hour % 12;
    if (period === 'PM') h += 12;
    const result = new Date(tempDate);
    result.setHours(h, minute, 0, 0);
    onSelect(result);
    setMode('date');
    onClose();
  };

  const handleCancel = () => {
    setMode('date');
    onClose();
  };

  const headerDateStr = tempDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const headerTimeStr = `${hour}:${String(minute).padStart(2, '0')} ${period}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {mode === 'date' ? (
                <>
                  <Ionicons name="calendar-outline" size={48} color="#fff" />
                  <Text style={styles.headerTitle}>Select Date</Text>
                  <Text style={styles.headerSub}>{headerDateStr}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="time-outline" size={48} color="#fff" />
                  <Text style={styles.headerTitle}>Select Time</Text>
                  <Text style={styles.headerSub}>{headerTimeStr}</Text>
                </>
              )}
            </View>
          </View>

          {mode === 'date' ? (
            <>
              {/* Month Navigator */}
              <View style={styles.monthNav}>
                <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)}>
                  <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
                </TouchableOpacity>
                <Text style={styles.monthLabel}>
                  {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                </Text>
                <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)}>
                  <Ionicons name="chevron-forward" size={22} color={colors.onSurface} />
                </TouchableOpacity>
              </View>

              {/* Day headers */}
              <View style={styles.weekRow}>
                {DAYS.map((d, i) => (
                  <Text key={i} style={styles.weekLabel}>{d}</Text>
                ))}
              </View>

              {/* Days grid */}
              <View style={styles.daysGrid}>
                {getDays().map((day, i) => {
                  if (!day) return <View key={i} style={styles.dayCell} />;
                  const disabled = day.getHours() === -1;
                  const selected = isSelected(day);
                  const today = isToday(day);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.dayCell,
                        selected && styles.dayCellSelected,
                        today && !selected && styles.dayCellToday,
                      ]}
                      onPress={() => !disabled && handleDateSelect(day)}
                      disabled={disabled}
                      activeOpacity={0.6}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          disabled && styles.dayTextDisabled,
                          selected && styles.dayTextSelected,
                          today && !selected && styles.dayTextToday,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Time Picker */}
              <View style={styles.timeContainer}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeColLabel}>HOUR</Text>
                  <ScrollView
                    style={styles.timeScroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.timeScrollContent}
                  >
                    {HOURS.map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[styles.timeItem, hour === h && styles.timeItemActive]}
                        onPress={() => setHour(h)}
                      >
                        <Text style={[styles.timeItemText, hour === h && styles.timeItemTextActive]}>
                          {String(h).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <Text style={styles.timeColon}>:</Text>

                <View style={styles.timeColumn}>
                  <Text style={styles.timeColLabel}>MIN</Text>
                  <ScrollView
                    style={styles.timeScroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.timeScrollContent}
                  >
                    {MINUTES.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.timeItem, minute === m && styles.timeItemActive]}
                        onPress={() => setMinute(m)}
                      >
                        <Text style={[styles.timeItemText, minute === m && styles.timeItemTextActive]}>
                          {String(m).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.periodColumn}>
                  <TouchableOpacity
                    style={[styles.periodBtn, period === 'AM' && styles.periodBtnActive]}
                    onPress={() => setPeriod('AM')}
                  >
                    <Text style={[styles.periodBtnText, period === 'AM' && styles.periodBtnTextActive]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.periodBtn, period === 'PM' && styles.periodBtnActive]}
                    onPress={() => setPeriod('PM')}
                  >
                    <Text style={[styles.periodBtnText, period === 'PM' && styles.periodBtnTextActive]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.timeActions}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setMode('date')}>
                  <Ionicons name="arrow-back" size={18} color={colors.onSurfaceVariant} />
                  <Text style={styles.backText}>Back to Date</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.confirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
  },
  header: {
    backgroundColor: colors.primaryContainer,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 20,
  },
  headerLeft: {
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rounded.full,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface,
  },
  dayTextDisabled: {
    color: 'rgba(255,255,255,0.15)',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  timeColumn: {
    alignItems: 'center',
    gap: 8,
  },
  timeColLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  timeScroll: {
    height: 180,
  },
  timeScrollContent: {
    alignItems: 'center',
  },
  timeItem: {
    width: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rounded.DEFAULT,
    marginVertical: 2,
  },
  timeItemActive: {
    backgroundColor: `${colors.primary}25`,
  },
  timeItemText: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  timeItemTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  timeColon: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.onSurfaceVariant,
    marginTop: 28,
  },
  periodColumn: {
    marginTop: 28,
    gap: 8,
  },
  periodBtn: {
    width: 52,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  periodBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  periodBtnTextActive: {
    color: '#fff',
  },
  timeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  backText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: rounded.DEFAULT,
  },
  confirmText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
});
