/**
 * WalletBalanceEditor — a small modal to set the balance of one wallet.
 *
 * Shared by the Balance Summary and the Bank Accounts screen so both show the
 * same wallets with the same editor.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { rounded } from '../../../shared/theme/spacing';

interface Props {
  visible: boolean;
  /** Wallet name (e.g. "Amazon Pay") */
  name: string;
  /** Current balance in paise */
  amount: number;
  /** Save the new balance (paise) */
  onSave: (amountPaise: number) => void;
  onClose: () => void;
}

export default function WalletBalanceEditor({ visible, name, amount, onSave, onClose }: Props) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue(amount > 0 ? String(amount / 100) : '');
  }, [visible, amount]);

  const save = () => {
    const rupees = parseFloat(value.replace(/,/g, ''));
    onSave(Number.isFinite(rupees) ? Math.round(rupees * 100) : 0);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.subtitle}>Current balance in this wallet (₹)</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.onSurfaceVariant}
            autoFocus
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.save} onPress={save}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 20,
    gap: 10,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.onSurface, textAlign: 'center' },
  subtitle: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 4 },
  input: {
    backgroundColor: colors.background,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancel: { flex: 1, paddingVertical: 12, borderRadius: rounded.DEFAULT, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.onSurfaceVariant },
  save: { flex: 1, paddingVertical: 12, borderRadius: rounded.DEFAULT, alignItems: 'center', backgroundColor: colors.primaryContainer },
  saveText: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
});
