/**
 * LoansManagerScreen — view/add/edit/delete outstanding loans.
 * Net worth = investments − loans, reflected on the Wealth dashboard.
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
import { useInvestmentsStore, Loan } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { tc, ts, tr, card } from '../../../shared/theme/tracend';

export default function LoansManagerScreen() {
  const navigation = useNavigation();
  const { loans, addLoan, updateLoan, deleteLoan } = useInvestmentsStore();
  const { user } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const formatCurrency = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;

  const openAdd = () => {
    setEditing(null);
    setName('');
    setAmount('');
    setShowModal(true);
  };

  const openEdit = (loan: Loan) => {
    setEditing(loan);
    setName(loan.name);
    setAmount((loan.amount / 100).toString());
    setShowModal(true);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    const paise = Math.round(parseFloat(amount) * 100);
    if (!trimmed || isNaN(paise) || paise <= 0) {
      Alert.alert('Invalid input', 'Enter a loan name and a valid amount.');
      return;
    }
    if (editing) {
      updateLoan(editing.id, { name: trimmed, amount: paise }, user?.id);
    } else {
      addLoan({ name: trimmed, amount: paise }, user?.id);
    }
    setShowModal(false);
  };

  const handleDelete = (loan: Loan) => {
    Alert.alert(
      'Delete loan',
      `Remove "${loan.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteLoan(loan.id, user?.id) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={tc.action} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Loans</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={openAdd}>
          <Ionicons name="add" size={24} color={tc.action} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loans.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={40} color={tc.textMuted} />
            <Text style={styles.emptyTitle}>No loans tracked</Text>
            <Text style={styles.emptySub}>Tap + to add an outstanding loan. Net worth = investments − loans.</Text>
          </View>
        ) : (
          loans.map((loan) => (
            <View key={loan.id} style={[card, styles.loanCard]}>
              <View style={styles.loanDot} />
              <View style={styles.loanInfo}>
                <Text style={styles.loanName} numberOfLines={1}>{loan.name}</Text>
                <Text style={styles.loanAmount}>−{formatCurrency(loan.amount)}</Text>
              </View>
              <TouchableOpacity style={styles.loanAction} onPress={() => openEdit(loan)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={20} color={tc.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.loanAction} onPress={() => handleDelete(loan)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={20} color={tc.attention} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Loan' : 'Add Loan'}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Loan name (e.g. Home Loan)"
              placeholderTextColor={tc.textMuted}
            />
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="Outstanding amount (₹)"
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
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: tc.textPrimary },
  emptySub: { fontSize: 12, color: tc.textMuted, textAlign: 'center', paddingHorizontal: 24 },
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
