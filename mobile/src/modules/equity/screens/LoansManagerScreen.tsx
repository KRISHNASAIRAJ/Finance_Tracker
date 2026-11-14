/**
 * LoansManagerScreen — view/add/edit/delete outstanding loans and fixed deposits.
 * Net worth = investments + FDs − loans, reflected on the Wealth dashboard.
 *
 * Restyled to the Meridian v2 reference (s30): LOANS / FIXED DEPOSITS section
 * headers with totals, avatar-letter loan rows with adjust/edit/delete
 * actions, and a mint empty-state card for FDs.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { Card, IconTile, Label, PressScale, Screen, TopBar } from '../../../shared/components/meridian';
import { useInvestmentsStore, Loan, FixedDeposit } from '../store';
import { useAuth } from '../../../services/AuthProvider';

type EditorTarget =
  | { kind: 'loan'; item: Loan }
  | { kind: 'fd'; item: FixedDeposit };

export default function LoansManagerScreen() {
  const navigation = useNavigation();
  const { loans, fds, addLoan, updateLoan, adjustLoanAmount, deleteLoan, addFD, updateFD, deleteFD } = useInvestmentsStore();
  const { user } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  // Quick adjust (add/remove from outstanding principal without editing the name)
  const [adjustTarget, setAdjustTarget] = useState<Loan | null>(null);
  const [adjustSign, setAdjustSign] = useState<'plus' | 'minus'>('minus');
  const [adjustAmount, setAdjustAmount] = useState('');

  // Track which kind the modal is adding (edit derives it from `editing`).
  const [kind, setKind] = useState<'loan' | 'fd'>('loan');
  const effectiveKind: 'loan' | 'fd' = editing ? editing.kind : kind;

  const formatCurrency = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;

  const loansTotal = loans.reduce((sum, l) => sum + l.amount, 0);
  const fdsTotal = fds.reduce((sum, f) => sum + f.amount, 0);

  const openAdd = (k: 'loan' | 'fd') => {
    setEditing(null);
    setName('');
    setAmount('');
    setKind(k);
    setShowModal(true);
  };

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

  const openAdjust = (loan: Loan) => {
    setAdjustTarget(loan);
    setAdjustSign('minus');
    setAdjustAmount('');
  };

  const applyAdjust = () => {
    if (!adjustTarget) return;
    const rupees = parseFloat(adjustAmount);
    if (isNaN(rupees) || rupees <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount in ₹.');
      return;
    }
    const delta = Math.round(rupees * 100) * (adjustSign === 'minus' ? -1 : 1);
    adjustLoanAmount(adjustTarget.id, delta, user?.id);
    setAdjustTarget(null);
    setAdjustAmount('');
  };

  const renderRows = (
    items: Array<Loan | FixedDeposit>,
    k: 'loan' | 'fd'
  ) =>
    items.map((item) => {
      const target: EditorTarget = { kind: k, item };
      const isLoan = k === 'loan';
      const initial = (item.name || '?').trim().charAt(0).toUpperCase();
      return (
        <Card key={item.id} style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={[styles.avatar, { backgroundColor: isLoan ? mc.redDim : mc.mintDim }]}>
              <Text style={[styles.avatarText, { color: isLoan ? mc.redSoft : mc.mint }]}>
                {initial}
              </Text>
            </View>
            <View style={styles.itemMain}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.itemAmount, { color: isLoan ? mc.redSoft : mc.mint }]}>
                {isLoan ? '−' : '+'}{formatCurrency(item.amount)}
              </Text>
            </View>
            {isLoan && (
              <PressScale
                style={styles.iconBtn}
                onPress={() => openAdjust(item as Loan)}
                scale={0.9}
                accessibilityLabel={`Adjust outstanding for ${item.name}`}
              >
                <Ionicons name="calculator-outline" size={17} color={mc.text} />
              </PressScale>
            )}
            <PressScale
              style={styles.iconBtn}
              onPress={() => openEdit(target)}
              scale={0.9}
              accessibilityLabel={`Edit ${item.name}`}
            >
              <Ionicons name="pencil" size={17} color={mc.text} />
            </PressScale>
            <PressScale
              style={[styles.iconBtn, styles.iconBtnDanger]}
              onPress={() => handleDelete(target)}
              scale={0.9}
              accessibilityLabel={`Delete ${item.name}`}
            >
              <Ionicons name="trash-outline" size={17} color={mc.redSoft} />
            </PressScale>
          </View>
          {isLoan ? (
            <Text style={styles.loanFootnote}>Tap the calculator to adjust the outstanding principal</Text>
          ) : null}
        </Card>
      );
    });

  return (
    <Screen bottomInset={36}>
      <TopBar
        title="Loans and FDs"
        onBack={() => navigation.goBack()}
        variant="center"
        right={
          <PressScale
            onPress={() => openAdd('loan')}
            scale={0.92}
            style={styles.fabCircle}
            accessibilityLabel="Add loan or FD"
          >
            <Ionicons name="add" size={18} color={mc.white} />
          </PressScale>
        }
      />

      {/* LOANS section */}
      <View style={styles.sectionHeader}>
        <Label color={mc.redSoft}>LOANS</Label>
        <Text style={styles.sectionTotal}>Total {formatCurrency(loansTotal)}</Text>
      </View>
      {loans.length === 0 ? (
        <Card>
          <Text style={styles.sectionEmpty}>
            No loans tracked. Net worth = investments + FDs − loans.
          </Text>
        </Card>
      ) : (
        renderRows(loans, 'loan')
      )}

      {/* FIXED DEPOSITS section */}
      <View style={[styles.sectionHeader, styles.fdHeaderGap]}>
        <Label color={mc.mint}>FIXED DEPOSITS</Label>
        <Text style={styles.sectionTotal}>Total {formatCurrency(fdsTotal)}</Text>
      </View>
      {fds.length === 0 ? (
        <Card style={styles.fdEmptyCard}>
          <IconTile
            icon="lock-closed"
            color={mc.mint}
            background={mc.mintDim}
            size={52}
            radius={26}
            iconSize={24}
            style={styles.fdEmptyIcon}
          />
          <Text style={styles.fdEmptyTitle}>No FDs tracked</Text>
          <Text style={styles.fdEmptySub}>FD amounts are added to your net worth</Text>
          <PressScale style={styles.addFdChip} onPress={() => openAdd('fd')} scale={0.96} accessibilityLabel="Add FD">
            <Ionicons name="add" size={14} color={mc.mint} />
            <Text style={styles.addFdChipText}>Add FD</Text>
          </PressScale>
        </Card>
      ) : (
        renderRows(fds, 'fd')
      )}

      {/* Add / Edit Modal — bottom sheet */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {editing
                ? editing.kind === 'loan' ? 'Edit loan' : 'Edit FD'
                : effectiveKind === 'loan' ? 'Add loan' : 'Add FD'}
            </Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={effectiveKind === 'loan' ? 'Loan name (e.g. Home Loan)' : 'FD name (e.g. HDFC FD)'}
              placeholderTextColor={mc.textGhost}
            />
            <TextInput
              style={styles.textInput}
              value={amount}
              onChangeText={setAmount}
              placeholder={effectiveKind === 'loan' ? 'Outstanding amount (₹)' : 'Deposit amount (₹)'}
              placeholderTextColor={mc.textGhost}
              keyboardType="decimal-pad"
            />
            <View style={styles.sheetButtons}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnCancel]} onPress={() => setShowModal(false)}>
                <Text style={styles.sheetBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnSave]} onPress={handleSave}>
                <Text style={styles.sheetBtnSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Quick adjust modal — pick + or −, enter amount, apply */}
      <Modal
        visible={!!adjustTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setAdjustTarget(null)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Adjust outstanding</Text>
            {adjustTarget && (
              <Text style={styles.sheetSub}>
                {adjustTarget.name} · {formatCurrency(adjustTarget.amount)}
              </Text>
            )}
            <View style={styles.signRow}>
              <PressScale
                style={[styles.signBtn, adjustSign === 'minus' && styles.signBtnActiveRed]}
                onPress={() => setAdjustSign('minus')}
                scale={0.97}
              >
                <Text style={[styles.signText, adjustSign === 'minus' && styles.signTextActiveRed]}>
                  − Reduce
                </Text>
              </PressScale>
              <PressScale
                style={[styles.signBtn, adjustSign === 'plus' && styles.signBtnActiveMint]}
                onPress={() => setAdjustSign('plus')}
                scale={0.97}
              >
                <Text style={[styles.signText, adjustSign === 'plus' && styles.signTextActiveMint]}>
                  + Add
                </Text>
              </PressScale>
            </View>
            <TextInput
              style={styles.textInput}
              value={adjustAmount}
              onChangeText={setAdjustAmount}
              placeholder="Amount in ₹"
              placeholderTextColor={mc.textGhost}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={styles.sheetButtons}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnCancel]} onPress={() => setAdjustTarget(null)}>
                <Text style={styles.sheetBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnSave]} onPress={applyAdjust}>
                <Text style={styles.sheetBtnSaveText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fabCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  fdHeaderGap: {
    marginTop: 6,
  },
  sectionTotal: {
    fontSize: 12,
    color: mc.textDim,
  },
  sectionEmpty: {
    fontSize: 13,
    color: mc.textDim,
    lineHeight: 19,
  },

  // Item cards
  itemCard: {
    padding: 12,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '500',
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemName: {
    fontSize: 16,
    color: mc.text,
  },
  itemAmount: {
    fontSize: 18,
    fontWeight: '500',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: mc.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDanger: {
    backgroundColor: mc.redDim,
  },
  loanFootnote: {
    fontSize: 11,
    color: mc.textDim,
  },

  // FD empty card
  fdEmptyCard: {
    alignItems: 'center',
    paddingVertical: 26,
    gap: 4,
  },
  fdEmptyIcon: {
    marginBottom: 6,
  },
  fdEmptyTitle: {
    fontSize: 15,
    color: mc.text,
  },
  fdEmptySub: {
    fontSize: 12,
    color: mc.textDim,
    textAlign: 'center',
    lineHeight: 18,
  },
  addFdChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.mintDim,
    borderRadius: mr.chip,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 8,
  },
  addFdChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: mc.mint,
  },

  // Bottom sheets
  sheetOverlay: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: mc.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
    elevation: 24,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: mc.text,
  },
  sheetSub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: -6,
  },
  textInput: {
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: mc.text,
  },
  signRow: {
    flexDirection: 'row',
    gap: 10,
  },
  signBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: mc.raised,
    alignItems: 'center',
  },
  signBtnActiveRed: {
    backgroundColor: mc.redDim,
  },
  signBtnActiveMint: {
    backgroundColor: mc.mintDim,
  },
  signText: {
    fontSize: 14,
    color: mc.textDim,
  },
  signTextActiveRed: {
    color: mc.redSoft,
    fontWeight: '600',
  },
  signTextActiveMint: {
    color: mc.mint,
    fontWeight: '600',
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  sheetBtn: {
    paddingVertical: 13,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnCancel: {
    flex: 1,
    backgroundColor: mc.raised,
  },
  sheetBtnSave: {
    flex: 1.4,
    backgroundColor: mc.red,
  },
  sheetBtnCancelText: {
    fontSize: 14,
    color: mc.textDim,
  },
  sheetBtnSaveText: {
    fontSize: 16,
    color: mc.white,
    fontWeight: '500',
  },
});
