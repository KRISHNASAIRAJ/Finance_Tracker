/**
 * PayzappWalletScreen — tracks Payzapp wallet loads.
 *
 * Restyled to the Meridian v2 reference: the month's total, a real
 * three-month bar chart, the big red "Log wallet load" action and the load
 * history.
 *
 * The old screen showed a hard-coded ₹40,000 target and a made-up 1%
 * "earned" cashback. Neither is real data, so both are gone — the screen
 * now only shows what the store actually holds.
 */
import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  BarChart,
  Card,
  Label,
  PressScale,
  Rise,
  Screen,
} from '../../../shared/components/meridian';
import { useFinanceStore, Transaction } from '../store';
import { useAuth } from '../../../services/AuthProvider';

const formatCur = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PayzappWalletScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const editTransaction = useFinanceStore((s) => s.editTransaction);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);

  const walletLoads = useMemo(
    () =>
      transactions
        .filter((tx: Transaction) =>
          tx.type === 'expense' &&
          (tx.category === 'Wallet Loads' ||
            tx.category === 'Wallet Load' ||
            tx.notes?.toLowerCase().includes('wallet load') ||
            tx.notes?.toLowerCase().includes('payzapp'))
        )
        .sort(
          (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
    [transactions]
  );

  const currentMonth = useMemo(() => {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return walletLoads
      .filter((tx: any) => new Date(tx.date) >= start)
      .reduce((s: number, t: Transaction) => s + t.amount, 0);
  }, [walletLoads]);

  const currentMonthCount = useMemo(() => {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return walletLoads.filter((tx: any) => new Date(tx.date) >= start).length;
  }, [walletLoads]);

  // The last three calendar months of real loads.
  const lastThreeMonths = useMemo(() => {
    const now = new Date();
    const out: { label: string; value: number; isCurrent: boolean }[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const value = walletLoads
        .filter((tx: any) => String(tx.date).slice(0, 7) === key)
        .reduce((s: number, t: Transaction) => s + t.amount, 0);
      out.push({
        label: MONTH_LABELS[d.getMonth()],
        value: value / 100,
        isCurrent: i === 0,
      });
    }
    return out;
  }, [walletLoads]);

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
    if (isNaN(a) || a <= 0) {
      Alert.alert('Enter valid amount');
      return;
    }
    const id = addTransaction(
      {
        type: 'expense',
        amount: Math.round(a * 100),
        currency: 'INR',
        category: 'Wallet Loads',
        notes: loadNote.trim() || 'Payzapp wallet load',
        source: 'manual',
      },
      user?.id
    );
    if (id && loadDt) {
      const d = new Date(loadDt);
      d.setHours(10, 0, 0, 0);
      editTransaction(id, { date: d.toISOString() }, user?.id);
    }
    setShowAdd(false);
    setLoadAmt('');
    setLoadNote('');
    setLoadDt(new Date().toISOString().slice(0, 10));
  };

  const handleEdit = () => {
    if (!editing) return;
    const a = parseFloat(editAmt);
    if (isNaN(a) || a <= 0) {
      Alert.alert('Enter valid amount');
      return;
    }
    const d = new Date(editDt);
    d.setHours(10, 0, 0, 0);
    editTransaction(
      editing.id,
      {
        amount: Math.round(a * 100),
        date: d.toISOString(),
        notes: editNote.trim() || editing.notes,
      },
      user?.id
    );
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this wallet load?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(id, user?.id) },
    ]);
  };

  return (
    <Screen bottomInset={40}>
      {/* Header */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale onPress={() => navigation.goBack()} scale={0.9} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <Text style={styles.appBarTitle}>Payzapp wallet loads</Text>
          <View style={styles.appBarSpacer} />
        </View>
      </Rise>

      {/* Loaded this month */}
      <Rise index={1}>
        <Card>
          <View style={styles.topRow}>
            <View>
              <Label>LOADED THIS MONTH</Label>
              <Text style={styles.monthValue}>{formatCur(currentMonth)}</Text>
              <Text style={styles.metaText}>
                {currentMonthCount} load{currentMonthCount === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet-outline" size={20} color={mc.violet} />
            </View>
          </View>
        </Card>
      </Rise>

      {/* Last three months */}
      <Rise index={2}>
        <Card>
          <Label>LAST 3 MONTHS</Label>
          <BarChart
            data={lastThreeMonths.map((m) => ({
              label: m.label,
              value: m.value,
              color: m.isCurrent ? mc.mint : mc.barDim,
            }))}
            width={300}
            height={100}
            style={styles.chart}
          />
          <View style={styles.monthLabels}>
            {lastThreeMonths.map((m) => (
              <Text
                key={m.label}
                style={[styles.monthLabel, m.isCurrent && { color: mc.mint }]}
              >
                {m.label}
              </Text>
            ))}
          </View>
        </Card>
      </Rise>

      {/* Log a load */}
      <Rise index={3}>
        <PressScale
          onPress={() => {
            setLoadAmt('');
            setLoadNote('');
            setLoadDt(new Date().toISOString().slice(0, 10));
            setShowAdd(true);
          }}
          scale={0.97}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={20} color={mc.white} />
          <Text style={styles.addBtnText}>Log wallet load</Text>
        </PressScale>
      </Rise>

      {/* Load history */}
      <Rise index={4}>
        <Label style={styles.sectionLabel}>LOAD HISTORY</Label>
        {walletLoads.length === 0 ? (
          <Card style={styles.emptyWrap}>
            <Ionicons name="wallet-outline" size={26} color={mc.textGhost} />
            <Text style={styles.emptyText}>No wallet loads recorded yet.</Text>
            <Text style={styles.emptySub}>Tap &quot;Log wallet load&quot; to add one manually.</Text>
          </Card>
        ) : (
          <Card pad={false}>
            {walletLoads.map((tx: Transaction, idx: number) => (
              <View key={tx.id} style={[styles.loadItem, idx > 0 && styles.loadItemDivider]}>
                <View style={styles.loadDot} />
                <View style={styles.loadMain}>
                  <Text style={styles.loadAmt}>{formatCur(tx.amount)}</Text>
                  <Text style={styles.loadDt}>
                    {new Date(tx.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {' · Manual'}
                  </Text>
                  {tx.notes ? <Text style={styles.loadNotes}>{tx.notes}</Text> : null}
                </View>
                <View style={styles.loadActions}>
                  <PressScale
                    onPress={() => {
                      setEditing(tx);
                      setEditAmt((tx.amount / 100).toString());
                      setEditDt(new Date(tx.date).toISOString().slice(0, 10));
                      setEditNote(tx.notes || '');
                    }}
                    scale={0.9}
                    accessibilityLabel="Edit load"
                  >
                    <Ionicons name="create-outline" size={16} color={mc.textDim} />
                  </PressScale>
                  <PressScale
                    onPress={() => handleDelete(tx.id)}
                    scale={0.9}
                    accessibilityLabel="Delete load"
                  >
                    <Ionicons name="trash-outline" size={16} color={mc.redSoft} />
                  </PressScale>
                </View>
              </View>
            ))}
          </Card>
        )}
      </Rise>

      {/* Add Modal */}
      <Modal
        visible={showAdd}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdd(false)}
      >
        <View style={styles.mOverlay}>
          <View style={styles.mCard}>
            <Text style={styles.mTitle}>Log wallet load</Text>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>AMOUNT (₹)</Text>
              <TextInput
                style={styles.inp}
                value={loadAmt}
                onChangeText={setLoadAmt}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={mc.textFaint}
                autoFocus
              />
            </View>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>DATE</Text>
              <TextInput
                style={styles.inp}
                value={loadDt}
                onChangeText={setLoadDt}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={mc.textFaint}
              />
            </View>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={styles.inp}
                value={loadNote}
                onChangeText={setLoadNote}
                placeholder="Payzapp load via HDFC Millennia"
                placeholderTextColor={mc.textFaint}
              />
            </View>
            <View style={styles.mBtns}>
              <PressScale onPress={() => setShowAdd(false)} scale={0.96}>
                <Text style={styles.mCancelTxt}>Cancel</Text>
              </PressScale>
              <PressScale onPress={handleAdd} scale={0.96}>
                <Text style={styles.mSaveTxt}>Add</Text>
              </PressScale>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={!!editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <View style={styles.mOverlay}>
          <View style={styles.mCard}>
            <Text style={styles.mTitle}>Edit wallet load</Text>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>AMOUNT (₹)</Text>
              <TextInput
                style={styles.inp}
                value={editAmt}
                onChangeText={setEditAmt}
                keyboardType="decimal-pad"
                placeholderTextColor={mc.textFaint}
                autoFocus
              />
            </View>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>DATE</Text>
              <TextInput
                style={styles.inp}
                value={editDt}
                onChangeText={setEditDt}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={mc.textFaint}
              />
            </View>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>NOTES</Text>
              <TextInput
                style={styles.inp}
                value={editNote}
                onChangeText={setEditNote}
                placeholderTextColor={mc.textFaint}
              />
            </View>
            <View style={styles.mBtns}>
              <PressScale onPress={() => setEditing(null)} scale={0.96}>
                <Text style={styles.mCancelTxt}>Cancel</Text>
              </PressScale>
              <PressScale onPress={handleEdit} scale={0.96}>
                <Text style={styles.mSaveTxt}>Save</Text>
              </PressScale>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },
  appBarSpacer: {
    width: 38,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  monthValue: {
    fontSize: 34,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  metaText: {
    fontSize: 13,
    color: mc.textDim,
    marginTop: 4,
  },
  walletIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: mc.violetDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chart: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  monthLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  monthLabel: {
    fontSize: 11,
    color: mc.textDim,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: mc.red,
    borderRadius: 26,
    paddingVertical: 16,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: mc.white,
  },

  sectionLabel: {
    marginTop: 6,
    marginBottom: 8,
    marginLeft: 4,
  },
  loadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loadItemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  loadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: mc.mint,
  },
  loadMain: {
    flex: 1,
    minWidth: 0,
  },
  loadAmt: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },
  loadDt: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },
  loadNotes: {
    fontSize: 11,
    color: mc.textFaint,
    fontStyle: 'italic',
    marginTop: 2,
  },
  loadActions: {
    flexDirection: 'row',
    gap: 14,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: mc.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 4,
  },

  mOverlay: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  mCard: {
    backgroundColor: mc.card,
    borderRadius: mr.card,
    padding: 20,
    gap: 12,
  },
  mTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: mc.text,
  },
  inpGrp: {
    gap: 6,
  },
  inpLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: mc.textFaint,
  },
  inp: {
    backgroundColor: mc.raised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: mc.text,
    fontSize: 15,
  },
  mBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 18,
    marginTop: 4,
  },
  mCancelTxt: {
    fontSize: 14,
    color: mc.textDim,
  },
  mSaveTxt: {
    fontSize: 14,
    color: mc.redSoft,
    fontWeight: '600',
  },
});
