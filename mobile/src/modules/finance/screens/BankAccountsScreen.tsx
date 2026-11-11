/**
 * BankAccountsScreen — lists bank accounts and wallets with the total liquid
 * balance and per-account / per-wallet balance editing via a modal.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore, BankAccount, getMinBalanceForAccount } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import BankLogo from '../../../shared/components/BankLogo';
import WalletBalanceEditor from '../components/WalletBalanceEditor';

export default function BankAccountsScreen() {
  const navigation = useNavigation();
  const { accounts, wallets, getTotalBalance, getWalletTotal, editAccountBalance, seedWallets, setWalletAmount } = useFinanceStore();
  const { user } = useAuth();

  const [selectedAcc, setSelectedAcc] = useState<BankAccount | null>(null);
  const [editValue, setEditValue] = useState('');
  const [quickValue, setQuickValue] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWallet, setEditingWallet] = useState<{ id: string; name: string; amount: number } | null>(null);

  const totalBalance = getTotalBalance();
  const walletTotal = getWalletTotal();
  const accountsTotal = totalBalance - walletTotal;

  // Make sure the standard wallet rows exist (idempotent).
  React.useEffect(() => {
    seedWallets(user?.id);
  }, [user?.id]);

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  };

  const handleEditClick = (acc: BankAccount) => {
    setSelectedAcc(acc);
    setEditValue((acc.amount / 100).toString());
    setQuickValue('');
    setModalVisible(true);
  };

  const applyQuickAmount = (mode: 'plus' | 'minus') => {
    const typed = parseFloat(quickValue);
    if (isNaN(typed) || typed <= 0) {
      alert('Enter the quick amount first');
      return;
    }
    const typedPaise = Math.round(typed * 100);
    const current = parseFloat(editValue) || 0;
    const base = Math.round(current * 100);
    const result = mode === 'plus' ? base + typedPaise : Math.max(0, base - typedPaise);
    setEditValue((result / 100).toString());
    setQuickValue('');
  };

  const handleSave = () => {
    if (!selectedAcc) return;
    const rawVal = parseFloat(editValue);
    if (isNaN(rawVal) || rawVal < 0) {
      alert('Please enter a valid balance');
      return;
    }
    editAccountBalance(selectedAcc.id, Math.round(rawVal * 100), user?.id);
    setModalVisible(false);
    setSelectedAcc(null);
  };

  const saveWalletAmount = (amountPaise: number) => {
    if (!editingWallet) return;
    setWalletAmount(editingWallet.id, amountPaise, user?.id);
    setEditingWallet(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Bank Accounts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cash Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>LIQUID BALANCES TOTAL</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalBalance)}</Text>
          <View style={styles.summaryBreakdown}>
            <View style={styles.summaryChip}>
              <View style={[styles.summaryDot, { backgroundColor: '#5ee6ff' }]} />
              <Text style={styles.summaryChipLabel}>Banks</Text>
              <Text style={styles.summaryChipValue}>{formatCurrency(accountsTotal)}</Text>
            </View>
            <View style={styles.summaryChip}>
              <View style={[styles.summaryDot, { backgroundColor: '#59D6C7' }]} />
              <Text style={styles.summaryChipLabel}>Wallets</Text>
              <Text style={styles.summaryChipValue}>{formatCurrency(walletTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Bank Ledger List */}
        <View style={styles.ledgerSection}>
          <Text style={styles.sectionTitle}>ACCOUNTS LIST (TAP TO EDIT)</Text>
          <View style={styles.accountsContainer}>
            {accounts.map((acc) => {
              const minLimit = getMinBalanceForAccount(acc.title);
              const isBelowMin = acc.amount < minLimit;
              const deficit = minLimit - acc.amount;

              return (
                <TouchableOpacity
                  key={acc.id}
                  style={styles.accountRow}
                  onPress={() => handleEditClick(acc)}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountRowTop}>
                    <View style={styles.accountLeft}>
                      <View style={[styles.iconWrapper, { backgroundColor: `${colors.primary}15` }]}>
                        <BankLogo title={acc.title} size={34} />
                      </View>
                      <View>
                        <Text style={styles.accountTitle}>{acc.title}</Text>
                        {minLimit > 0 && (
                          <Text style={styles.minLabel}>Min balance: {formatCurrency(minLimit)}</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.accountAmount}>{formatCurrency(acc.amount)}</Text>
                  </View>

                  {isBelowMin && (
                    <View style={styles.warningContainer}>
                      <Ionicons name="warning" size={14} color={colors.error} />
                      <Text style={styles.warningText}>
                        Below minimum limit by {formatCurrency(deficit)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Wallets — the same section as the bank accounts: cash that counts
            towards the liquid balance and the net worth. */}
        <View style={styles.ledgerSection}>
          <Text style={styles.sectionTitle}>WALLETS (TAP TO EDIT)</Text>
          <View style={styles.accountsContainer}>
            {(wallets || []).map((w) => (
              <TouchableOpacity
                key={w.id}
                style={styles.accountRow}
                onPress={() => setEditingWallet({ id: w.id, name: w.name, amount: w.amount })}
                activeOpacity={0.7}
              >
                <View style={styles.accountRowTop}>
                  <View style={styles.accountLeft}>
                    <View style={[styles.iconWrapper, { backgroundColor: `${colors.primary}15` }]}>
                      <Ionicons name="cash-outline" size={18} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.accountTitle}>{w.name}</Text>
                      <Text style={styles.minLabel}>Wallet balance</Text>
                    </View>
                  </View>
                  <Text style={styles.accountAmount}>{formatCurrency(w.amount)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Edit Balance Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Bank Balance</Text>
            {selectedAcc && (
              <Text style={styles.modalSubtitle}>{selectedAcc.title}</Text>
            )}

            <View style={styles.inputWrapper}>
              <Text style={styles.inputPrefix}>₹</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={editValue}
                onChangeText={setEditValue}
                autoFocus
              />
            </View>

            <View style={styles.quickMathGroup}>
              <Text style={styles.quickMathLabel}>QUICK AMOUNT (₹)</Text>
              <TextInput
                style={styles.quickMathInput}
                value={quickValue}
                onChangeText={setQuickValue}
                keyboardType="decimal-pad"
                placeholder="Enter amount to add/subtract"
                placeholderTextColor={colors.outline}
              />
              <View style={styles.quickMathRow}>
                <TouchableOpacity
                  style={[styles.quickMathBtn, { borderColor: 'rgba(89,214,199,0.6)' }]}
                  onPress={() => applyQuickAmount('plus')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickMathBtnText, { color: '#59D6C7' }]}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickMathBtn, { borderColor: 'rgba(255,136,125,0.6)' }]}
                  onPress={() => applyQuickAmount('minus')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickMathBtnText, { color: '#FF887D' }]}>−</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={handleSave}
              >
                <Text style={styles.modalBtnTextSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wallet balance editor (shared with the Balance Summary) */}
      <WalletBalanceEditor
        visible={!!editingWallet}
        name={editingWallet?.name ?? ''}
        amount={editingWallet?.amount ?? 0}
        onSave={saveWalletAmount}
        onClose={() => setEditingWallet(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.onSurface,
  },
  summaryBreakdown: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  summaryChipValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  ledgerSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  accountsContainer: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
  },
  accountRow: {
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  accountRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  minLabel: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  accountAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${colors.error}10`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rounded.DEFAULT,
    alignSelf: 'flex-start',
    marginLeft: 44,
  },
  warningText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.error,
  },
  quickMathGroup: {
    gap: 8,
    padding: 12,
    borderRadius: rounded.DEFAULT,
    backgroundColor: colors.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quickMathLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  quickMathInput: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    height: 40,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: '600',
  },
  quickMathRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickMathBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickMathBtnText: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  inputPrefix: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 48,
    fontSize: 18,
    color: colors.onSurface,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: 'transparent',
  },
  modalBtnSave: {
    backgroundColor: colors.primaryContainer,
  },
  modalBtnTextCancel: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  modalBtnTextSave: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
