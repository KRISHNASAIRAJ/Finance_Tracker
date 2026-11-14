/**
 * DateTimePicker — pick a date AND a time (OnePlus OxygenOS).
 *
 * One centred popup card with two tabs: the calendar (DATE) and the round
 * clock (TIME). It opens inside the app window and it uses the same palette
 * as the widgets.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { op, OP_CARD_RADIUS, OP_CHIP_RADIUS } from '../theme/oneplus';
import ClockFace from './ClockFace';
import { hour12From24, periodFrom24, type ClockMode, type ClockPeriod } from './clockMath';

interface DateTimePickerProps {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Tab = 'date' | 'time';

export default function DateTimePicker({ visible, selected, onSelect, onClose }: DateTimePickerProps) {
  const [tab, setTab] = useState<Tab>('date');
  const [viewMonth, setViewMonth] = useState(() => new Date(selected));
  const [tempDate, setTempDate] = useState<Date>(() => new Date(selected));
  const [hours24, setHours24] = useState(selected.getHours());
  const [minute, setMinute] = useState(selected.getMinutes());
  const [mode, setMode] = useState<ClockMode>('hours');

  // Primitives as deps — `selected` is rebuilt on every render upstream.
  const selYear = selected.getFullYear();
  const selMonth = selected.getMonth();
  const selDay = selected.getDate();
  const selHour = selected.getHours();
  const selMinute = selected.getMinutes();
  useEffect(() => {
    if (!visible) return;
    setTab('date');
    setViewMonth(new Date(selYear, selMonth, selDay));
    setTempDate(new Date(selYear, selMonth, selDay));
    setHours24(selHour);
    setMinute(selMinute);
    setMode('hours');
  }, [visible, selYear, selMonth, selDay, selHour, selMinute]);

  const isSelected = (d: Date) =>
    d.getDate() === tempDate.getDate() &&
    d.getMonth() === tempDate.getMonth() &&
    d.getFullYear() === tempDate.getFullYear();

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

  const handleClockChange = (next: {
    hours24?: number;
    minute?: number;
    period?: ClockPeriod;
  }) => {
    if (next.hours24 !== undefined) setHours24(next.hours24);
    if (next.minute !== undefined) setMinute(next.minute);
    if (next.period !== undefined) {
      setHours24(next.period === 'PM' ? (hours24 % 12) + 12 : hours24 % 12);
    }
    // The mode advance happens in the dial itself (a tap, not a drag).
  };

  const applyPeriod = (period: ClockPeriod) => {
    // Idempotent: only flip when the pill differs from the current period.
    if (periodFrom24(hours24) === period) return;
    setHours24(period === 'PM' ? (hours24 % 12) + 12 : hours24 % 12);
  };

  const handleConfirm = () => {
    const result = new Date(tempDate);
    result.setHours(hours24, minute, 0, 0);
    onSelect(result);
    onClose();
  };

  const hourLabel = String(hour12From24(hours24) === 0 ? 12 : hour12From24(hours24));
  const timeLabel = `${hourLabel}:${String(minute).padStart(2, '0')} ${periodFrom24(hours24)}`;
  const dateLabel = tempDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* The backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Date &amp; Time</Text>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={op.muted} />
            </Pressable>
          </View>

          {/* The tabs */}
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, tab === 'date' && styles.tabActive]}
              onPress={() => setTab('date')}
            >
              <Text style={[styles.tabText, tab === 'date' && styles.tabTextActive]}>DATE</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, tab === 'time' && styles.tabActive]}
              onPress={() => setTab('time')}
            >
              <Text style={[styles.tabText, tab === 'time' && styles.tabTextActive]}>TIME</Text>
            </Pressable>
          </View>

          {/* The summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryValue}>{tab === 'date' ? dateLabel : timeLabel}</Text>
            <Text style={styles.summaryHint}>
              {tab === 'date' ? dateLabel : timeLabel}
            </Text>
          </View>

          {tab === 'date' ? (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <View style={styles.monthNav}>
                <Pressable style={styles.navBtn} onPress={() => changeMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-back" size={20} color={op.whiteDim} />
                </Pressable>
                <Text style={styles.monthLabel}>
                  {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                </Text>
                <Pressable style={styles.navBtn} onPress={() => changeMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-forward" size={20} color={op.whiteDim} />
                </Pressable>
              </View>

              <View style={styles.weekRow}>
                {WEEKDAYS.map((d, i) => (
                  <Text key={i} style={styles.weekLabel}>
                    {d}
                  </Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {getDays().map((day, i) => {
                  if (!day) return <View key={i} style={styles.dayCell} />;
                  const sel = isSelected(day);
                  const isTodayDate = day.toDateString() === new Date().toDateString();
                  return (
                    <Pressable
                      key={i}
                      style={[
                        styles.dayCell,
                        sel && styles.dayCellSelected,
                        isTodayDate && !sel && styles.dayCellToday,
                      ]}
                      onPress={() => handleDateSelect(day)}
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
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.clockWrap}>
              <ClockFace
                hours24={hours24}
                minute={minute}
                mode={mode}
                onChange={handleClockChange}
                onSelectMode={setMode}
                onSetPeriod={applyPeriod}
              />
            </View>
          )}

          <View style={styles.actions}>
            <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.doneBtn]} onPress={handleConfirm}>
              <Text style={styles.doneText}>Apply</Text>
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
    maxHeight: '92%',
    backgroundColor: op.card,
    borderRadius: OP_CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: op.hairline,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: op.white,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: op.surface,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: op.surface,
    borderRadius: OP_CHIP_RADIUS,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: op.red,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: op.muted,
  },
  tabTextActive: {
    color: op.white,
  },
  summary: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: op.white,
    letterSpacing: -0.4,
  },
  summaryHint: {
    marginTop: 2,
    fontSize: 12,
    color: op.muted,
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
  dayTextSelected: {
    color: op.white,
    fontWeight: '700',
  },
  dayTextToday: {
    color: op.red,
    fontWeight: '700',
  },
  clockWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
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
