/**
 * BankAccountsScreen — lists bank accounts with total balance and per-account
 * balance editing via a modal.
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

export default function BankAccountsScreen() {
  const navigation = useNavigation();
  const { accounts, getTotalBalance, editAccountBalance } = useFinanceStore();
  const { user } = useAuth();

  const [selectedAcc, setSelectedAcc] = useState<BankAccount | null>(null);
  const [editValue, setEditValue] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const totalBalance = getTotalBalance();

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  };

  const handleEditClick = (acc: BankAccount) => {
    setSelectedAcc(acc);
    setEditValue((acc.amount / 100).toString());
    setModalVisible(true);
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
                        <Ionicons name="business-outline" size={18} color={colors.primary} />
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
