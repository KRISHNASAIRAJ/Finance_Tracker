/**
 * BankAccountsScreen — every bank account and wallet.
 *
 * Restyled to the Meridian v2 reference: the liquid-balance headline with a
 * banks/wallets split, an accounts list with a per-account minimum-balance
 * bar and the wallet list.
 */
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  IconTile,
  Label,
  PressScale,
  Rise,
  Screen,
  StackedShareBar,
} from '../../../shared/components/meridian';
import BankLogo from '../../../shared/components/BankLogo';
import WalletBalanceEditor from '../components/WalletBalanceEditor';
import { useFinanceStore, getMinBalanceForAccount } from '../store';
import { useAuth } from '../../../services/AuthProvider';

export default function BankAccountsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const {
    accounts,
    wallets,
    transactions,
    getTotalBalance,
    getWalletTotal,
    editAccountBalance,
    seedWallets,
    setWalletAmount,
  } = useFinanceStore();

  const [modalVisible, setModalVisible] = React.useState(false);
  const [selectedAcc, setSelectedAcc] = React.useState<any>(null);
  const [editValue, setEditValue] = React.useState('');
  const [quickValue, setQuickValue] = React.useState('');
  const [editingWallet, setEditingWallet] = React.useState<any>(null);

  React.useEffect(() => {
    seedWallets(user?.id);
  }, [seedWallets, user?.id]);

  const totalBalance = getTotalBalance();
  const walletTotal = getWalletTotal();
  const accountsTotal = totalBalance - walletTotal;

  // This month's Payzapp wallet loads — the same filter the Payzapp screen
  // uses, so the card always matches the history there.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLoads = (transactions || []).filter(
    (tx: any) =>
      tx.type === 'expense' &&
      (tx.category === 'Wallet Loads' ||
        tx.category === 'Wallet Load' ||
        tx.notes?.toLowerCase().includes('wallet load') ||
        tx.notes?.toLowerCase().includes('payzapp')) &&
      new Date(tx.date) >= monthStart
  );
  const monthLoadTotal = monthLoads.reduce((s: number, t: any) => s + t.amount, 0);

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const handleEditClick = (acc: any) => {
    setSelectedAcc(acc);
    setEditValue((acc.amount / 100).toString());
    setQuickValue('');
    setModalVisible(true);
  };

  const applyQuickAmount = (mode: 'plus' | 'minus') => {
    const quick = parseFloat(quickValue);
    if (isNaN(quick) || quick <= 0) return;
    const current = parseFloat(editValue) || 0;
    const next = mode === 'plus' ? current + quick : Math.max(0, current - quick);
    setEditValue(String(Math.round(next * 100) / 100));
  };

  const handleSave = () => {
    if (!selectedAcc) return;
    const rawVal = parseFloat(editValue);
    if (!isNaN(rawVal) && rawVal >= 0) {
      editAccountBalance(selectedAcc.id, Math.round(rawVal * 100), user?.id);
    }
    setModalVisible(false);
  };

  const saveWalletAmount = (amountPaise: number) => {
    if (editingWallet) {
      setWalletAmount(editingWallet.id, amountPaise, user?.id);
    }
    setEditingWallet(null);
  };

  return (
    <Screen bottomInset={40}>
      {/* Header */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale onPress={() => navigation.goBack()} scale={0.9} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <Text style={styles.logoText}>Bank accounts</Text>
          <View style={styles.appBarSpacer} />
        </View>
      </Rise>

      {/* Liquid balance */}
      <Rise index={1}>
        <Card style={styles.summaryCard}>
          <Label>LIQUID BALANCE</Label>
          <Text style={styles.summaryValue}>{formatCurrency(totalBalance)}</Text>
          <StackedShareBar
            segments={[
              { key: 'banks', value: accountsTotal, color: mc.sky },
              { key: 'wallets', value: walletTotal, color: mc.mint },
            ]}
            height={12}
            style={styles.summaryBar}
          />
          <View style={styles.summaryBreakdown}>
            <View style={styles.summaryChip}>
              <View style={[styles.summaryDot, { backgroundColor: mc.sky }]} />
              <Text style={styles.summaryChipLabel}>Banks</Text>
              <Text style={styles.summaryChipValue}>{formatCurrency(accountsTotal)}</Text>
            </View>
            <View style={styles.summaryChip}>
              <View style={[styles.summaryDot, { backgroundColor: mc.mint }]} />
              <Text style={styles.summaryChipLabel}>Wallets</Text>
              <Text style={styles.summaryChipValue}>{formatCurrency(walletTotal)}</Text>
            </View>
          </View>
        </Card>
      </Rise>

      {/* Accounts */}
      <Rise index={2}>
        <Label style={styles.sectionTitle}>ACCOUNTS</Label>
        <Card pad={false}>
          {accounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No accounts yet.</Text>
            </View>
          ) : (
            accounts.map((acc: any, idx: number) => {
              const minLimit = getMinBalanceForAccount(acc.title);
              const isBelowMin = minLimit > 0 && acc.amount < minLimit;
              const atMin = minLimit > 0 && acc.amount <= minLimit;
              const deficit = minLimit - acc.amount;
              // The bar shows how far the balance is above its own minimum.
              const barPct =
                minLimit > 0 ? Math.min(1, acc.amount / minLimit) : 0;

              return (
                <PressScale
                  key={acc.id}
                  onPress={() => handleEditClick(acc)}
                  scale={0.99}
                  style={[styles.accountRow, idx > 0 && styles.accountDivider]}
                >
                  <BankLogo title={acc.title} size={40} />
                  <View style={styles.accountMain}>
                    <Text style={styles.accountTitle} numberOfLines={1}>
                      {acc.title}
                    </Text>
                    {minLimit > 0 ? (
                      <>
                        <View style={styles.minBar}>
                          <View
                            style={[
                              styles.minBarFill,
                              {
                                width: `${Math.max(3, barPct * 100)}%`,
                                backgroundColor: atMin ? mc.amber : mc.sky,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.minLabel,
                            atMin && { color: mc.amber },
                          ]}
                        >
                          {atMin
                            ? `At minimum ${formatCurrency(minLimit)}`
                            : `Min ${formatCurrency(minLimit)}`}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.minLabel}>Tap to edit balance</Text>
                    )}
                  </View>
                  <Text style={styles.accountAmount}>{formatCurrency(acc.amount)}</Text>
                </PressScale>
              );
            })
          )}
        </Card>
        {accounts.some((acc: any) => {
          const minLimit = getMinBalanceForAccount(acc.title);
          return minLimit > 0 && acc.amount < minLimit;
        }) ? (
          <View style={styles.warningContainer}>
            <Ionicons name="warning" size={14} color={mc.redSoft} />
            <Text style={styles.warningText}>
              {accounts
                .filter((acc: any) => {
                  const minLimit = getMinBalanceForAccount(acc.title);
                  return minLimit > 0 && acc.amount < minLimit;
                })
                .map(
                  (acc: any) =>
                    `${acc.title} is ${formatCurrency(
                      getMinBalanceForAccount(acc.title) - acc.amount
                    )} below its minimum`
                )
                .join(' · ')}
            </Text>
          </View>
        ) : null}
      </Rise>

      {/* Wallets */}
      <Rise index={3}>
        <Label style={styles.sectionTitle}>WALLETS</Label>
        <Card pad={false}>
          {(wallets || []).length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No wallets yet.</Text>
            </View>
          ) : (
            (wallets || []).map((w: any, idx: number) => (
              <PressScale
                key={w.id}
                onPress={() => setEditingWallet({ id: w.id, name: w.name, amount: w.amount })}
                scale={0.99}
                style={[styles.accountRow, idx > 0 && styles.accountDivider]}
              >
                <IconTile
                  icon="wallet-outline"
                  color={w.amount > 0 ? mc.mint : mc.textFaint}
                  background={w.amount > 0 ? mc.mintDim : mc.raised}
                  size={40}
                  radius={20}
                />
                <View style={styles.accountMain}>
                  <Text
                    style={[
                      styles.accountTitle,
                      w.amount === 0 && { color: mc.textDim },
                    ]}
                    numberOfLines={1}
                  >
                    {w.name}
                  </Text>
                  <Text style={styles.minLabel}>Wallet balance</Text>
                </View>
                <Text
                  style={[
                    styles.accountAmount,
                    w.amount === 0 && { color: mc.textDim },
                  ]}
                >
                  {formatCurrency(w.amount)}
                </Text>
              </PressScale>
            ))
          )}
        </Card>
      </Rise>

      {/* Payzapp wallet loads — moved here from the Finance screen */}
      <Rise index={4}>
        <Label style={styles.sectionTitle}>PAYZAPP WALLET LOADS</Label>
        <Card pad={false}>
          <PressScale
            onPress={() => navigation.navigate('PayzappWallet' as never)}
            scale={0.99}
            style={styles.accountRow}
            accessibilityRole="button"
            accessibilityLabel="Open Payzapp wallet loads"
          >
            <IconTile
              icon="wallet-outline"
              color={mc.violet}
              background={mc.violetDim}
              size={40}
              radius={13}
            />
            <View style={styles.accountMain}>
              <Text style={styles.accountTitle}>PayZapp wallet loads</Text>
              <Text style={styles.minLabel}>
                {monthLoads.length} load{monthLoads.length === 1 ? '' : 's'} this month
              </Text>
            </View>
            <Text style={styles.accountAmount}>{formatCurrency(monthLoadTotal)}</Text>
            <Ionicons name="chevron-forward" size={16} color={mc.textFaint} />
          </PressScale>
        </Card>
      </Rise>

      {/* Edit Balance Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit bank balance</Text>
            {selectedAcc ? <Text style={styles.modalSubtitle}>{selectedAcc.title}</Text> : null}

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
                placeholderTextColor={mc.textFaint}
              />
              <View style={styles.quickMathRow}>
                <PressScale onPress={() => applyQuickAmount('plus')} scale={0.92} style={styles.quickMathBtn}>
                  <Text style={[styles.quickMathBtnText, { color: mc.mint }]}>+</Text>
                </PressScale>
                <PressScale onPress={() => applyQuickAmount('minus')} scale={0.92} style={styles.quickMathBtn}>
                  <Text style={[styles.quickMathBtnText, { color: mc.redSoft }]}>−</Text>
                </PressScale>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <PressScale onPress={() => setModalVisible(false)} scale={0.96}>
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </PressScale>
              <PressScale onPress={handleSave} scale={0.96}>
                <Text style={styles.modalBtnTextSave}>Save</Text>
              </PressScale>
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
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    flex: 1,
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },
  appBarSpacer: {
    width: 38,
  },

  summaryCard: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: '500',
    color: mc.text,
    marginVertical: 4,
  },
  summaryBar: {
    marginBottom: 10,
  },
  summaryBreakdown: {
    flexDirection: 'row',
    gap: 18,
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
    fontSize: 13,
    color: mc.textDim,
  },
  summaryChipValue: {
    fontSize: 13,
    color: mc.text,
    fontWeight: '500',
  },

  sectionTitle: {
    marginTop: 6,
    marginBottom: 8,
    marginLeft: 4,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  accountDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  accountMain: {
    flex: 1,
    minWidth: 0,
  },
  accountTitle: {
    fontSize: 15,
    color: mc.text,
  },
  minBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: mc.track,
    marginVertical: 5,
    overflow: 'hidden',
  },
  minBarFill: {
    height: 4,
    borderRadius: 2,
  },
  minLabel: {
    fontSize: 11,
    color: mc.textDim,
  },
  accountAmount: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: mc.redDim,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: mc.redSoft,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: mc.textDim,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: mc.card,
    borderRadius: mr.card,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: mc.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: mc.textDim,
    marginTop: -6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: mc.raised,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputPrefix: {
    fontSize: 20,
    color: mc.textDim,
  },
  textInput: {
    flex: 1,
    color: mc.text,
    fontSize: 20,
    paddingVertical: 12,
  },
  quickMathGroup: {
    gap: 8,
  },
  quickMathLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: mc.textFaint,
  },
  quickMathInput: {
    backgroundColor: mc.raised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: mc.text,
    fontSize: 15,
  },
  quickMathRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickMathBtn: {
    width: 44,
    height: 40,
    borderRadius: 12,
    backgroundColor: mc.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickMathBtnText: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 18,
    marginTop: 4,
  },
  modalBtnTextCancel: {
    fontSize: 14,
    color: mc.textDim,
  },
  modalBtnTextSave: {
    fontSize: 14,
    color: mc.redSoft,
    fontWeight: '600',
  },
});
