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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

  const formattedDate = tempDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const headerTimeStr = `${hour}:${String(minute).padStart(2, '0')} ${period}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Material Design 3 style header */}
          <View style={styles.header}>
            {mode === 'date' ? (
              <>
                <Text style={styles.headerYear}>{tempDate.getFullYear()}</Text>
                <Text style={styles.headerDate}>{formattedDate}</Text>
              </>
            ) : (
              <>
                <Text style={styles.headerYear}>{tempDate.getFullYear()}</Text>
                <Text style={styles.headerTime}>{headerTimeStr}</Text>
                <Text style={styles.headerDateSmall}>{formattedDate}</Text>
              </>
            )}
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
                      onPress={() => handleDateSelect(day)}
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
                <TouchableOpacity style={styles.footerBtn} onPress={handleCancel}>
                  <Text style={styles.footerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerBtn} onPress={() => setMode('time')}>
                  <Text style={styles.footerOkText}>Next: Time</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Time Picker */}
              <View style={styles.timeContainer}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeColLabel}>Hour</Text>
                  <ScrollView
                    style={styles.timeScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
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
                  <Text style={styles.timeColLabel}>Min</Text>
                  <ScrollView
                    style={styles.timeScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
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

                {/* AM/PM */}
                <View style={styles.periodCol}>
                  {(['AM', 'PM'] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                      onPress={() => setPeriod(p)}
                    >
                      <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.backToDateBtn} onPress={() => setMode('date')}>
                <Ionicons name="arrow-back" size={16} color={colors.onSurfaceVariant} />
                <Text style={styles.backToDateText}>Back to Date</Text>
              </TouchableOpacity>

              <View style={styles.footerRow}>
                <TouchableOpacity style={styles.footerBtn} onPress={handleCancel}>
                  <Text style={styles.footerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.footerOkText}>OK</Text>
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
  headerDateSmall: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  headerTime: {
    fontSize: 36,
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
    gap: 8,
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
  footerOkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  timeColumn: {
    alignItems: 'center',
    gap: 6,
  },
  timeColLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  timeScroll: {
    height: 180,
  },
  timeItem: {
    width: 60,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rounded.DEFAULT,
    marginVertical: 1,
  },
  timeItemActive: {
    backgroundColor: `${colors.primary}20`,
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
  periodCol: {
    marginTop: 28,
    gap: 6,
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
  backToDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backToDateText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: rounded.DEFAULT,
  },
});
