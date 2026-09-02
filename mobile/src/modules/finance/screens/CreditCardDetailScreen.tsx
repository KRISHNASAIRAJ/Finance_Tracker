/**
 * CreditCardDetailScreen — per-card detail: bills, spend, due dates and
 * usage breakdown with edit actions.
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore } from '../store';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import { getCategoryColor } from '../../../shared/categoryMap';
import CategoryIcon from '../../../shared/CategoryIcon';
import CardBrandLogo from '../../../shared/components/CardBrandLogo';
import CalendarPicker from '../../../shared/components/CalendarPicker';

type DetailRouteProp = RouteProp<FinanceStackParamList, 'CreditCardDetail'>;

function getCardAccent(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('cashback') || n.includes('sbi')) return colors.action;
  if (n.includes('power') || n.includes('idfc')) return colors.stable;
  if (n.includes('simplysave')) return colors.amber;
  if (n.includes('hsbc')) return colors.attention;
  if (n.includes('amazon') || n.includes('icici')) return colors.action;
  if (n.includes('slice')) return colors.amber;
  if (n.includes('cred') || n.includes('indusind')) return colors.attention;
  return colors.primary;
}

export default function CreditCardDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<DetailRouteProp>();
  const { cardId } = route.params;
  const { cards, transactions } = useFinanceStore() as any;
  const markCardBillPaid = useFinanceStore((s: any) => s.markCardBillPaid);
  const editCard = useFinanceStore((s: any) => s.editCard);
  const { user } = require('../../../services/AuthProvider').useAuth();

  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentInput, setPaymentInput] = useState('');
  const [showEditAmountModal, setShowEditAmountModal] = useState(false);
  const [editAmountInput, setEditAmountInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsBillingDay, setSettingsBillingDay] = useState('');
  const [settingsAmc, setSettingsAmc] = useState('');
  const [settingsAcDate, setSettingsAcDate] = useState(new Date());
  const [settingsAcCalendarVisible, setSettingsAcCalendarVisible] = useState(false);
  const [settingsDueDate, setSettingsDueDate] = useState(new Date());
  const [settingsDueCalendarVisible, setSettingsDueCalendarVisible] = useState(false);

  const card = (cards as any[]).find((c: any) => c.id === cardId);

  if (!card) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.notFound}>Card not found</Text>
      </SafeAreaView>
    );
  }

  const accent = getCardAccent(card.name);
  const daysUntilDue = Math.ceil(
    (new Date(card.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const urgency = daysUntilDue <= 3 ? colors.error : daysUntilDue <= 7 ? colors.amber : colors.success;

  const cardTransactions = transactions.filter(
    (tx: any) => tx.linkedCardId === cardId || (tx.category === 'Credit Card Bill' && tx.notes?.includes(card.name))
  );

  // Billing-cycle split: purchases up to the current due date belong to the
  // current statement; anything dated after the due date rolls into the next
  // statement and must not be mixed into the bill being paid now.
  const dueDateRef = new Date(card.dueDate);
  const cycleStartRef = new Date(
    dueDateRef.getFullYear(),
    dueDateRef.getMonth() - 1,
    dueDateRef.getDate()
  );
  const currentBillTxs = cardTransactions
    .filter((tx: any) => {
      const d = new Date(tx.date);
      return d >= cycleStartRef && d < dueDateRef;
    })
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const nextCycleTxs = cardTransactions
    .filter((tx: any) => new Date(tx.date) >= dueDateRef)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const cardLimit = card.cardLimit || 0;
  const utilization = cardLimit > 0 ? (card.balance / cardLimit) * 100 : 0;

  const formatCurrency = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const formatOrdinal = (day: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = day % 100;
    return `${day}${s[(v - 20) % 10] || s[v] || s[0]}`;
  };

  const openSettingsPanel = () => {
    setSettingsBillingDay((card.billingDay || 1).toString());
    setSettingsAmc(((card.annualCharge ?? 0) / 100).toString());
    setSettingsAcDate(card.annualChargeDate ? new Date(card.annualChargeDate) : new Date());
    setSettingsDueDate(new Date(card.dueDate));
    setShowSettings((prev) => !prev);
  };

  const saveSettings = () => {
    const billingDay = parseInt(settingsBillingDay, 10);
    if (isNaN(billingDay) || billingDay < 1 || billingDay > 31) {
      alert('Enter a valid billing day (1-31)');
      return;
    }
    const amc = Math.round(parseFloat(settingsAmc) * 100);
    const finalAmc = isNaN(amc) || amc < 0 ? 0 : amc;
    editCard(cardId, {
      billingDay,
      dueDate: settingsDueDate.toISOString(),
      annualCharge: finalAmc,
      annualChargeDate: settingsAcDate.toISOString(),
      isLtf: finalAmc <= 0,
    }, user?.id);
    setShowSettings(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle} numberOfLines={1}>{card.name}</Text>
        <TouchableOpacity style={styles.iconButton} onPress={openSettingsPanel}>
          <Ionicons name="settings-outline" size={24} color={showSettings ? colors.primary : colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Card Hero */}
        <View style={[styles.heroCard, { borderColor: `${accent}40` }]}>
          <View style={[styles.heroAccent, { backgroundColor: accent }]} />
          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroName}>{card.name}</Text>
                <Text style={styles.heroNumber}>
                  •••• {card.endingWith} · {card.network}
                </Text>
                {card.bank ? (
                  <Text style={styles.heroBank}>{card.bank}</Text>
                ) : null}
              </View>
              <CardBrandLogo network={card.network || ''} size={44} />
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <View style={styles.heroStatLabelRow}>
                  <Text style={styles.heroStatLabel}>OUTSTANDING</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setEditAmountInput((card.balance / 100).toString());
                      setShowEditAmountModal(true);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="create-outline" size={14} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.heroStatValue, { color: accent }]}>
                  {formatCurrency(card.balance)}
                </Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>DUE DATE</Text>
                <Text style={[styles.heroStatValue, { color: urgency }]}>
                  {new Date(card.dueDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                <Text style={[styles.heroDueDays, { color: urgency }]}>
                  {daysUntilDue > 0 ? `${daysUntilDue}d remaining` : daysUntilDue === 0 ? 'Due today' : `${Math.abs(daysUntilDue)}d overdue`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Limit Utilization */}
        {cardLimit > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Limit Utilization</Text>
              <Text style={[styles.sectionValue, { color: utilization > 80 ? colors.error : utilization > 50 ? colors.amber : colors.success }]}>
                {utilization.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: utilization > 80 ? colors.error : utilization > 50 ? colors.amber : colors.success,
                    width: `${Math.min(100, utilization)}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.utilizationText}>
              {formatCurrency(card.balance)} of {formatCurrency(cardLimit)} limit
            </Text>
          </View>
        )}

        {/* Billing Info */}
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.onSurfaceVariant} />
              <View>
                <Text style={styles.infoLabel}>Billing Date</Text>
                <Text style={styles.infoValue}>{formatOrdinal(card.billingDay ?? 1)}</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="card-outline" size={16} color={colors.onSurfaceVariant} />
              <View>
                <Text style={styles.infoLabel}>Card Network</Text>
                <Text style={styles.infoValue}>{card.network}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Annual Charges */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Annual Charges</Text>
            {(card.annualCharge ?? 0) > 0 ? (
              <Text style={[styles.sectionValue, { color: colors.amber }]}>
                {formatCurrency(card.annualCharge)}
              </Text>
            ) : (
              <Text style={[styles.sectionValue, { color: colors.success }]}>LTF</Text>
            )}
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="pricetag-outline" size={16} color={colors.onSurfaceVariant} />
              <View>
                <Text style={styles.infoLabel}>Annual Charges Date</Text>
                <Text style={styles.infoValue}>
                  {card.annualChargeDate
                    ? new Date(card.annualChargeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : 'Not set'}
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.onSurfaceVariant} />
              <View>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={[styles.infoValue, { color: (card.annualCharge ?? 0) > 0 ? colors.amber : colors.success }]}>
                  {(card.annualCharge ?? 0) > 0 ? 'Charged' : 'Lifetime Free'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Inline Card Settings */}
        {showSettings && (
          <View style={styles.settingsPanel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Edit Card Details</Text>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.settingsInputLabel}>BILLING DAY</Text>
                <TextInput
                  style={styles.settingsTextInput}
                  value={settingsBillingDay}
                  onChangeText={setSettingsBillingDay}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="15"
                  placeholderTextColor={colors.outline}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.settingsInputLabel}>ANNUAL CHARGES (₹)</Text>
                <TextInput
                  style={styles.settingsTextInput}
                  value={settingsAmc}
                  onChangeText={setSettingsAmc}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.outline}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.settingsInputLabel}>DUE DATE</Text>
                <TouchableOpacity
                  style={styles.settingsDateTrigger}
                  onPress={() => setSettingsDueCalendarVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={styles.settingsDateText}>
                    {settingsDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.settingsInputLabel}>AC DATE</Text>
                <TouchableOpacity
                  style={styles.settingsDateTrigger}
                  onPress={() => setSettingsAcCalendarVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={styles.settingsDateText}>
                    {settingsAcDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingsButtons}>
              <TouchableOpacity
                style={[styles.settingsBtn, styles.settingsBtnCancel]}
                onPress={() => setShowSettings(false)}
              >
                <Text style={styles.settingsBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsBtn, styles.settingsBtnSave]}
                onPress={saveSettings}
              >
                <Text style={styles.settingsBtnSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bill Payment */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bill Payment</Text>
          </View>
          <View style={styles.billRow}>
            <View style={styles.billItem}>
              <Text style={styles.billLabel}>BILL AMOUNT</Text>
              <Text style={styles.billValue}>{formatCurrency(card.billAmount ?? card.balance)}</Text>
            </View>
            <View style={styles.billItem}>
              <Text style={styles.billLabel}>PAID</Text>
              <Text style={[styles.billValue, { color: colors.success }]}>{formatCurrency(card.paidAmount ?? 0)}</Text>
            </View>
            <View style={styles.billItem}>
              <Text style={styles.billLabel}>REMAINING</Text>
              <Text style={[styles.billValue, { color: colors.error }]}>
                {formatCurrency(Math.max(0, (card.billAmount ?? card.balance) - (card.paidAmount ?? 0)))}
              </Text>
            </View>
          </View>
          {(card.billAmount ?? card.balance) > 0 && (
            <View style={styles.payProgressBg}>
              <View
                style={[
                  styles.payProgressFill,
                  {
                    backgroundColor: colors.success,
                    width: `${Math.min(100, ((card.paidAmount ?? 0) / (card.billAmount ?? card.balance)) * 100)}%`,
                  },
                ]}
              />
            </View>
          )}
          <TouchableOpacity
            style={[styles.payButton, { backgroundColor: accent }]}
            onPress={() => {
              const remaining = Math.max(0, (card.billAmount ?? card.balance) - (card.paidAmount ?? 0)) / 100;
              setPaymentInput(remaining > 0 ? remaining.toString() : '');
              setShowPayModal(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="card-outline" size={18} color={colors.textInverse} />
            <Text style={styles.payButtonText}>Pay Bill</Text>
          </TouchableOpacity>
        </View>

        {/* Card Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {cardTransactions.length === 0 ? (
            <Text style={styles.emptyText}>No transactions found for this card</Text>
          ) : (
            <>
              <Text style={styles.cycleLabel}>
                CURRENT BILL · DUE {dueDateRef.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
              {currentBillTxs.length === 0 ? (
                <Text style={styles.emptyText}>No spends in this statement period</Text>
              ) : (
                currentBillTxs.slice(0, 10).map((tx: any, index: number) => (
                  <View
                    key={tx.id}
                    style={[
                      styles.txItem,
                      index < Math.min(currentBillTxs.length, 10) - 1 && styles.txBorder,
                    ]}
                  >
                    <View style={[styles.txIcon, { backgroundColor: `${getCategoryColor(tx.category)}20` }]}>
                      <CategoryIcon category={tx.category} size={18} color={getCategoryColor(tx.category)} />
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txName} numberOfLines={1}>
                        {tx.notes || tx.category}
                      </Text>
                      <Text style={styles.txDate}>
                        {new Date(tx.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: tx.type === 'income' ? colors.success : colors.onSurface }]}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </Text>
                  </View>
                ))
              )}

              <Text style={[styles.cycleLabel, { marginTop: 10 }]}>
                NEXT CYCLE · AFTER {dueDateRef.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
              {nextCycleTxs.length === 0 ? (
                <Text style={styles.emptyText}>No spends after the statement date yet</Text>
              ) : (
                nextCycleTxs.slice(0, 10).map((tx: any, index: number) => (
                  <View
                    key={tx.id}
                    style={[
                      styles.txItem,
                      index < Math.min(nextCycleTxs.length, 10) - 1 && styles.txBorder,
                    ]}
                  >
                    <View style={[styles.txIcon, { backgroundColor: `${getCategoryColor(tx.category)}20` }]}>
                      <CategoryIcon category={tx.category} size={18} color={getCategoryColor(tx.category)} />
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txName} numberOfLines={1}>
                        {tx.notes || tx.category}
                      </Text>
                      <Text style={styles.txDate}>
                        {new Date(tx.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: tx.type === 'income' ? colors.success : colors.onSurface }]}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </Text>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showEditAmountModal} transparent animationType="fade" onRequestClose={() => setShowEditAmountModal(false)}>
        <View style={styles.payModalOverlay}>
          <View style={styles.payModalContent}>
            <Text style={styles.payModalTitle}>Update Outstanding — {card.name}</Text>
            <Text style={styles.payModalSub}>
              Set the latest outstanding balance from your bank app
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.payInputLabel}>LATEST OUTSTANDING AMOUNT (₹)</Text>
              <TextInput
                style={styles.payTextInput}
                value={editAmountInput}
                onChangeText={setEditAmountInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.outline}
                autoFocus
              />
            </View>
            <View style={styles.payModalButtons}>
              <TouchableOpacity
                style={[styles.payModalBtn, styles.payModalBtnCancel]}
                onPress={() => setShowEditAmountModal(false)}
              >
                <Text style={styles.payModalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.payModalBtn, styles.payModalBtnSave]}
                onPress={() => {
                  const amount = Math.round(parseFloat(editAmountInput) * 100);
                  if (isNaN(amount) || amount < 0) { alert('Enter a valid amount'); return; }
                  editCard(cardId, { balance: amount, currentOutstanding: amount }, user?.id);
                  setShowEditAmountModal(false);
                }}
              >
                <Text style={styles.payModalBtnSaveText}>Update Amount</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPayModal} transparent animationType="fade" onRequestClose={() => setShowPayModal(false)}>
        <View style={styles.payModalOverlay}>
          <View style={styles.payModalContent}>
            <Text style={styles.payModalTitle}>Pay Bill — {card.name}</Text>
            <Text style={styles.payModalSub}>
              Total bill: {formatCurrency(card.billAmount ?? card.balance)} | Already paid: {formatCurrency(card.paidAmount ?? 0)}
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.payInputLabel}>PAYMENT AMOUNT (₹)</Text>
              <TextInput
                style={styles.payTextInput}
                value={paymentInput}
                onChangeText={setPaymentInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.outline}
                autoFocus
              />
            </View>
            <View style={styles.payModalButtons}>
              <TouchableOpacity
                style={[styles.payModalBtn, styles.payModalBtnCancel]}
                onPress={() => setShowPayModal(false)}
              >
                <Text style={styles.payModalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.payModalBtn, styles.payModalBtnSave]}
                onPress={() => {
                  const amount = Math.round(parseFloat(paymentInput) * 100);
                  if (isNaN(amount) || amount <= 0) { alert('Enter a valid amount'); return; }
                  markCardBillPaid(cardId, amount, user?.id);
                  setShowPayModal(false);
                }}
              >
                <Text style={styles.payModalBtnSaveText}>Confirm Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CalendarPicker visible={settingsDueCalendarVisible} selected={settingsDueDate} onSelect={setSettingsDueDate} onClose={() => setSettingsDueCalendarVisible(false)} />
      <CalendarPicker visible={settingsAcCalendarVisible} selected={settingsAcDate} onSelect={setSettingsAcDate} onClose={() => setSettingsAcCalendarVisible(false)} />
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
  appBarTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, flex: 1, textAlign: 'center' },
  iconButton: { padding: 8, borderRadius: rounded.full },
  scrollContent: { padding: spacing.containerPadding, gap: 16, paddingBottom: 40 },
  notFound: { color: colors.onSurfaceVariant, fontSize: 14, textAlign: 'center', padding: 24 },
  heroCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  heroAccent: { height: 4 },
  heroContent: { padding: spacing.cardPadding, gap: 16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroName: { fontSize: 20, fontWeight: '800', color: colors.onSurface },
  heroNumber: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
  heroBank: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2, textTransform: 'uppercase' },
  heroStats: { flexDirection: 'row', gap: 24 },
  heroStat: { flex: 1 },
  heroStatLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroStatLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  heroStatValue: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  heroDueDays: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  sectionValue: { fontSize: 14, fontWeight: '700' },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3 },
  utilizationText: { fontSize: 11, color: colors.onSurfaceVariant },
  infoRow: { flexDirection: 'row', gap: 16 },
  infoItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceContainer, padding: 12, borderRadius: rounded.DEFAULT },
  infoLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.onSurface, marginTop: 1 },
  emptyText: { fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 12 },
  cycleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
    marginTop: 4,
    marginBottom: 2,
  },
  txItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  txIcon: { width: 36, height: 36, borderRadius: rounded.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txName: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  txDate: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 1 },
  txAmount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  billRow: { flexDirection: 'row', gap: 8 },
  billItem: { flex: 1, backgroundColor: colors.surfaceContainer, padding: 10, borderRadius: rounded.DEFAULT },
  billLabel: { fontSize: 9, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  billValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  payProgressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  payProgressFill: { height: 6, borderRadius: 3 },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: rounded.lg,
    marginTop: 8,
  },
  payButtonText: { fontSize: 15, fontWeight: '700', color: colors.textInverse },
  payModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  payModalContent: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: 24,
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  payModalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  payModalSub: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: -8 },
  inputGroup: { gap: 6 },
  payInputLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  payTextInput: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    height: 48,
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  payModalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  payModalBtn: { flex: 1, paddingVertical: 12, borderRadius: rounded.DEFAULT, alignItems: 'center' },
  payModalBtnCancel: { backgroundColor: 'transparent' },
  payModalBtnSave: { backgroundColor: colors.primaryContainer },
  payModalBtnCancelText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
  payModalBtnSaveText: { fontSize: 14, color: colors.textPrimary, fontWeight: '700' },
  settingsPanel: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.cardPadding,
    gap: 12,
  },
  inputRow: { flexDirection: 'row', gap: 12 },
  settingsInputLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  settingsTextInput: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    height: 44,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: '500',
  },
  settingsDateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    height: 44,
    paddingHorizontal: 10,
  },
  settingsDateText: { fontSize: 12, color: colors.onSurface, fontWeight: '600' },
  settingsButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  settingsBtn: { flex: 1, paddingVertical: 12, borderRadius: rounded.DEFAULT, alignItems: 'center' },
  settingsBtnCancel: { backgroundColor: colors.primaryFixedDim },
  settingsBtnSave: { backgroundColor: colors.primaryContainer },
  settingsBtnCancelText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  settingsBtnSaveText: { fontSize: 14, color: colors.textPrimary, fontWeight: '700' },
});
