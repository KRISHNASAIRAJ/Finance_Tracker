/**
 * CreditCardDetailScreen — per-card detail: bills, spend, due dates and
 * usage breakdown with edit actions.
 *
 * Restyled to the Meridian v2 reference (s22): a credit-card hero with the
 * outstanding amount and a days-until-due ring, billing/network and
 * charges/points stat cards, a bill-payment progress panel, the current
 * bill and next-cycle transactions, and the pay-bill action.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr, alpha, clamp01 } from '../../../shared/theme/meridian';
import {
  Card,
  IconTile,
  Label,
  ProgressBar,
  Ring,
  Screen,
  TopBar,
} from '../../../shared/components/meridian';
import { useFinanceStore } from '../store';
import { cardRewardValue } from '../cardRewards';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import { getCategoryColor } from '../../../shared/categoryMap';
import CategoryIcon from '../../../shared/CategoryIcon';
import CalendarPicker from '../../../shared/components/CalendarPicker';

type DetailRouteProp = RouteProp<FinanceStackParamList, 'CreditCardDetail'>;

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
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsInput, setPointsInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsBillingDay, setSettingsBillingDay] = useState('');
  const [settingsAmc, setSettingsAmc] = useState('');
  const [settingsAcDate, setSettingsAcDate] = useState(new Date());
  const [settingsAcCalendarVisible, setSettingsAcCalendarVisible] = useState(false);
  const [settingsDueDate, setSettingsDueDate] = useState(new Date());
  const [settingsDueCalendarVisible, setSettingsDueCalendarVisible] = useState(false);

  const card = (cards as any[]).find((c: any) => c.id === cardId);
  const reward = cardRewardValue(card ?? { name: '' }, card?.points);

  if (!card) {
    return (
      <Screen bottomInset={36}>
        <TopBar title="Card detail" onBack={() => navigation.goBack()} variant="center" />
        <Text style={styles.notFound}>Card not found</Text>
      </Screen>
    );
  }

  const daysUntilDue = Math.ceil(
    (new Date(card.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const urgency = daysUntilDue <= 3 ? mc.redSoft : daysUntilDue <= 7 ? mc.amber : mc.mint;
  const dueFraction = clamp01(Math.max(0, daysUntilDue) / 31);

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
  const purchases = cardTransactions.filter((tx: any) => tx.type !== 'credit_card_bill');
  const billPaidTxs = cardTransactions
    .filter((tx: any) => tx.type === 'credit_card_bill')
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  const currentBillTxs = purchases
    .filter((tx: any) => {
      const d = new Date(tx.date);
      return d >= cycleStartRef && d < dueDateRef;
    })
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const nextCycleTxs = purchases
    .filter((tx: any) => new Date(tx.date) >= dueDateRef)
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const cardLimit = card.cardLimit || 0;
  const utilization = cardLimit > 0 ? clamp01(card.balance / cardLimit) : 0;

  const billAmount = card.billAmount ?? card.balance;
  const paidAmount = card.paidAmount ?? 0;
  const billLeft = Math.max(0, billAmount - paidAmount);
  const paidFraction = billAmount > 0 ? clamp01(paidAmount / billAmount) : 0;

  const formatCurrency = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const formatDecimal = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

  const formatOrdinal = (day: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = day % 100;
    return `${day}${s[(v - 20) % 10] || s[v] || s[0]}`;
  };

  const dueDateShort = dueDateRef.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

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

  const renderTxRow = (tx: any, isLast: boolean) => (
    <View key={tx.id} style={[styles.txRow, !isLast && styles.txDivider]}>
      <View style={[styles.txCategoryIcon, { backgroundColor: alpha(getCategoryColor(tx.category), 0.13) }]}>
        <CategoryIcon category={tx.category} size={18} color={getCategoryColor(tx.category)} />
      </View>
      <View style={styles.txMain}>
        <Text style={styles.txName} numberOfLines={1}>
          {tx.notes || tx.category}
        </Text>
        <Text style={styles.txDate}>
          {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </Text>
      </View>
      <Text style={[styles.txAmount, tx.type === 'income' && { color: mc.mint }]}>
        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
      </Text>
    </View>
  );

  return (
    <Screen bottomInset={36}>
      <TopBar
        title={card.name}
        onBack={() => navigation.goBack()}
        variant="center"
        right={
          <TouchableOpacity
            style={styles.gearBtn}
            onPress={openSettingsPanel}
            accessibilityLabel="Card settings"
          >
            <Ionicons name="settings-outline" size={19} color={showSettings ? mc.redSoft : mc.text} />
          </TouchableOpacity>
        }
      />

      {/* Hero card */}
      <Card tone="alt" style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroName} numberOfLines={1}>{card.name}</Text>
            <Text style={styles.heroNumber}>•••• {card.endingWith}</Text>
          </View>
          {card.network ? (
            <View style={styles.networkBadge}>
              <Text style={styles.networkBadgeText}>{card.network}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.heroBottom}>
          <View style={styles.heroOutstanding}>
            <View style={styles.heroOutstandingLabelRow}>
              <Label>OUTSTANDING</Label>
              <TouchableOpacity
                onPress={() => {
                  setEditAmountInput((card.balance / 100).toString());
                  setShowEditAmountModal(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Edit outstanding"
              >
                <Ionicons name="pencil" size={11} color={mc.textDim} />
              </TouchableOpacity>
            </View>
            <Text style={styles.heroAmount}>{formatCurrency(card.balance)}</Text>
          </View>

          <Ring
            size={84}
            stroke={8}
            progress={dueFraction}
            color={urgency}
            style={styles.heroRing}
          >
            <Text style={[styles.ringValue, { color: urgency }]}>
              {Math.max(0, daysUntilDue)}d
            </Text>
            <Text style={styles.ringSub}>{dueDateShort}</Text>
          </Ring>
        </View>
      </Card>

      {/* Limit utilization */}
      {cardLimit > 0 ? (
        <Card>
          <View style={styles.cardHeaderRow}>
            <Label>LIMIT UTILIZATION</Label>
            <Text style={[styles.cardHeaderValue, { color: utilization >= 0.8 ? mc.redSoft : utilization >= 0.5 ? mc.amber : mc.mint }]}>
              {Math.round(utilization * 100)}%
            </Text>
          </View>
          <ProgressBar
            value={utilization}
            color={utilization >= 0.8 ? mc.redSoft : utilization >= 0.5 ? mc.amber : mc.mint}
            height={8}
            style={styles.utilizationBar}
          />
          <Text style={styles.cardFootnote}>
            {formatCurrency(card.balance)} of {formatCurrency(cardLimit)} limit
          </Text>
        </Card>
      ) : null}

      {/* Billing date + network */}
      <View style={styles.twoUp}>
        <Card style={styles.twoUpCell}>
          <Label>BILLING DATE</Label>
          <Text style={styles.twoUpValue}>{formatOrdinal(card.billingDay ?? 1)}</Text>
        </Card>
        <Card style={styles.twoUpCell}>
          <Label>NETWORK</Label>
          <Text style={styles.twoUpValue}>{card.network || '—'}</Text>
        </Card>
      </View>

      {/* Annual charges */}
      <Card>
        <View style={styles.chargesRow}>
          <View style={styles.chargesMain}>
            <Label>ANNUAL CHARGES</Label>
            <Text style={styles.chargesSub} numberOfLines={1}>
              {(card.annualCharge ?? 0) > 0
                ? card.annualChargeDate
                  ? `Charged on ${new Date(card.annualChargeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                  : 'Annual fee'
                : 'Never charged'}
            </Text>
          </View>
          {(card.annualCharge ?? 0) > 0 ? (
            <View style={[styles.pill, { backgroundColor: mc.amberDim }]}>
              <Text style={[styles.pillText, { color: mc.amber }]}>
                {formatCurrency(card.annualCharge)} / yr
              </Text>
            </View>
          ) : (
            <View style={[styles.pill, { backgroundColor: mc.mintDim }]}>
              <Ionicons name="shield-checkmark" size={12} color={mc.mint} />
              <Text style={[styles.pillText, { color: mc.mint }]}>Lifetime free</Text>
            </View>
          )}
        </View>
      </Card>

      {/* Reward points */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Label>REWARD POINTS</Label>
          <TouchableOpacity
            onPress={() => {
              setPointsInput(String(reward.points || ''));
              setShowPointsModal(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Edit reward points"
          >
            <Ionicons name="pencil" size={14} color={mc.textDim} />
          </TouchableOpacity>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{reward.points.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>POINTS</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: mc.amber }]}>{formatCurrency(reward.rewardPaise)}</Text>
            <Text style={styles.statLabel}>{reward.rule.directCashback ? 'CASHBACK' : 'VALUE'}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, styles.statRate]} numberOfLines={1}>{reward.rule.label}</Text>
            <Text style={styles.statLabel}>RATE</Text>
          </View>
        </View>
      </Card>

      {/* Bill payment */}
      <Card>
        <Label>BILL PAYMENT</Label>
        {billAmount > 0 ? (
          <ProgressBar value={paidFraction} color={mc.mint} height={8} style={styles.payBar} />
        ) : (
          <ProgressBar value={0} color={mc.mint} height={8} style={styles.payBar} />
        )}
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{formatCurrency(billAmount)}</Text>
            <Text style={styles.statLabel}>BILL</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: mc.mint }]}>{formatCurrency(paidAmount)}</Text>
            <Text style={styles.statLabel}>PAID</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: mc.redSoft }]}>{formatCurrency(billLeft)}</Text>
            <Text style={styles.statLabel}>LEFT</Text>
          </View>
        </View>
      </Card>

      {/* Pay bill */}
      <TouchableOpacity
        style={styles.payButton}
        onPress={() => {
          const remaining = Math.max(0, (card.billAmount ?? card.balance) - (card.paidAmount ?? 0)) / 100;
          setPaymentInput(remaining > 0 ? remaining.toString() : '');
          setShowPayModal(true);
        }}
        activeOpacity={0.85}
        accessibilityLabel="Pay bill"
      >
        <Ionicons name="card-outline" size={18} color={mc.white} />
        <Text style={styles.payButtonText}>Pay bill</Text>
      </TouchableOpacity>

      {/* Inline card settings */}
      {showSettings && (
        <Card>
          <View style={styles.cardHeaderRow}>
            <Label>EDIT CARD DETAILS</Label>
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
                placeholderTextColor={mc.textGhost}
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
                placeholderTextColor={mc.textGhost}
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
                <Ionicons name="calendar-outline" size={15} color={mc.redSoft} />
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
                <Ionicons name="calendar-outline" size={15} color={mc.redSoft} />
                <Text style={styles.settingsDateText}>
                  {settingsAcDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.settingsButtons}>
            <TouchableOpacity style={[styles.settingsBtn, styles.settingsBtnCancel]} onPress={() => setShowSettings(false)}>
              <Text style={styles.settingsBtnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingsBtn, styles.settingsBtnSave]} onPress={saveSettings}>
              <Text style={styles.settingsBtnSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Current bill */}
      <Card pad={false} style={styles.billCard}>
        <View style={styles.billCardPad}>
          <Label>CURRENT BILL · DUE {dueDateShort.toUpperCase()}</Label>
          {billPaidTxs.length === 0 ? (
            <Text style={styles.sectionEmpty}>No payments logged yet</Text>
          ) : (
            billPaidTxs.map((tx: any, index: number) => (
              <View key={tx.id} style={[styles.txRow, index < billPaidTxs.length - 1 && styles.txDivider]}>
                <IconTile icon="receipt-outline" color={mc.mint} background={mc.mintDim} size={36} />
                <View style={styles.txMain}>
                  <Text style={styles.txName}>Bill paid</Text>
                  <Text style={styles.txDate}>
                    {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Text style={[styles.txAmount, { color: mc.text }]}>{formatCurrency(tx.amount)}</Text>
              </View>
            ))
          )}

          <Label style={styles.nextCycleLabel}>NEXT CYCLE · AFTER {dueDateShort.toUpperCase()}</Label>
          {nextCycleTxs.length === 0 ? (
            <Text style={styles.sectionEmpty}>No spends after the statement date yet</Text>
          ) : (
            nextCycleTxs.slice(0, 10).map((tx: any, index: number) =>
              renderTxRow(tx, index === Math.min(nextCycleTxs.length, 10) - 1)
            )
          )}
        </View>

        {currentBillTxs.length > 0 ? (
          <>
            <View style={styles.billCardPad}>
              <Label style={styles.nextCycleLabel}>THIS STATEMENT · {currentBillTxs.length} PURCHASES</Label>
              {currentBillTxs.slice(0, 10).map((tx: any, index: number) =>
                renderTxRow(tx, index === Math.min(currentBillTxs.length, 10) - 1)
              )}
            </View>
          </>
        ) : null}
      </Card>

      {/* Edit outstanding modal — bottom sheet */}
      <Modal visible={showEditAmountModal} transparent animationType="fade" onRequestClose={() => setShowEditAmountModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{card.name}</Text>
            <Text style={styles.sheetSub}>•••• {card.endingWith}</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.settingsInputLabel}>NEW OUTSTANDING (₹)</Text>
              <TextInput
                style={[styles.settingsTextInput, styles.sheetAmount]}
                value={editAmountInput}
                onChangeText={setEditAmountInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={mc.textGhost}
                autoFocus
              />
            </View>
            <View style={styles.sheetButtons}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnCancel]} onPress={() => setShowEditAmountModal(false)}>
                <Text style={styles.sheetBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnSave]}
                onPress={() => {
                  const amount = Math.round(parseFloat(editAmountInput) * 100);
                  if (isNaN(amount) || amount < 0) { alert('Enter a valid amount'); return; }
                  editCard(cardId, { balance: amount, currentOutstanding: amount }, user?.id);
                  setShowEditAmountModal(false);
                }}
              >
                <Text style={styles.sheetBtnSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reward points modal */}
      <Modal visible={showPointsModal} transparent animationType="fade" onRequestClose={() => setShowPointsModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Reward points</Text>
            <Text style={styles.sheetSub}>
              {reward.rule.label}. {reward.rule.directCashback
                ? 'These points redeem directly as cashback.'
                : 'Reward value = points ÷ 4.'}
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.settingsInputLabel}>POINTS COLLECTED</Text>
              <TextInput
                style={[styles.settingsTextInput, styles.sheetAmount]}
                value={pointsInput}
                onChangeText={setPointsInput}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={mc.textGhost}
              />
            </View>
            <View style={styles.sheetButtons}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnCancel]} onPress={() => setShowPointsModal(false)}>
                <Text style={styles.sheetBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnSave]}
                onPress={() => {
                  const pts = Math.round(parseFloat(pointsInput.replace(/,/g, '')));
                  if (isNaN(pts) || pts < 0) { alert('Enter a valid points count'); return; }
                  editCard(cardId, { points: pts }, user?.id);
                  setShowPointsModal(false);
                }}
              >
                <Text style={styles.sheetBtnSaveText}>Save points</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pay bill modal */}
      <Modal visible={showPayModal} transparent animationType="fade" onRequestClose={() => setShowPayModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Pay bill</Text>
            <Text style={styles.sheetSub}>
              Total bill: {formatDecimal(card.billAmount ?? card.balance)} · Already paid: {formatDecimal(card.paidAmount ?? 0)}
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.settingsInputLabel}>PAYMENT AMOUNT (₹)</Text>
              <TextInput
                style={[styles.settingsTextInput, styles.sheetAmount]}
                value={paymentInput}
                onChangeText={setPaymentInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={mc.textGhost}
                autoFocus
              />
            </View>
            <View style={styles.sheetButtons}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnCancel]} onPress={() => setShowPayModal(false)}>
                <Text style={styles.sheetBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnSave]}
                onPress={() => {
                  const amount = Math.round(parseFloat(paymentInput) * 100);
                  // 0 is valid — paying 0 on an already-clear bill just rolls
                  // the due date to the next cycle.
                  if (isNaN(amount) || amount < 0) { alert('Enter a valid amount'); return; }
                  markCardBillPaid(cardId, amount, user?.id);
                  setShowPayModal(false);
                }}
              >
                <Text style={styles.sheetBtnSaveText}>Confirm payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CalendarPicker visible={settingsDueCalendarVisible} selected={settingsDueDate} onSelect={setSettingsDueDate} onClose={() => setSettingsDueCalendarVisible(false)} />
      <CalendarPicker visible={settingsAcCalendarVisible} selected={settingsAcDate} onSelect={setSettingsAcDate} onClose={() => setSettingsAcCalendarVisible(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notFound: {
    color: mc.textDim,
    fontSize: 14,
    textAlign: 'center',
    padding: 24,
  },
  gearBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero card
  heroCard: {
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroLeft: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '500',
    color: mc.text,
  },
  heroNumber: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 3,
  },
  networkBadge: {
    backgroundColor: mc.white,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  networkBadgeText: {
    color: '#E8650A',
    fontWeight: '500',
    fontSize: 12,
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroOutstanding: {
    flex: 1,
    minWidth: 0,
  },
  heroOutstandingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '500',
    color: mc.redSoft,
    marginTop: 6,
  },
  heroRing: {
    flex: 0,
  },
  ringValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  ringSub: {
    fontSize: 9,
    color: mc.textDim,
    marginTop: 1,
  },

  // Shared card bits
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  cardHeaderValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardFootnote: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 8,
  },
  utilizationBar: {
    marginTop: 2,
  },

  // Two-up
  twoUp: {
    flexDirection: 'row',
    gap: 10,
  },
  twoUpCell: {
    flex: 1,
    gap: 2,
    padding: 12,
  },
  twoUpValue: {
    fontSize: 17,
    color: mc.text,
    marginTop: 2,
  },

  // Annual charges
  chargesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chargesMain: {
    flex: 1,
    minWidth: 0,
  },
  chargesSub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: mr.badge,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Stat row (points / bill payment)
  statRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },
  statRate: {
    fontSize: 13,
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: mc.textDim,
  },
  payBar: {
    marginTop: 10,
    marginBottom: 4,
  },

  // Pay button
  payButton: {
    backgroundColor: mc.red,
    borderRadius: 22,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: mc.white,
  },

  // Settings panel
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  inputGroup: {
    gap: 6,
  },
  settingsInputLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: mc.textDim,
    paddingHorizontal: 4,
  },
  settingsTextInput: {
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: mc.text,
  },
  settingsDateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  settingsDateText: {
    fontSize: 13,
    color: mc.text,
  },
  settingsButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 2,
  },
  settingsBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 18,
  },
  settingsBtnCancel: {
    backgroundColor: mc.raised,
  },
  settingsBtnSave: {
    backgroundColor: mc.red,
  },
  settingsBtnCancelText: {
    fontSize: 14,
    color: mc.textDim,
  },
  settingsBtnSaveText: {
    fontSize: 14,
    color: mc.white,
    fontWeight: '500',
  },

  // Bill sections
  billCard: {
    paddingVertical: 6,
  },
  billCardPad: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  nextCycleLabel: {
    marginTop: 12,
    marginBottom: 2,
  },
  sectionEmpty: {
    fontSize: 13,
    color: mc.textFaint,
    textAlign: 'center',
    paddingVertical: 12,
  },
  txCategoryIcon: {
    width: 36,
    height: 36,
    borderRadius: mr.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  txDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mc.line,
  },
  txMain: {
    flex: 1,
    minWidth: 0,
  },
  txName: {
    fontSize: 14,
    color: mc.text,
  },
  txDate: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: mc.redSoft,
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
    paddingTop: 18,
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
  sheetAmount: {
    fontSize: 20,
    paddingVertical: 15,
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
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
