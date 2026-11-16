/**
 * TimePicker — pick a time on a round clock (OnePlus OxygenOS).
 *
 * A centred popup card with the round dial: the hour is picked first, then
 * the minutes — every single minute, not the old 5-minute steps.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { op, OP_CARD_RADIUS, OP_CHIP_RADIUS } from '../theme/oneplus';
import ClockFace from './ClockFace';
import { hour12From24, periodFrom24, type ClockMode, type ClockPeriod } from './clockMath';

interface TimePickerProps {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

export default function TimePicker({ visible, selected, onSelect, onClose }: TimePickerProps) {
  const [hours24, setHours24] = useState(selected.getHours());
  const [minute, setMinute] = useState(selected.getMinutes());
  const [mode, setMode] = useState<ClockMode>('hours');

  // Primitives as deps — `selected` is rebuilt on every render upstream, so
  // depending on it resets the picked time on each keystroke.
  const selHour = selected.getHours();
  const selMinute = selected.getMinutes();
  useEffect(() => {
    if (!visible) return;
    setHours24(selHour);
    setMinute(selMinute);
    setMode('hours');
  }, [visible, selHour, selMinute]);

  const handleChange = (next: {
    hours24?: number;
    minute?: number;
  }) => {
    if (next.hours24 !== undefined) setHours24(next.hours24);
    if (next.minute !== undefined) setMinute(next.minute);
    // The mode advance happens in the dial itself (a tap, not a drag).
  };

  const applyPeriod = (period: ClockPeriod) => {
    if (periodFrom24(hours24) === period) return;
    setHours24(period === 'PM' ? (hours24 % 12) + 12 : hours24 % 12);
  };

  const handleDone = () => {
    const d = new Date(selected);
    d.setHours(hours24, minute, 0, 0);
    onSelect(d);
    onClose();
  };

  const hourLabel = String(hour12From24(hours24) === 0 ? 12 : hour12From24(hours24));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* The backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerLabel}>{mode === 'hours' ? 'HOUR' : 'MINUTE'}</Text>
              <View style={styles.headerValueRow}>
                {/* Tapping a unit in the readout switches the dial mode:
                    the hand you then drag is the unit you tapped. */}
                <Pressable
                  onPress={() => setMode('hours')}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 2 }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit hours"
                  accessibilityState={{ selected: mode === 'hours' }}
                >
                  <Text style={[styles.headerValue, mode === 'hours' && styles.headerValueActive]}>
                    {hourLabel}
                  </Text>
                </Pressable>
                <Text style={styles.headerValue}>:</Text>
                <Pressable
                  onPress={() => setMode('minutes')}
                  hitSlop={{ top: 6, bottom: 6, left: 2, right: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit minutes"
                  accessibilityState={{ selected: mode === 'minutes' }}
                >
                  <Text style={[styles.headerValue, mode === 'minutes' && styles.headerValueActive]}>
                    {String(minute).padStart(2, '0')}
                  </Text>
                </Pressable>
                {/* The AM/PM lives up here next to the time — tap to flip */}
                <Pressable
                  style={styles.periodToggle}
                  onPress={() => applyPeriod(periodFrom24(hours24) === 'AM' ? 'PM' : 'AM')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle AM or PM"
                  accessibilityState={{ selected: periodFrom24(hours24) === 'PM' }}
                >
                  <Text style={styles.headerPeriod}>{periodFrom24(hours24)}</Text>
                </Pressable>
              </View>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={op.muted} />
            </Pressable>
          </View>

          <View style={styles.clockWrap}>
            <ClockFace
              hours24={hours24}
              minute={minute}
              mode={mode}
              onChange={handleChange}
              onSelectMode={setMode}
            />
          </View>

          <View style={styles.actions}>
            <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.doneBtn]} onPress={handleDone}>
              <Text style={styles.doneText}>Done</Text>
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
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: op.card,
    borderRadius: OP_CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: op.hairline,
    padding: 18,
    paddingBottom: 14,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 6,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: op.red,
  },
  headerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 10,
  },
  headerValue: {
    fontSize: 24,
    fontWeight: '700',
    color: op.white,
    letterSpacing: -0.5,
  },
  headerValueActive: {
    color: op.red,
  },
  periodToggle: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: op.hairline,
    backgroundColor: op.surface,
  },
  headerPeriod: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: op.red,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: op.surface,
  },
  clockWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    marginBottom: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
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
