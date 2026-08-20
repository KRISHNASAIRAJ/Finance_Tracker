/**
 * TimePicker — Time-only picker modal with hour/minute/period scroll wheels.
 */
import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TimePickerProps {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

// Meridian design tokens (from Stitch "Date & Time Picker" screen — time section)
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

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

const SPIN_ITEM_H = 42;
const SPIN_PAD = 49;
const SPIN_H = 140;

export default function TimePicker({ visible, selected, onSelect, onClose }: TimePickerProps) {
  const hours24 = selected.getHours();
  const [period, setPeriod] = useState<'AM' | 'PM'>(hours24 >= 12 ? 'PM' : 'AM');
  const [hour, setHour] = useState(hours24 % 12 || 12);
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
      setPeriod(selected.getHours() >= 12 ? 'PM' : 'AM');
      setHour(selected.getHours() % 12 || 12);
      setMinute(Math.round(selected.getMinutes() / 5) * 5);
      setTimeout(() => {
        scrollToHour(selected.getHours() % 12 || 12);
        scrollToMinute(Math.round(selected.getMinutes() / 5) * 5);
      }, 120);
    }
  }, [visible, selected]);

  const handleDone = () => {
    let h = hour % 12;
    if (period === 'PM') h += 12;
    const d = new Date(selected);
    d.setHours(h, minute, 0, 0);
    onSelect(d);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={C.onSurfaceVariant} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select Time</Text>
            <View style={styles.iconBtn} />
          </View>

          {/* Summary */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryValue}>
              {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')} {period}
            </Text>
          </View>

          {/* Time spinners */}
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
                  setHour(HOURS[Math.min(Math.max(idx, 0), HOURS.length - 1)]);
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
                  setMinute(MINUTES[Math.min(Math.max(idx, 0), MINUTES.length - 1)]);
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

          {/* Bottom action bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.doneBtn]} onPress={handleDone} activeOpacity={0.85}>
              <Text style={styles.doneText}>Done</Text>
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
  summaryRow: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: -0.5,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    position: 'relative',
    paddingBottom: 8,
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
  doneBtn: {
    backgroundColor: C.primaryContainer,
    shadowColor: C.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  doneText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.onPrimary,
  },
});
