/**
 * CreditCardsScreen — credit-card management.
 *
 * Restyled to the Meridian v2 reference: a "total due" panel with a split
 * bar, the card stack and a "due soon" list. Adding, editing and deleting
 * cards all still work.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc } from '../../../shared/theme/meridian';
import {
  Card,
  Chip,
  Label,
  PressScale,
  Rise,
  Screen,
  StackedShareBar,
} from '../../../shared/components/meridian';
import { useFinanceStore, CreditCard } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import CalendarPicker from '../../../shared/components/CalendarPicker';
import CardBrandLogo from '../../../shared/components/CardBrandLogo';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'CreditCards'>;

const NETWORKS = ['VISA', 'Mastercard', 'RuPay', 'Amex'] as const;

export default function CreditCardsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const cards = useFinanceStore((s) => s.cards);
  const editCard = useFinanceStore((s) => s.editCard);
  const addCard = useFinanceStore((s) => s.addCard);
  const deleteCard = useFinanceStore((s) => s.deleteCard);
  const { user } = useAuth();

  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [calendarVisible, setCalendarVisible] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addNetwork, setAddNetwork] = useState<CreditCard['network']>('VISA');
  const [addEndingWith, setAddEndingWith] = useState('');
  const [addBillingDay, setAddBillingDay] = useState('');
  const [addBank, setAddBank] = useState('');
  const [addLimit, setAddLimit] = useState('');
  const [addBalance, setAddBalance] = useState('');
  const [addDueDate, setAddDueDate] = useState(new Date());
  const [addCalendarVisible, setAddCalendarVisible] = useState(false);

  const formatCurrency = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const openEdit = (card: CreditCard) => {
    setEditingCard(card);
    setAmountInput((card.balance / 100).toString());
    setQuickInput('');
    setDueDate(new Date(card.dueDate));
  };

  const handleSave = () => {
    if (!editingCard) return;
    const amt = parseFloat(amountInput);
    editCard(
      editingCard.id,
      {
        balance: isNaN(amt) ? editingCard.balance : Math.round(amt * 100),
        dueDate: dueDate.toISOString(),
      },
      user?.id
    );
    setEditingCard(null);
  };

  const applyQuickAmount = (mode: 'plus' | 'minus') => {
    const quick = parseFloat(quickInput);
    if (isNaN(quick) || quick <= 0) return;
    const current = parseFloat(amountInput) || 0;
    const next = mode === 'plus' ? current + quick : Math.max(0, current - quick);
    setAmountInput(String(Math.round(next * 100) / 100));
  };

  const handleAddCard = () => {
    const name = addName.trim();
    const last4 = addEndingWith.trim();
    const billingDay = parseInt(addBillingDay, 10);
    if (!name || last4.length !== 4 || isNaN(billingDay) || billingDay < 1 || billingDay > 31) {
      alert('Enter a card name, 4-digit last four and a billing day (1-31)');
      return;
    }
    const limit = parseFloat(addLimit);
    const balance = parseFloat(addBalance);
    addCard(
      {
        name,
        network: addNetwork,
        endingWith: last4,
        billingDay,
        balance: isNaN(balance) ? 0 : Math.round(balance * 100),
        dueDate: addDueDate.toISOString(),
        bank: addBank.trim() || undefined,
        cardLimit: isNaN(limit) ? undefined : Math.round(limit * 100),
      },
      user?.id
    );
    setShowAddModal(false);
    setAddName('');
    setAddNetwork('VISA');
    setAddEndingWith('');
    setAddBillingDay('');
    setAddBank('');
    setAddLimit('');
    setAddBalance('');
    setAddDueDate(new Date());
  };

  const sortedCards = [...cards].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  const totalDue = cards.reduce((s, c) => s + (c.balance ?? 0), 0);

  const dueInfo = (card: CreditCard) => {
    const days = Math.ceil((new Date(card.dueDate).getTime() - Date.now()) / 86400000);
    if (days <= 0) return 'Due now';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days} days`;
  };

  const soonest = sortedCards[0];
  const soonestDue = soonest
    ? Math.max(0, Math.ceil((new Date(soonest.dueDate).getTime() - Date.now()) / 86400000))
    : null;

  const largestCards = [...cards]
    .filter((c) => (c.balance ?? 0) > 0)
    .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
    .slice(0, 3);

  const segments = sortedCards
    .filter((c) => (c.balance ?? 0) > 0)
    .map((c, i) => ({
      key: c.id,
      value: c.balance,
      color: [mc.red, mc.amber, mc.sky, mc.violet, mc.mint][i % 5],
      minWidth: 2,
    }));

  return (
    <Screen bottomInset={40}>
      {/* Header */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale onPress={() => navigation.goBack()} scale={0.9} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <View style={styles.appBarCenter}>
            <Label small>MANAGE</Label>
            <Text style={styles.appBarTitle}>Cards</Text>
          </View>
          <PressScale
            onPress={() => setShowSettingsModal(true)}
            scale={0.9}
            style={styles.iconButton}
            accessibilityLabel="Card settings"
          >
            <Ionicons name="settings-outline" size={18} color={mc.text} />
          </PressScale>
        </View>
      </Rise>

      {/* Total due */}
      {cards.length > 0 ? (
        <Rise index={1}>
          <Card tone="red">
            <View style={styles.totalRow}>
              <View>
                <Label color={mc.redSoft}>TOTAL DUE</Label>
                <Text style={styles.totalValue}>{formatCurrency(totalDue)}</Text>
              </View>
              {soonest && soonestDue !== null ? (
                <Chip size="sm" variant="soft" color={mc.redSoft}>
                  {formatCurrency(soonest.balance)} {dueInfo(soonest).toLowerCase()}
                </Chip>
              ) : null}
            </View>
            {segments.length > 0 ? (
              <StackedShareBar segments={segments} height={12} style={styles.splitBar} />
            ) : null}
            {largestCards.length > 0 ? (
              <Text style={styles.largestText}>
                Largest:{' '}
                {largestCards.map((c) => `${c.name} ${formatCurrency(c.balance)}`).join(' · ')}
              </Text>
            ) : null}
          </Card>
        </Rise>
      ) : null}

      {/* The card stack */}
      {cards.length === 0 ? (
        <Rise index={2}>
          <Card style={styles.emptyState}>
            <Ionicons name="card-outline" size={34} color={mc.textGhost} />
            <Text style={styles.emptyText}>No cards added yet</Text>
          </Card>
        </Rise>
      ) : (
        <Rise index={2}>
          {sortedCards.map((card) => {
            const initial = (card.name || 'C').trim().charAt(0).toUpperCase();
            return (
              <PressScale
                key={card.id}
                onPress={() => navigation.navigate('CreditCardDetail', { cardId: card.id })}
                scale={0.98}
                style={styles.stackCard}
              >
                <View style={styles.stackTop}>
                  <Text style={styles.stackName} numberOfLines={1}>
                    {card.name.toUpperCase()}
                  </Text>
                  <Ionicons name="wifi-outline" size={15} color={mc.textFaint} />
                </View>
                <Text style={styles.stackNumber}>•••• •••• •••• {card.endingWith}</Text>
                <PressScale
                  onPress={() => openEdit(card)}
                  scale={0.95}
                  style={styles.stackBalance}
                  accessibilityLabel={`Outstanding balance of ${card.name}`}
                >
                  <Text style={styles.stackBalanceText}>{formatCurrency(card.balance)}</Text>
                </PressScale>
                <View style={styles.stackBottom}>
                  <View style={styles.networkBadge}>
                    <CardBrandLogo network={card.network} size={30} />
                  </View>
                  <View style={styles.stackInitial}>
                    <Text style={styles.stackInitialText}>{initial}</Text>
                  </View>
                  <Text style={styles.stackDue}>{dueInfo(card)}</Text>
                </View>
              </PressScale>
            );
          })}
        </Rise>
      )}

      {/* Due soon */}
      {sortedCards.length > 0 ? (
        <Rise index={3}>
          <Label style={styles.sectionTitle}>DUE SOON</Label>
          <Card pad={false}>
            {sortedCards.map((card, idx) => {
              const days = Math.ceil((new Date(card.dueDate).getTime() - Date.now()) / 86400000);
              const urgent = days <= 1;
              const soon = days <= 7;
              return (
                <PressScale
                  key={card.id}
                  onPress={() => navigation.navigate('CreditCardDetail', { cardId: card.id })}
                  scale={0.99}
                  style={[styles.dueRow, idx > 0 && styles.dueDivider]}
                >
                  <View style={styles.dueMain}>
                    <View style={styles.dueTitleRow}>
                      <Text style={styles.dueTitle} numberOfLines={1}>
                        {card.name}
                      </Text>
                      <Chip size="sm" variant="soft" color={mc.textDim}>
                        {card.network}
                      </Chip>
                    </View>
                    <Text style={styles.dueSub}>•••• {card.endingWith}</Text>
                  </View>
                  <View style={styles.dueRight}>
                    <Text style={styles.dueAmount}>{formatCurrency(card.balance)}</Text>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={urgent ? mc.redSoft : soon ? mc.amber : mc.textDim}
                    >
                      {dueInfo(card)}
                    </Chip>
                  </View>
                </PressScale>
              );
            })}
          </Card>
        </Rise>
      ) : null}

      {/* Edit Modal */}
      {editingCard ? (
        <Modal
          visible={!!editingCard}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingCard(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingCard.name}</Text>
              <Text style={styles.modalSub}>•••• {editingCard.endingWith}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NEW OUTSTANDING</Text>
                <TextInput
                  style={[styles.textInput, styles.amountInput]}
                  value={amountInput}
                  onChangeText={setAmountInput}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={mc.textGhost}
                />
              </View>

              <View style={styles.quickMathGroup}>
                <Text style={styles.inputLabel}>ADJUST</Text>
                <View style={styles.quickMathRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={quickInput}
                    onChangeText={setQuickInput}
                    keyboardType="decimal-pad"
                    placeholder="Amount"
                    placeholderTextColor={mc.textGhost}
                  />
                  <PressScale
                    onPress={() => applyQuickAmount('plus')}
                    scale={0.92}
                    style={[styles.quickMathBtn, styles.quickMathBtnMint]}
                    accessibilityLabel="Add amount"
                  >
                    <Ionicons name="add" size={22} color={mc.mint} />
                  </PressScale>
                  <PressScale
                    onPress={() => applyQuickAmount('minus')}
                    scale={0.92}
                    style={[styles.quickMathBtn, styles.quickMathBtnRed]}
                    accessibilityLabel="Subtract amount"
                  >
                    <Ionicons name="remove" size={22} color={mc.redSoft} />
                  </PressScale>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DUE DATE</Text>
                <PressScale
                  onPress={() => setCalendarVisible(true)}
                  scale={0.98}
                  style={styles.datePickerTrigger}
                >
                  <Ionicons name="calendar-outline" size={17} color={mc.redSoft} />
                  <Text style={styles.datePickerText}>
                    {dueDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </PressScale>
              </View>

              <View style={styles.modalButtons}>
                <PressScale onPress={() => setEditingCard(null)} scale={0.97} wrapStyle={{ flex: 1 }} style={[styles.modalBtn, styles.modalBtnCancelPill]} accessibilityLabel="Cancel">
                  <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                </PressScale>
                <PressScale onPress={handleSave} scale={0.97} wrapStyle={{ flex: 1.4 }} style={[styles.modalBtn, styles.modalBtnSavePill]} accessibilityLabel="Save">
                  <Text style={styles.modalBtnTextSave}>Save</Text>
                </PressScale>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Add Card Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalSheetScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Add card</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CARD NAME</Text>
              <TextInput
                style={styles.textInput}
                value={addName}
                onChangeText={setAddName}
                placeholder="e.g. HDFC Millennia"
                placeholderTextColor={mc.textFaint}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NETWORK</Text>
              <View style={styles.networkRow}>
                {NETWORKS.map((n) => (
                  <PressScale
                    key={n}
                    onPress={() => setAddNetwork(n)}
                    scale={0.94}
                    style={[styles.networkChip, addNetwork === n && styles.networkChipActive]}
                  >
                    <Text
                      style={[
                        styles.networkChipText,
                        addNetwork === n && styles.networkChipTextActive,
                      ]}
                    >
                      {n}
                    </Text>
                  </PressScale>
                ))}
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>LAST 4 DIGITS</Text>
                <TextInput
                  style={styles.textInput}
                  value={addEndingWith}
                  onChangeText={setAddEndingWith}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="1234"
                  placeholderTextColor={mc.textFaint}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>BILLING DAY</Text>
                <TextInput
                  style={styles.textInput}
                  value={addBillingDay}
                  onChangeText={setAddBillingDay}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="15"
                  placeholderTextColor={mc.textFaint}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>BANK (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={addBank}
                onChangeText={setAddBank}
                placeholder="e.g. HDFC"
                placeholderTextColor={mc.textFaint}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DUE DATE</Text>
              <PressScale
                onPress={() => setAddCalendarVisible(true)}
                scale={0.98}
                style={styles.datePickerTrigger}
              >
                <Ionicons name="calendar-outline" size={17} color={mc.textDim} />
                <Text style={styles.datePickerText}>
                  {addDueDate.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </PressScale>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>LIMIT (?, optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={addLimit}
                  onChangeText={setAddLimit}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={mc.textFaint}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>BALANCE (?)</Text>
                <TextInput
                  style={styles.textInput}
                  value={addBalance}
                  onChangeText={setAddBalance}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={mc.textFaint}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <PressScale onPress={() => setShowAddModal(false)} scale={0.97} wrapStyle={{ flex: 1 }} style={[styles.modalBtn, styles.modalBtnCancelPill]} accessibilityLabel="Cancel">
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </PressScale>
              <PressScale onPress={handleAddCard} scale={0.97} wrapStyle={{ flex: 1.4 }} style={[styles.modalBtn, styles.modalBtnSavePill]} accessibilityLabel="Add card">
                <Text style={styles.modalBtnTextSave}>Add card</Text>
              </PressScale>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Card settings</Text>
            <Text style={styles.modalSub}>Manage cards and add new ones</Text>

            <PressScale
              onPress={() => {
                setShowSettingsModal(false);
                setAddName('');
                setAddNetwork('VISA');
                setAddEndingWith('');
                setAddBillingDay('');
                setAddBank('');
                setAddLimit('');
                setAddBalance('');
                setAddDueDate(new Date());
                setShowAddModal(true);
              }}
              scale={0.98}
              style={styles.settingsRow}
            >
              <View style={styles.settingsRowIcon}>
                <Ionicons name="add" size={19} color={mc.white} />
              </View>
              <Text style={styles.settingsRowText}>Add new card</Text>
              <Ionicons name="chevron-forward" size={15} color={mc.textFaint} />
            </PressScale>

            <View style={styles.settingsDivider} />

            {sortedCards.length === 0 ? (
              <Text style={styles.settingsEmptyText}>No cards yet</Text>
            ) : (
              sortedCards.map((card) => (
                <View key={card.id} style={styles.settingsRow}>
                  <View style={styles.settingsRowIcon}>
                    <Ionicons name="card-outline" size={17} color={mc.textDim} />
                  </View>
                  <View style={styles.settingsRowInfo}>
                    <Text style={styles.settingsRowText} numberOfLines={1}>
                      {card.name}
                    </Text>
                    <Text style={styles.settingsRowSub}>•••• {card.endingWith}</Text>
                  </View>
                  <PressScale
                    onPress={() => deleteCard(card.id, user?.id)}
                    scale={0.9}
                    accessibilityLabel={`Delete ${card.name}`}
                  >
                    <Ionicons name="trash-outline" size={17} color={mc.redSoft} />
                  </PressScale>
                </View>
              ))
            )}

            <PressScale
              onPress={() => setShowSettingsModal(false)}
              scale={0.96}
              style={styles.closeBtn}
            >
              <Text style={styles.modalBtnTextCancel}>Close</Text>
            </PressScale>
          </View>
        </View>
      </Modal>

      <CalendarPicker
        visible={calendarVisible}
        selected={dueDate}
        onSelect={setDueDate}
        onClose={() => setCalendarVisible(false)}
      />
      <CalendarPicker
        visible={addCalendarVisible}
        selected={addDueDate}
        onSelect={setAddDueDate}
        onClose={() => setAddCalendarVisible(false)}
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
  appBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: mc.text,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  splitBar: {
    marginVertical: 12,
  },
  largestText: {
    fontSize: 11,
    color: mc.textDim,
  },

  stackCard: {
    backgroundColor: mc.cardAlt,
    borderRadius: 24,
    padding: 16,
    marginBottom: 10,
    minHeight: 118,
  },
  stackTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stackName: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.5,
    color: mc.text,
    flex: 1,
  },
  stackNumber: {
    fontSize: 18,
    letterSpacing: 4,
    color: mc.text,
    marginTop: 22,
  },
  stackBalance: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  stackBalanceText: {
    fontSize: 16,
    fontWeight: '500',
    color: mc.text,
  },
  stackBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  networkBadge: {
    backgroundColor: mc.raised,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  stackInitial: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackInitialText: {
    fontSize: 12,
    fontWeight: '600',
    color: mc.white,
  },
  stackDue: {
    marginLeft: 'auto',
    fontSize: 12,
    color: mc.redSoft,
  },

  sectionTitle: {
    marginTop: 6,
    marginBottom: 8,
    marginLeft: 4,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  dueDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  dueMain: {
    flex: 1,
    minWidth: 0,
  },
  dueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dueTitle: {
    fontSize: 15,
    color: mc.text,
    flexShrink: 1,
  },
  dueSub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },
  dueRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dueAmount: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.text,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  emptyText: {
    fontSize: 14,
    color: mc.textDim,
    marginTop: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: mc.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 24,
  },
  modalSheetScroll: {
    maxHeight: '92%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: mc.text,
  },
  modalSub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: -6,
  },
  inputGroup: {
    gap: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: mc.textFaint,
  },
  textInput: {
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: mc.text,
    fontSize: 15,
  },
  amountInput: {
    fontSize: 20,
    paddingVertical: 15,
  },
  quickMathGroup: {
    gap: 6,
  },
  quickMathRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickMathBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: mc.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickMathBtnMint: {
    backgroundColor: mc.mintDim,
  },
  quickMathBtnRed: {
    backgroundColor: mc.redDim,
  },
  quickMathBtnText: {
    fontSize: 22,
    fontWeight: '500',
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  datePickerText: {
    fontSize: 15,
    color: mc.text,
  },
  networkRow: {
    flexDirection: 'row',
    gap: 8,
  },
  networkChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: mc.raised,
  },
  networkChipActive: {
    backgroundColor: mc.red,
  },
  networkChipText: {
    fontSize: 13,
    color: mc.textDim,
  },
  networkChipTextActive: {
    color: mc.white,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    paddingVertical: 13,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancelPill: {
    backgroundColor: mc.raised,
  },
  modalBtnSavePill: {
    backgroundColor: mc.red,
  },
  modalBtnTextCancel: {
    fontSize: 14,
    color: mc.textDim,
  },
  modalBtnTextSave: {
    fontSize: 16,
    color: mc.white,
    fontWeight: '500',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  settingsRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowInfo: {
    flex: 1,
    minWidth: 0,
  },
  settingsRowText: {
    fontSize: 14,
    color: mc.text,
    flex: 1,
  },
  settingsRowSub: {
    fontSize: 11,
    color: mc.textDim,
  },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mc.line,
    marginVertical: 6,
  },
  settingsEmptyText: {
    fontSize: 13,
    color: mc.textDim,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    marginTop: 4,
  },
});
