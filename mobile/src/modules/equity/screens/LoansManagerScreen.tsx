/**
 * LoansManagerScreen — view/add/edit/delete outstanding loans and fixed deposits.
 * Net worth = investments + FDs − loans, reflected on the Wealth dashboard.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useInvestmentsStore, Loan, FixedDeposit } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { tc, ts, tr, card } from '../../../shared/theme/tracend';

type EditorTarget =
  | { kind: 'loan'; item: Loan }
  | { kind: 'fd'; item: FixedDeposit };

export default function LoansManagerScreen() {
  const navigation = useNavigation();
  const { loans, fds, addLoan, updateLoan, deleteLoan, addFD, updateFD, deleteFD } = useInvestmentsStore();
  const { user } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const formatCurrency = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;

  const openAdd = (kind: 'loan' | 'fd') => {
    setEditing(null);
    setName('');
    setAmount('');
    setKind(kind);
    setShowModal(true);
  };

  // Track which kind the modal is adding (edit derives it from `editing`).
  const [kind, setKind] = useState<'loan' | 'fd'>('loan');
  const effectiveKind: 'loan' | 'fd' = editing ? editing.kind : kind;

  const openEdit = (target: EditorTarget) => {
    setEditing(target);
    setName(target.item.name);
    setAmount((target.item.amount / 100).toString());
    setShowModal(true);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    const paise = Math.round(parseFloat(amount) * 100);
    if (!trimmed || isNaN(paise) || paise <= 0) {
      Alert.alert(
        'Invalid input',
        `Enter ${effectiveKind === 'loan' ? 'a loan' : 'an FD'} name and a valid amount.`
      );
      return;
    }
    if (effectiveKind === 'loan') {
      if (editing) updateLoan(editing.item.id, { name: trimmed, amount: paise }, user?.id);
      else addLoan({ name: trimmed, amount: paise }, user?.id);
    } else {
      if (editing) updateFD(editing.item.id, { name: trimmed, amount: paise }, user?.id);
      else addFD({ name: trimmed, amount: paise }, user?.id);
    }
    setShowModal(false);
  };

  const handleDelete = (target: EditorTarget) => {
    const label = target.kind === 'loan' ? 'loan' : 'FD';
    Alert.alert(
      `Delete ${label}`,
      `Remove "${target.item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            target.kind === 'loan'
              ? deleteLoan(target.item.id, user?.id)
              : deleteFD(target.item.id, user?.id),
        },
      ]
    );
  };

  const renderRows = (
    items: Array<Loan | FixedDeposit>,
    kind: 'loan' | 'fd'
  ) =>
    items.map((item) => {
      const target: EditorTarget = { kind, item };
      return (
        <View key={item.id} style={[card, styles.loanCard]}>
          <View style={kind === 'loan' ? styles.loanDot : styles.fdDot} />
          <View style={styles.loanInfo}>
            <Text style={styles.loanName} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.loanAmount, kind === 'fd' && { color: tc.stable }]}>
              {kind === 'loan' ? '−' : '+'}{formatCurrency(item.amount)}
            </Text>
          </View>
          <TouchableOpacity style={styles.loanAction} onPress={() => openEdit(target)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="create-outline" size={20} color={tc.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.loanAction} onPress={() => handleDelete(target)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={20} color={tc.attention} />
          </TouchableOpacity>
        </View>
      );
    });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={tc.action} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Loans & FDs</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => openAdd('loan')}>
          <Ionicons name="add" size={24} color={tc.action} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Loans section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="wallet-outline" size={15} color={tc.attention} />
            <Text style={styles.sectionTitle}>LOANS</Text>
          </View>
          <TouchableOpacity
            style={styles.sectionAdd}
            onPress={() => openAdd('loan')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add-circle" size={22} color={tc.action} />
          </TouchableOpacity>
        </View>
        {loans.length === 0 ? (
          <Text style={styles.emptySub}>No loans tracked. Net worth = investments + FDs − loans.</Text>
        ) : (
          renderRows(loans, 'loan')
        )}

        {/* FDs section */}
        <View style={[styles.sectionHeader, styles.fdSectionGap]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="lock-closed-outline" size={15} color={tc.stable} />
            <Text style={styles.sectionTitle}>FIXED DEPOSITS</Text>
          </View>
          <TouchableOpacity
            style={styles.sectionAdd}
            onPress={() => openAdd('fd')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add-circle" size={22} color={tc.action} />
          </TouchableOpacity>
        </View>
        {fds.length === 0 ? (
          <Text style={styles.emptySub}>No FDs tracked. FD amounts add to your net worth.</Text>
        ) : (
          renderRows(fds, 'fd')
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing
                ? editing.kind === 'loan' ? 'Edit Loan' : 'Edit FD'
                : effectiveKind === 'loan' ? 'Add Loan' : 'Add FD'}
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={effectiveKind === 'loan' ? 'Loan name (e.g. Home Loan)' : 'FD name (e.g. HDFC FD)'}
              placeholderTextColor={tc.textMuted}
            />
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder={effectiveKind === 'loan' ? 'Outstanding amount (₹)' : 'Deposit amount (₹)'}
              placeholderTextColor={tc.textMuted}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tc.canvas,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: ts.gutter,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tc.border,
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tc.textPrimary,
    letterSpacing: -0.3,
  },
  iconBtn: { padding: 8, borderRadius: tr.full },
  scroll: { padding: ts.gutter, gap: 12, paddingBottom: 40 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: tc.textSecondary,
    letterSpacing: 0.6,
  },
  sectionAdd: { padding: 4 },
  fdSectionGap: { marginTop: 12 },
  emptySub: { fontSize: 12, color: tc.textMuted, textAlign: 'center', paddingHorizontal: 24, paddingVertical: 8 },
  loanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  loanDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tc.attention,
  },
  fdDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tc.stable,
  },
  loanInfo: { flex: 1, gap: 2 },
  loanName: { fontSize: 14, fontWeight: '600', color: tc.textPrimary },
  loanAmount: { fontSize: 13, fontWeight: '700', color: tc.attention },
  loanAction: { padding: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: ts.gutter,
  },
  modalCard: {
    backgroundColor: tc.surfaceRaised,
    borderRadius: tr.lg,
    padding: 20,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: tc.textPrimary },
  input: {
    backgroundColor: 'rgba(244,247,251,0.04)',
    borderRadius: 10,
    padding: 12,
    color: tc.textPrimary,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: tc.textSecondary },
  saveBtn: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: tc.action,
  },
  saveText: { fontSize: 14, fontWeight: '700', color: tc.canvas },
});
