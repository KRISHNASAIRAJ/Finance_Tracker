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
    period?: ClockPeriod;
  }) => {
    if (next.hours24 !== undefined) setHours24(next.hours24);
    if (next.minute !== undefined) setMinute(next.minute);
    if (next.period !== undefined) {
      const h = next.period === 'PM' ? (hours24 % 12) + 12 : hours24 % 12;
      setHours24(h);
    }
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
              <Text style={styles.headerValue}>
                {hourLabel}:{String(minute).padStart(2, '0')}{' '}
                <Text style={styles.headerPeriod}>{periodFrom24(hours24)}</Text>
              </Text>
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
              onSetPeriod={applyPeriod}
            />
          </View>

          <Text style={styles.hint}>
            {mode === 'hours'
              ? 'Tap the hour, then drag the dial to set it.'
              : 'Tap the minute, then drag the dial — every minute counts.'}
          </Text>

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
  headerValue: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: '700',
    color: op.white,
    letterSpacing: -0.5,
  },
  headerPeriod: {
    fontSize: 13,
    fontWeight: '600',
    color: op.muted,
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
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    color: op.muted,
    marginTop: 8,
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
