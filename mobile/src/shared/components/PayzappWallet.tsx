import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Modal, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, rounded } from '../theme/spacing';
import { useFinanceStore, Transaction } from '../../modules/finance/store';
import { useAuth } from '../../services/AuthProvider';

interface WalletLoadEntry {
  id: string;
  date: string;
  amount: number;
  notes?: string;
  source: 'manual';
}

const WALLET_TARGET = 4000000; // ₹40,000 in paise
const WALLET_CASHBACK = 40000;  // ₹400 in paise
const WALLET_CASHBACK_RATE = 1; // 1% cashback via HDFC Millennia debit

const formatCur = (paise: number) => `\u20B9${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function PayzappWalletScreen() {
  const { user } = useAuth();
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const editTransaction = useFinanceStore((s) => s.editTransaction);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);

  // Filter wallet load transactions
  const walletLoads = useMemo(() => {
    return transactions
      .filter((tx: Transaction) =>
        tx.type === 'expense' &&
        (tx.category === 'Wallet Loads' || tx.category === 'Wallet Load' || tx.notes?.toLowerCase().includes('wallet'))
      )
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // Current month total
  const currentMonth = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return walletLoads
      .filter((tx: any) => new Date(tx.date) >= startOfMonth)
      .reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);
  }, [walletLoads]);

  const progress = Math.min(currentMonth / WALLET_TARGET, 1);
  const cashbackEarned = Math.round(currentMonth * WALLET_CASHBACK_RATE / 100);
  const remainingForTarget = Math.max(0, WALLET_TARGET - currentMonth);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [loadAmount, setLoadAmount] = useState('');
  const [loadDate, setLoadDate] = useState(new Date().toISOString().slice(0, 10));
  const [loadNotes, setLoadNotes] = useState('');

  // Edit modal
  const [editingLoad, setEditingLoad] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const handleAdd = () => {
    const amt = parseFloat(loadAmount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Enter valid amount'); return; }
    const amountPaise = Math.round(amt * 100);

    const id = addTransaction({
      type: 'expense',
      amount: amountPaise,
      currency: 'INR',
      category: 'Wallet Loads',
      notes: loadNotes.trim() || `Payzapp wallet load`,
      source: 'manual',
    }, user?.id);

    // Immediately update date if user picked a specific date
    if (loadDate) {
      const date = new Date(loadDate);
      date.setHours(10, 0, 0, 0);
      if (id) editTransaction(id, { date: date.toISOString() }, user?.id);
    }

    setShowAddModal(false);
    setLoadAmount('');
    setLoadNotes('');
    setLoadDate(new Date().toISOString().slice(0, 10));
  };

  const handleEdit = () => {
    if (!editingLoad) return;
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Enter valid amount'); return; }
    const amountPaise = Math.round(amt * 100);
    const date = new Date(editDate);
    date.setHours(10, 0, 0, 0);

    editTransaction(editingLoad.id, {
      amount: amountPaise,
      date: date.toISOString(),
      notes: editNotes.trim() || editingLoad.notes,
    }, user?.id);

    setEditingLoad(null);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this wallet load entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(id, user?.id) },
    ]);
  };

  const openEdit = (tx: Transaction) => {
    setEditingLoad(tx);
    setEditAmount((tx.amount / 100).toString());
    setEditDate(new Date(tx.date).toISOString().slice(0, 10));
    setEditNotes(tx.notes || '');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="wallet" size={20} color="#84CC16" />
        <Text style={styles.title}>Payzapp Wallet Loads</Text>
        <View style={styles.targetBadge}>
          <Text style={styles.targetText}>Target: {formatCur(WALLET_TARGET)}</Text>
        </View>
      </View>

      {/* Progress Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>Loaded This Month</Text>
          <Text style={styles.progressValue}>{formatCur(currentMonth)}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.metaText}>
            {progress >= 1 ? 'Target reached!' : `₹${(remainingForTarget / 100).toLocaleString('en-IN')} left to load`}
          </Text>
          <Text style={styles.cashbackText}>
            Cashback earned: +{formatCur(cashbackEarned)}
          </Text>
        </View>
        {currentMonth > 0 && (
          <Text style={styles.rateNote}>
            1% cashback via HDFC Millennia Debit Card (max ₹400/month on ₹40K load)
          </Text>
        )}
      </View>

      {/* Add button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          setLoadAmount('');
          setLoadNotes('');
          setLoadDate(new Date().toISOString().slice(0, 10));
          setShowAddModal(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={18} color="#fff" />
        <Text style={styles.addButtonText}>Log Wallet Load</Text>
      </TouchableOpacity>

      {/* Transactions */}
      <Text style={styles.sectionTitle}>LOAD HISTORY</Text>
      {walletLoads.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="wallet-outline" size={24} color={colors.outline} />
          <Text style={styles.emptyText}>No wallet loads recorded yet.</Text>
          <Text style={styles.emptySubtext}>Tap "Log Wallet Load" to add one manually.</Text>
        </View>
      ) : (
        <ScrollView style={styles.loadsList} showsVerticalScrollIndicator={false}>
          {walletLoads.map((tx: Transaction) => (
            <View key={tx.id} style={styles.loadRow}>
              <View style={styles.loadLeft}>
                <View style={[styles.loadDot, { backgroundColor: '#84CC16' }]} />
                <View>
                  <Text style={styles.loadAmount}>-{formatCur(tx.amount)}</Text>
                  <Text style={styles.loadDate}>
                    {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' · Manual'}
                  </Text>
                  {tx.notes ? <Text style={styles.loadNotes}>{tx.notes}</Text> : null}
                </View>
              </View>
              <View style={styles.loadActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(tx)}>
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(tx.id)}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log Wallet Load</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
              <TextInput
                style={styles.textInput}
                value={loadAmount}
                onChangeText={setLoadAmount}
                keyboardType="decimal-pad"
                placeholder="40000"
                placeholderTextColor={colors.outline}
                autoFocus
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DATE</Text>
              <TextInput
                style={styles.textInput}
                value={loadDate}
                onChangeText={setLoadDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.outline}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={styles.textInput}
                value={loadNotes}
                onChangeText={setLoadNotes}
                placeholder="Payzapp load via HDFC Millennia"
                placeholderTextColor={colors.outline}
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
                <Text style={styles.saveBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editingLoad} transparent animationType="fade" onRequestClose={() => setEditingLoad(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Wallet Load</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
              <TextInput
                style={styles.textInput}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.outline}
                autoFocus
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DATE</Text>
              <TextInput
                style={styles.textInput}
                value={editDate}
                onChangeText={setEditDate}
                placeholderTextColor={colors.outline}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOTES</Text>
              <TextInput
                style={styles.textInput}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholderTextColor={colors.outline}
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingLoad(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleEdit}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    flex: 1,
  },
  targetBadge: {
    backgroundColor: 'rgba(132, 204, 22, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: rounded.full,
    borderWidth: 1,
    borderColor: 'rgba(132, 204, 22, 0.2)',
  },
  targetText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#84CC16',
  },
  progressCard: {
    backgroundColor: 'rgba(132, 204, 22, 0.04)',
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(132, 204, 22, 0.1)',
    padding: 14,
    gap: 10,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#84CC16',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#84CC16',
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  cashbackText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  rateNote: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    backgroundColor: '#84CC16',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  emptySubtext: {
    fontSize: 11,
    color: colors.outline,
    textAlign: 'center',
    lineHeight: 16,
  },
  loadsList: {
    maxHeight: 250,
  },
  loadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  loadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  loadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  loadDate: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  loadNotes: {
    fontSize: 10,
    color: colors.outline,
    marginTop: 1,
    fontStyle: 'italic',
  },
  loadActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    padding: 8,
    borderRadius: rounded.full,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 44,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: '500',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
});
