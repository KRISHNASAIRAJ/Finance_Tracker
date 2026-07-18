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
import { useFinanceStore, CreditCard } from '../store';
import { useAuth } from '../../../services/AuthProvider';

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

// Calendar Picker
interface CalendarPickerProps {
  visible: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

function CalendarPicker({ visible, selected, onSelect, onClose }: CalendarPickerProps) {
  const [month, setMonth] = useState(new Date(selected));

  const changeMonth = (offset: number) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  };

  const getDays = () => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(new Date(month.getFullYear(), month.getMonth(), i));
    return days;
  };

  const isSelected = (d: Date) =>
    d.getDate() === selected.getDate() &&
    d.getMonth() === selected.getMonth() &&
    d.getFullYear() === selected.getFullYear();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={cal.overlay}>
        <View style={cal.card}>
          <View style={cal.header}>
            <TouchableOpacity onPress={() => changeMonth(-1)}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={cal.monthLabel}>
              {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => changeMonth(1)}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={cal.weekRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={cal.weekLabel}>{d}</Text>
            ))}
          </View>
          <View style={cal.daysGrid}>
            {getDays().map((day, i) =>
              day ? (
                <TouchableOpacity
                  key={i}
                  style={[cal.dayBtn, isSelected(day) && cal.dayBtnSelected]}
                  onPress={() => { onSelect(day); onClose(); }}
                >
                  <Text style={[cal.dayText, isSelected(day) && cal.dayTextSel]}>{day.getDate()}</Text>
                </TouchableOpacity>
              ) : (
                <View key={i} style={cal.dayBtn} />
              )
            )}
          </View>
          <TouchableOpacity style={cal.closeBtn} onPress={onClose}>
            <Text style={cal.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function CreditCardsScreen() {
  const navigation = useNavigation();
  const { cards, editCard } = useFinanceStore() as any;
  const { user } = useAuth();

  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [calendarVisible, setCalendarVisible] = useState(false);

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

    if (typeof editCard === 'function') {
      editCard(editingCard.id, { balance, dueDate: dueDate.toISOString() }, user?.id);
    }
    setEditingCard(null);
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
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {cards.map((card: CreditCard) => {
          const accent = getCardAccent(card.name);
          const daysUntilDue = Math.ceil(
            (new Date(card.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const urgency = daysUntilDue <= 3 ? colors.error : daysUntilDue <= 7 ? '#f59e0b' : colors.success;

          return (
            <TouchableOpacity
              key={card.id}
              style={[styles.cardItem, { borderColor: `${accent}30` }]}
              onPress={() => openEdit(card)}
              activeOpacity={0.8}
            >
              <View style={[styles.cardAccentBar, { backgroundColor: accent }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardNameBlock}>
                    <Text style={styles.cardName}>{card.name}</Text>
                    <Text style={styles.cardNumber}>•••• {card.endingWith} · {card.network}</Text>
                  </View>
                  <View style={styles.cardEditBadge}>
                    <Ionicons name="create-outline" size={14} color={accent} />
                    <Text style={[styles.cardEditText, { color: accent }]}>Edit</Text>
                  </View>
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
            </View>
          </View>
        </Modal>
      )}

      <CalendarPicker
        visible={calendarVisible}
        selected={dueDate}
        onSelect={setDueDate}
        onClose={() => setCalendarVisible(false)}
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
});

// Calendar sub-styles
const cal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthLabel: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  weekLabel: { width: 32, textAlign: 'center', fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '600' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dayBtn: { width: 36, height: 36, borderRadius: rounded.full, alignItems: 'center', justifyContent: 'center' },
  dayBtnSelected: { backgroundColor: colors.primary },
  dayText: { fontSize: 13, color: colors.onSurface, fontWeight: '500' },
  dayTextSel: { color: '#fff', fontWeight: '700' },
  closeBtn: { alignItems: 'center', paddingVertical: 10 },
  closeText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
});
