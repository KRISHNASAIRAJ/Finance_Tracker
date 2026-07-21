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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore, CreditCard } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import CalendarPicker from '../../../shared/components/CalendarPicker';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'CreditCards'>;

const NETWORKS = ['VISA', 'Mastercard', 'RuPay', 'Amex'] as const;

import { CARD_DEFINITIONS } from '../cardData';

const CARD_TEMPLATES = CARD_DEFINITIONS.map(c => ({
  id: c.id,
  name: c.name,
  network: c.network,
  bank: c.bank,
}));

// Card brand-specific colors
function getCardAccent(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('cashback') || n.includes('sbi')) return '#3b82f6';
  if (n.includes('power') || n.includes('idfc')) return '#10b981';
  if (n.includes('simplysave')) return '#f59e0b';
  if (n.includes('hsbc')) return '#ef4444';
  if (n.includes('amazon') || n.includes('icici')) return '#a855f7';
  if (n.includes('slice')) return '#f97316';
  if (n.includes('cred') || n.includes('indusind')) return '#ec4899';
  return colors.primary;
}

export default function CreditCardsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const cards = useFinanceStore((s) => s.cards);
  const editCard = useFinanceStore((s) => s.editCard);
  const addCard = useFinanceStore((s) => s.addCard);
  const deleteCard = useFinanceStore((s) => s.deleteCard);
  const { user } = useAuth();

  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [calendarVisible, setCalendarVisible] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addNetwork, setAddNetwork] = useState<CreditCard['network']>('VISA');
  const [addEndingWith, setAddEndingWith] = useState('');
  const [addBillingDay, setAddBillingDay] = useState('');
  const [addBank, setAddBank] = useState('');
  const [addLimit, setAddLimit] = useState('');
  const [addBalance, setAddBalance] = useState('');
  const [addDueDate, setAddDueDate] = useState(new Date());
  const [addCalendarVisible, setAddCalendarVisible] = useState(false);

  const totalOutstanding = cards.reduce((sum: number, c: CreditCard) => sum + c.balance, 0);

  const formatCurrency = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const openEdit = (card: CreditCard) => {
    setEditingCard(card);
    setBalanceInput((card.balance / 100).toString());
    setDueDate(new Date(card.dueDate));
  };

  const handleSave = () => {
    if (!editingCard) return;
    const balance = Math.round(parseFloat(balanceInput) * 100);
    if (isNaN(balance)) { alert('Enter a valid amount'); return; }
    editCard(editingCard.id, { balance, dueDate: dueDate.toISOString() }, user?.id);
    setEditingCard(null);
  };

  const handleAddCard = () => {
    const name = addName.trim();
    const endingWith = addEndingWith.trim();
    const billingDay = parseInt(addBillingDay, 10);
    if (!name || !endingWith || isNaN(billingDay) || billingDay < 1 || billingDay > 31) {
      alert('Fill name, last 4 digits, and a valid billing day (1-31)');
      return;
    }
    const limit = parseFloat(addLimit) * 100;
    const balance = parseFloat(addBalance) * 100;
    addCard({
      name,
      network: addNetwork,
      endingWith,
      billingDay,
      balance: isNaN(balance) ? 0 : balance,
      dueDate: addDueDate.toISOString(),
      bank: addBank.trim() || undefined,
      cardLimit: isNaN(limit) ? undefined : limit,
    }, user?.id);
    setShowAddModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.logoText}>Credit Cards</Text>
          <Text style={styles.logoSub}>Total: {formatCurrency(totalOutstanding)}</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => {
          setAddName(''); setAddNetwork('VISA'); setAddEndingWith('');
          setAddBillingDay(''); setAddBank(''); setAddLimit(''); setAddBalance('');
          setAddDueDate(new Date());
          setShowAddModal(true);
        }}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {[...cards].sort((a: CreditCard, b: CreditCard) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((card: CreditCard) => {
          const accent = getCardAccent(card.name);
          const daysUntilDue = Math.ceil(
            (new Date(card.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const urgency = daysUntilDue <= 3 ? colors.error : daysUntilDue <= 7 ? '#f59e0b' : colors.success;

          return (
            <TouchableOpacity
              key={card.id}
              style={[styles.cardItem, { borderColor: `${accent}30` }]}
              onPress={() => navigation.navigate('CreditCardDetail', { cardId: card.id })}
              activeOpacity={0.8}
            >
              <View style={[styles.cardAccentBar, { backgroundColor: accent }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardNameBlock}>
                    <Text style={styles.cardName}>{card.name}</Text>
                    <Text style={styles.cardNumber}>•••• {card.endingWith} · {card.network}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cardEditBadge}
                    onPress={(e) => { e.stopPropagation(); openEdit(card); }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="create-outline" size={14} color={accent} />
                    <Text style={[styles.cardEditText, { color: accent }]}>Edit</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.cardBottomRow}>
                  <View>
                    <Text style={styles.balanceLabel}>OUTSTANDING</Text>
                    <Text style={[styles.balanceValue, { color: accent }]}>
                      {formatCurrency(card.balance)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.balanceLabel}>DUE DATE</Text>
                    <Text style={[styles.dueValue, { color: urgency }]}>
                      {new Date(card.dueDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                    <Text style={[styles.dueDays, { color: urgency }]}>
                      {daysUntilDue > 0 ? `${daysUntilDue}d left` : 'Overdue!'}
                    </Text>
                  </View>
                </View>

                {/* Due-date progress bar */}
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: urgency,
                        width: `${Math.max(0, Math.min(100, (1 - daysUntilDue / card.billingDay) * 100))}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.billingCycleNote}>
                  Billing date: {card.billingDay}th of every month
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Edit Modal */}
      {editingCard && (
        <Modal visible={!!editingCard} transparent animationType="fade" onRequestClose={() => setEditingCard(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingCard.name}</Text>
              <Text style={styles.modalSub}>•••• {editingCard.endingWith}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>OUTSTANDING BALANCE (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  value={balanceInput}
                  onChangeText={setBalanceInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.outline}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DUE DATE</Text>
                <TouchableOpacity
                  style={styles.datePickerTrigger}
                  onPress={() => setCalendarVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={styles.datePickerText}>
                    {dueDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setEditingCard(null)}
                >
                  <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSave}>
                  <Text style={styles.modalBtnTextSave}>Save</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.deleteCardBtn}
                onPress={() => {
                  deleteCard(editingCard.id, user?.id);
                  setEditingCard(null);
                }}
              >
                <Ionicons name="trash-outline" size={14} color={colors.error} />
                <Text style={styles.deleteCardText}>Delete this card</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Add Card Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Credit Card</Text>
            {/* Quick-add card templates */}
            <View style={{ gap: 8 }}>
              <Text style={styles.inputLabel}>QUICK ADD</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                {CARD_TEMPLATES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.templatePill}
                    onPress={() => {
                      setAddName(t.name);
                      setAddNetwork(t.network);
                      setAddBank(t.bank);
                      setAddEndingWith('');
                      setAddBillingDay('');
                      setAddLimit('');
                      setAddBalance('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle" size={14} color={colors.primary} />
                    <Text style={styles.templateText}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 12 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CARD NAME</Text>
                <TextInput style={styles.textInput} value={addName} onChangeText={setAddName} placeholder="e.g. HDFC Millennia" placeholderTextColor={colors.outline} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NETWORK</Text>
                <View style={styles.chipRow}>
                  {NETWORKS.map((n) => (
                    <TouchableOpacity key={n} style={[styles.chip, addNetwork === n && styles.chipActive]} onPress={() => setAddNetwork(n)}>
                      <Text style={[styles.chipText, addNetwork === n && styles.chipTextActive]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.rowFields}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>LAST 4 DIGITS</Text>
                  <TextInput style={styles.textInput} value={addEndingWith} onChangeText={setAddEndingWith} keyboardType="number-pad" maxLength={4} placeholder="1234" placeholderTextColor={colors.outline} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>BILLING DAY</Text>
                  <TextInput style={styles.textInput} value={addBillingDay} onChangeText={setAddBillingDay} keyboardType="number-pad" maxLength={2} placeholder="15" placeholderTextColor={colors.outline} />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>BANK (OPTIONAL)</Text>
                <TextInput style={styles.textInput} value={addBank} onChangeText={setAddBank} placeholder="e.g. HDFC" placeholderTextColor={colors.outline} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FIRST DUE DATE</Text>
                <TouchableOpacity
                  style={styles.datePickerTrigger}
                  onPress={() => setAddCalendarVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={styles.datePickerText}>
                    {addDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.rowFields}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>CREDIT LIMIT (₹)</Text>
                  <TextInput style={styles.textInput} value={addLimit} onChangeText={setAddLimit} keyboardType="decimal-pad" placeholder="50000" placeholderTextColor={colors.outline} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>OUTSTANDING (₹)</Text>
                  <TextInput style={styles.textInput} value={addBalance} onChangeText={setAddBalance} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.outline} />
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleAddCard}>
                <Text style={styles.modalBtnTextSave}>Add Card</Text>
              </TouchableOpacity>
            </View>
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
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  logoText: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  logoSub: { fontSize: 11, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 1 },
  iconButton: { padding: 8, borderRadius: rounded.full },
  scrollContent: { padding: spacing.containerPadding, gap: 14, paddingBottom: 40 },
  cardItem: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardAccentBar: { width: 4, borderRadius: 0 },
  cardBody: { flex: 1, padding: spacing.cardPadding, gap: 12 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardNameBlock: { gap: 2 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  cardNumber: { fontSize: 11, color: colors.onSurfaceVariant },
  cardEditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rounded.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardEditText: { fontSize: 11, fontWeight: '600' },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  balanceLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  balanceValue: { fontSize: 20, fontWeight: '800' },
  dueValue: { fontSize: 15, fontWeight: '700' },
  dueDays: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  progressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2 },
  progressFill: { height: 3, borderRadius: 2 },
  billingCycleNote: { fontSize: 10, color: colors.onSurfaceVariant },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  modalSub: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: -8 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
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
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 44,
    paddingHorizontal: 12,
  },
  datePickerText: { fontSize: 14, color: colors.onSurface, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: rounded.DEFAULT, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: 'transparent' },
  modalBtnSave: { backgroundColor: colors.primaryContainer },
  modalBtnTextCancel: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
  modalBtnTextSave: { fontSize: 14, color: '#fff', fontWeight: '700' },
  deleteCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  deleteCardText: { fontSize: 12, color: colors.error, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: rounded.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.surfaceContainer,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },
  chipTextActive: { color: '#fff' },
  rowFields: { flexDirection: 'row', gap: 10 },
  templatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: rounded.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginRight: 8,
  },
  templateText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurface,
  },
});
