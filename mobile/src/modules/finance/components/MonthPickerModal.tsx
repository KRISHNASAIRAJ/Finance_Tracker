/**
 * MonthPickerModal — modal list picker for selecting a month (used by reports).
 */
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';

const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface MonthPickerModalProps {
  visible: boolean;
  selected: Date;
  maxMonth: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

export default function MonthPickerModal({ visible, selected, maxMonth, onSelect, onClose }: MonthPickerModalProps) {
  const months: { label: string; date: Date }[] = [];
  for (let y = maxMonth.getFullYear() - 1; y <= maxMonth.getFullYear(); y++) {
    for (let m = 0; m < 12; m++) {
      if (y === maxMonth.getFullYear() && m > maxMonth.getMonth()) break;
      const d = new Date(y, m, 1);
      months.push({ label: `${FULL_MONTHS[m]} ${y}`, date: d });
    }
  }
  months.reverse();

  const isSelected = (d: Date) =>
    d.getFullYear() === selected.getFullYear() && d.getMonth() === selected.getMonth();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>
          <Text style={styles.title}>Select Month</Text>
          <FlatList
            data={months}
            keyExtractor={(item) => item.label}
            style={styles.list}
            renderItem={({ item }) => {
              const active = isSelected(item.date);
              return (
                <TouchableOpacity
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => { onSelect(item.date); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rowText, active && styles.rowTextActive]}>{item.label}</Text>
                  {active && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
          />
        </TouchableOpacity>
      </TouchableOpacity>
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
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxHeight: '70%',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
    paddingBottom: 4,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: rounded.DEFAULT,
  },
  rowActive: {
    backgroundColor: `${colors.primary}15`,
  },
  rowText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface,
  },
  rowTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
