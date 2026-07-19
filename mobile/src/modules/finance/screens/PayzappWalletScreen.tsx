import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore, Transaction } from '../store';
import { useAuth } from '../../../services/AuthProvider';

const WALLET_TARGET = 4000000; // ₹40,000 in paise
const formatCur = (paise: number) => `\u20B9${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function PayzappWalletScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const editTransaction = useFinanceStore((s) => s.editTransaction);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);

  const walletLoads = useMemo(() =>
    transactions
      .filter((tx: Transaction) =>
        tx.type === 'expense' &&
        (tx.category === 'Wallet Loads' || tx.category === 'Wallet Load' ||
         tx.notes?.toLowerCase().includes('wallet load') ||
         tx.notes?.toLowerCase().includes('payzapp'))
      )
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [transactions]);

  const currentMonth = useMemo(() => {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return walletLoads
      .filter((tx: any) => new Date(tx.date) >= start)
      .reduce((s: number, t: Transaction) => s + t.amount, 0);
  }, [walletLoads]);

  const progress = Math.min(currentMonth / WALLET_TARGET, 1);
  const cashback = Math.round(currentMonth * 0.01);
  const remaining = Math.max(0, WALLET_TARGET - currentMonth);

  const [showAdd, setShowAdd] = useState(false);
  const [loadAmt, setLoadAmt] = useState('');
  const [loadDt, setLoadDt] = useState(new Date().toISOString().slice(0, 10));
  const [loadNote, setLoadNote] = useState('');

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editAmt, setEditAmt] = useState('');
  const [editDt, setEditDt] = useState('');
  const [editNote, setEditNote] = useState('');

  const handleAdd = () => {
    const a = parseFloat(loadAmt);
    if (isNaN(a) || a <= 0) { Alert.alert('Enter valid amount'); return; }
    const id = addTransaction({
      type: 'expense', amount: Math.round(a * 100), currency: 'INR',
      category: 'Wallet Loads', notes: loadNote.trim() || 'Payzapp wallet load', source: 'manual',
    }, user?.id);
    if (id && loadDt) {
      const d = new Date(loadDt); d.setHours(10, 0, 0, 0);
      editTransaction(id, { date: d.toISOString() }, user?.id);
    }
    setShowAdd(false); setLoadAmt(''); setLoadNote('');
    setLoadDt(new Date().toISOString().slice(0, 10));
  };

  const handleEdit = () => {
    if (!editing) return;
    const a = parseFloat(editAmt);
    if (isNaN(a) || a <= 0) { Alert.alert('Enter valid amount'); return; }
    const d = new Date(editDt); d.setHours(10, 0, 0, 0);
    editTransaction(editing.id, {
      amount: Math.round(a * 100),
      date: d.toISOString(),
      notes: editNote.trim() || editing.notes,
    }, user?.id);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this wallet load?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(id, user?.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Payzapp Wallet Loads</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Loaded This Month</Text>
            <Text style={styles.progressVal}>{formatCur(currentMonth)}</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.progressBottom}>
            <Text style={styles.metaText}>
              {progress >= 1 ? 'Done!' : `${formatCur(remaining)} left`}
            </Text>
            <Text style={styles.cashbackText}>
              Earned: +{formatCur(cashback)}
            </Text>
          </View>

        </View>

        {/* Add button */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setLoadAmt(''); setLoadNote('');
            setLoadDt(new Date().toISOString().slice(0, 10));
            setShowAdd(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={18} color="#000" />
          <Text style={styles.addBtnText}>Log Wallet Load</Text>
        </TouchableOpacity>

        {/* Load History */}
        <Text style={styles.sectionLabel}>LOAD HISTORY</Text>
        {walletLoads.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="wallet-outline" size={24} color={colors.outline} />
            <Text style={styles.emptyText}>No wallet loads recorded yet.</Text>
            <Text style={styles.emptySub}>SMS auto-detection works for HDFC debit wallet load messages.</Text>
          </View>
        ) : (
          walletLoads.map((tx: Transaction) => (
            <View key={tx.id} style={styles.loadItem}>
              <View style={styles.loadLeft}>
                <View style={[styles.loadDot, { backgroundColor: tx.source === 'sms_auto' ? '#3B82F6' : '#84CC16' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.loadAmt}>-{formatCur(tx.amount)}</Text>
                  <Text style={styles.loadDt}>
                    {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {tx.source === 'sms_auto' ? ' · Auto' : ' · Manual'}
                  </Text>
                  {tx.notes ? <Text style={styles.loadNotes}>{tx.notes}</Text> : null}
                </View>
              </View>
              <View style={styles.loadActions}>
                <TouchableOpacity style={styles.actBtn} onPress={() => {
                  setEditing(tx); setEditAmt((tx.amount / 100).toString());
                  setEditDt(new Date(tx.date).toISOString().slice(0, 10));
                  setEditNote(tx.notes || '');
                }}>
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actBtn} onPress={() => handleDelete(tx.id)}>
                  <Ionicons name="trash-outline" size={15} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.mOverlay}>
          <View style={styles.mCard}>
            <Text style={styles.mTitle}>Log Wallet Load</Text>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>AMOUNT (₹)</Text>
              <TextInput style={styles.inp} value={loadAmt} onChangeText={setLoadAmt} keyboardType="decimal-pad" placeholder="40000" placeholderTextColor={colors.outline} autoFocus />
            </View>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>DATE</Text>
              <TextInput style={styles.inp} value={loadDt} onChangeText={setLoadDt} placeholder="YYYY-MM-DD" placeholderTextColor={colors.outline} />
            </View>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>NOTES (OPTIONAL)</Text>
              <TextInput style={styles.inp} value={loadNote} onChangeText={setLoadNote} placeholder="Payzapp load via HDFC Millennia" placeholderTextColor={colors.outline} />
            </View>
            <View style={styles.mBtns}>
              <TouchableOpacity style={styles.mCancel} onPress={() => setShowAdd(false)}><Text style={styles.mCancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.mSave} onPress={handleAdd}><Text style={styles.mSaveTxt}>Add</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.mOverlay}>
          <View style={styles.mCard}>
            <Text style={styles.mTitle}>Edit Wallet Load</Text>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>AMOUNT (₹)</Text>
              <TextInput style={styles.inp} value={editAmt} onChangeText={setEditAmt} keyboardType="decimal-pad" placeholderTextColor={colors.outline} autoFocus />
            </View>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>DATE</Text>
              <TextInput style={styles.inp} value={editDt} onChangeText={setEditDt} placeholderTextColor={colors.outline} />
            </View>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>NOTES</Text>
              <TextInput style={styles.inp} value={editNote} onChangeText={setEditNote} placeholderTextColor={colors.outline} />
            </View>
            <View style={styles.mBtns}>
              <TouchableOpacity style={styles.mCancel} onPress={() => setEditing(null)}><Text style={styles.mCancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.mSave} onPress={handleEdit}><Text style={styles.mSaveTxt}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  appBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 56, paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: { padding: 6, borderRadius: rounded.full },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  scroll: { padding: spacing.containerPadding, gap: 16, paddingBottom: 60 },
  progressCard: {
    backgroundColor: 'rgba(132,204,22,0.04)', borderRadius: rounded.DEFAULT,
    borderWidth: 1, borderColor: 'rgba(132,204,22,0.1)', padding: 16, gap: 10,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressLabel: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  progressVal: { fontSize: 24, fontWeight: '800', color: '#84CC16' },
  barBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: '#84CC16' },
  progressBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontSize: 11, color: colors.onSurfaceVariant },
  cashbackText: { fontSize: 13, fontWeight: '700', color: colors.success },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: rounded.DEFAULT, backgroundColor: '#84CC16',
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#000' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  emptyWrap: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyText: { fontSize: 12, color: colors.onSurfaceVariant },
  emptySub: { fontSize: 11, color: colors.outline, textAlign: 'center' },
  loadItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  loadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  loadDot: { width: 8, height: 8, borderRadius: 4 },
  loadAmt: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  loadDt: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 1 },
  loadNotes: { fontSize: 10, color: colors.outline, marginTop: 1, fontStyle: 'italic' },
  loadActions: { flexDirection: 'row', gap: 4 },
  actBtn: { padding: 8, borderRadius: rounded.full },
  mOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  mCard: { backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 24, gap: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  mTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  inpGrp: { gap: 6 },
  inpLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  inp: {
    backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', height: 44,
    paddingHorizontal: 12, color: colors.onSurface, fontSize: 14, fontWeight: '500',
  },
  mBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  mCancel: { flex: 1, paddingVertical: 12, borderRadius: rounded.DEFAULT, alignItems: 'center' },
  mCancelTxt: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
  mSave: { flex: 1, paddingVertical: 12, borderRadius: rounded.DEFAULT, backgroundColor: colors.primaryContainer, alignItems: 'center' },
  mSaveTxt: { fontSize: 14, color: '#fff', fontWeight: '700' },
});
