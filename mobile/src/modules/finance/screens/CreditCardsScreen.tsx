/**
 * CreditCardsScreen — credit-card management: add/edit/delete cards with
 * network, billing day, balance and limit fields.
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { useFinanceStore, CreditCard } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import CalendarPicker from '../../../shared/components/CalendarPicker';

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

  const sortedCards = [...cards].sort(
    (a: CreditCard, b: CreditCard) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.appBarLabel}>manage</Text>
          <Text style={styles.appBarTitle}>Cards</Text>
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
        {/* Vertical Card Stack */}
        {sortedCards.map((card: CreditCard, i: number) => {
          const initial = (card.name || 'M').trim().charAt(0).toUpperCase();
          const daysUntilDue = Math.ceil(
            (new Date(card.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const dueText = daysUntilDue <= 0 ? 'Due today' : daysUntilDue === 1 ? 'Due tomorrow' : `Due in ${daysUntilDue} days`;
          return (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.stackCard,
                { backgroundColor: `rgba(255,255,255,${(0.15 - i * 0.04).toFixed(2)})` },
              ]}
              onPress={() => navigation.navigate('CreditCardDetail', { cardId: card.id })}
              activeOpacity={0.9}
            >
              <View style={styles.stackTop}>
                <Ionicons name="radio-outline" size={26} color="rgba(255,255,255,0.8)" />
                <View style={styles.stackTopRight}>
                  <Text style={styles.stackName}>{card.name}</Text>
                  <TouchableOpacity onPress={() => openEdit(card)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="create-outline" size={14} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.stackChipRow}>
                <Ionicons name="hardware-chip-outline" size={26} color="rgba(255,255,255,0.5)" />
              </View>
              <Text style={styles.stackNumber}>•••• •••• •••• {card.endingWith}</Text>
              <View style={styles.stackBottom}>
                <View>
                  <Text style={styles.stackHolderLabel}>CARD HOLDER</Text>
                  <Text style={styles.stackHolderValue}>{card.network || card.name}</Text>
                </View>
                <View style={styles.stackBadge}>
                  <Text style={styles.stackBadgeText}>{initial}</Text>
                </View>
              </View>
              <View style={styles.stackDueBadge}>
                <Text style={styles.stackDueText}>{dueText}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {cards.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={40} color={colors.outline} />
            <Text style={styles.emptyText}>No cards added yet</Text>
          </View>
        )}

        {/* Active Cards List */}
        {cards.length > 0 && (
          <View>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Active Cards</Text>
            </View>
            <View style={styles.listContainer}>
              {sortedCards.map((card: CreditCard) => {
                const initial = (card.name || 'M').trim().charAt(0).toUpperCase();
                return (
                  <TouchableOpacity
                    key={card.id}
                    style={styles.listRow}
                    onPress={() => navigation.navigate('CreditCardDetail', { cardId: card.id })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.listRowLeft}>
                      <View style={styles.listAvatar}>
                        <Text style={styles.listAvatarText}>{initial}</Text>
                      </View>
                      <View>
                        <Text style={styles.listRowName}>{card.name}</Text>
                        <Text style={styles.listRowMeta}>•••• {card.endingWith}</Text>
                      </View>
                    </View>
                    <View style={styles.listRowRight}>
                      <Text style={styles.listRowAmount}>{formatCurrency(card.balance)}</Text>
                      <Text style={styles.listRowDue}>
                        Due {new Date(card.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
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
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Card</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CARD NAME</Text>
              <TextInput style={styles.textInput} value={addName} onChangeText={setAddName} placeholder="e.g. HDFC Millennia" placeholderTextColor={colors.outline} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NETWORK</Text>
              <View style={styles.networkRow}>
                {NETWORKS.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.networkChip, addNetwork === n && styles.networkChipActive]}
                    onPress={() => setAddNetwork(n)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.networkChipText, addNetwork === n && styles.networkChipTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputRow}>
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
              <Text style={styles.inputLabel}>BANK (optional)</Text>
              <TextInput style={styles.textInput} value={addBank} onChangeText={setAddBank} placeholder="e.g. HDFC" placeholderTextColor={colors.outline} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DUE DATE</Text>
              <TouchableOpacity style={styles.datePickerTrigger} onPress={() => setAddCalendarVisible(true)} activeOpacity={0.8}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.datePickerText}>
                  {addDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>LIMIT (₹, optional)</Text>
                <TextInput style={styles.textInput} value={addLimit} onChangeText={setAddLimit} keyboardType="decimal-pad" placeholder="50000" placeholderTextColor={colors.outline} />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>BALANCE (₹)</Text>
                <TextInput style={styles.textInput} value={addBalance} onChangeText={setAddBalance} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.outline} />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleAddCard}>
                <Text style={styles.modalBtnTextSave}>Add Card</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <CalendarPicker visible={calendarVisible} selected={dueDate} onSelect={setDueDate} onClose={() => setCalendarVisible(false)} />
      <CalendarPicker visible={addCalendarVisible} selected={addDueDate} onSelect={setAddDueDate} onClose={() => setAddCalendarVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  iconButton: { padding: 8, borderRadius: 20 },
  appBarLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.5 },
  appBarTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  scrollContent: { padding: 24, gap: 16, paddingBottom: 120 },
  stackCard: {
    height: 200,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 24,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  stackTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stackTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stackName: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.5 },
  stackChipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stackNumber: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', letterSpacing: 3 },
  stackBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  stackHolderLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  stackHolderValue: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase' },
  stackBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  stackBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  stackDueBadge: { position: 'absolute', bottom: 8, right: 24 },
  stackDueText: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  emptyState: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  listHeader: { marginBottom: 8 },
  listTitle: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 },
  listContainer: { gap: 8 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16,
  },
  listRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  listAvatarText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  listRowName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  listRowMeta: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  listRowRight: { alignItems: 'flex-end' },
  listRowAmount: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  listRowDue: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#101010', borderRadius: 32, padding: 24, gap: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  modalSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: -8 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.6 },
  textInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)', height: 44, paddingHorizontal: 12, color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  datePickerTrigger: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)', height: 44, paddingHorizontal: 12 },
  datePickerText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: 'transparent' },
  modalBtnSave: { backgroundColor: 'rgba(255,255,255,0.15)' },
  modalBtnTextCancel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  modalBtnTextSave: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  deleteCardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  deleteCardText: { fontSize: 12, color: '#FF887D', fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 12 },
  networkRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  networkChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
  networkChipActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' },
  networkChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  networkChipTextActive: { color: '#FFFFFF' },
});