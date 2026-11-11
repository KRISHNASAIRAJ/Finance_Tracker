/**
 * BalanceSummaryScreen — consolidated balance summary across bank accounts
 * and credit cards with due dates and min-balance exclusions.
 * Glass Noir UI with donut-palette section color coding.
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
  Pressable,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { useFinanceStore, getMinBalanceForAccount } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import MonthPickerModal from '../components/MonthPickerModal';
import BankLogo from '../../../shared/components/BankLogo';

// Donut palette — same 6 colors used on the home screen cards
const DONUT = {
  pink: '#ffb2b9',
  blue: '#5ee6ff',
  coral: '#ea6479',
  purple: '#d0bcff',
  peach: '#ffdadc',
  cyan: '#00cbe6',
  red: '#FF887D',
  amber: '#E2A45C',
};

interface SectionItem {
  label: string;
  value: number;
  subtitle: string;
  alert: boolean;
  bank?: string;
  /** When set, the row becomes tappable (used by the Wallets section). */
  onPress?: () => void;
}

const ordinalSuffix = (n: number): string => {
  if (n >= 11 && n <= 13) return 'th';
  const last = n % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
};

const formatDueDate = (isoDate?: string): string => {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  return `Due ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
};

export default function BalanceSummaryScreen() {
  const navigation = useNavigation();
  const { transactions, cards, receivables, accounts, fixedExpenses, wallets, setWalletAmount, seedWallets } = useFinanceStore();
  const { user } = useAuth();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  // Bank Balances opens expanded so the wallet rows under it are visible.
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ 'Bank Balances': true });
  const [editingWallet, setEditingWallet] = useState<{ id: string; name: string } | null>(null);
  const [walletAmountInput, setWalletAmountInput] = useState('');

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const openWalletEditor = (id: string, name: string, current: number) => {
    setEditingWallet({ id, name });
    setWalletAmountInput(current > 0 ? String(current / 100) : '');
  };

  const saveWalletAmount = () => {
    if (!editingWallet) return;
    const rupees = parseFloat(walletAmountInput.replace(/,/g, ''));
    setWalletAmount(editingWallet.id, Number.isFinite(rupees) ? Math.round(rupees * 100) : 0, user?.id);
    setEditingWallet(null);
    setWalletAmountInput('');
  };

  // Make sure the standard wallet rows exist (idempotent).
  React.useEffect(() => {
    seedWallets(user?.id);
  }, [user?.id]);

  const accountsTotal = accounts.reduce((sum, acc) => sum + acc.amount, 0);
  const walletTotal = (wallets || []).reduce((sum, w) => sum + w.amount, 0);
  // Wallets are cash — they live inside the Bank Balances section and count
  // towards the balance and the net worth (no minimum-balance rule applies).
  const totalBalance = accountsTotal + walletTotal;
  const totalMinBalance = accounts.reduce((sum, acc) => sum + getMinBalanceForAccount(acc.title), 0);
  const effectiveBalance = totalBalance - totalMinBalance;
  const totalLent = receivables.filter((r) => r.type === 'lent').reduce((sum, r) => sum + (r.amount - (r.paidAmount || 0)), 0);
  const totalBorrowed = receivables.filter((r) => r.type === 'borrowed').reduce((sum, r) => sum + (r.amount - (r.paidAmount || 0)), 0);

  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const unpaidFixedExpensesTotal = fixedExpenses
    .filter((f) => f.lastPaidMonth !== currentMonthStr)
    .reduce((sum, f) => sum + f.amount, 0);
  const cardOutstandingTotal = cards.reduce((sum, c) => sum + c.balance, 0);
  const deficitsSum = accounts.reduce((sum, acc) => {
    const min = getMinBalanceForAccount(acc.title);
    return sum + (acc.amount < min ? min - acc.amount : 0);
  }, 0);
  const totalNetWorth = effectiveBalance + totalLent - totalBorrowed - unpaidFixedExpensesTotal - cardOutstandingTotal;

  // Monthly expenses (filtered by selected month, defaults to current month)
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const nextMonthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
  nextMonthStart.setHours(0, 0, 0, 0);
  const monthlyTxns = transactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return d >= monthStart && d < nextMonthStart && (tx.type === 'expense' || tx.type === 'fuel_purchase' || tx.type === 'vehicle_service');
    });
  const monthlyExpenses = monthlyTxns.reduce((sum, tx) => sum + tx.amount, 0);

  const formatCurrency = (paise: number) => {
    const rupees = paise / 100;
    return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
  };

  const sections: Array<{
    title: string;
    icon: string;
    color: string;
    items: SectionItem[];
    total: number;
    totalLabel: string;
  }> = [
    {
      title: 'Bank Balances',
      icon: 'business-outline',
      color: DONUT.blue,
      items: [
        ...accounts.map((acc) => ({
          label: acc.title,
          bank: acc.title,
          value: acc.amount,
          subtitle: acc.amount < getMinBalanceForAccount(acc.title)
            ? `Below min ₹${(getMinBalanceForAccount(acc.title) / 100).toLocaleString('en-IN')}`
            : '',
          alert: acc.amount < getMinBalanceForAccount(acc.title),
        })),
        // Wallets live inside this section — not as a separate card.
        ...(wallets || []).map((w) => ({
          label: w.name,
          value: w.amount,
          subtitle: w.amount > 0 ? 'Wallet · tap to update' : 'Wallet · tap to set balance',
          alert: false,
          onPress: () => openWalletEditor(w.id, w.name, w.amount),
        })),
      ],
      total: totalBalance,
      totalLabel: 'Total Bank Balance',
    },
    {
      title: 'Credit Card Bills',
      icon: 'card-outline',
      color: DONUT.coral,
      items: cards.filter((c) => c.balance > 0).map((c) => ({
        label: `${c.name} •••• ${c.endingWith}`,
        value: c.balance,
        subtitle: formatDueDate(c.dueDate),
        alert: false,
      })),
      total: cardOutstandingTotal,
      totalLabel: 'Total Card Bills',
    },
    {
      title: 'Lent Money',
      icon: 'arrow-up-circle-outline',
      color: DONUT.pink,
      items: receivables.filter((r) => r.type === 'lent').map((r) => ({
        label: r.personName,
        value: r.amount,
        subtitle: formatDueDate(r.dueDate),
        alert: false,
      })),
      total: totalLent,
      totalLabel: 'Total Lent',
    },
    {
      title: 'Borrowed Money',
      icon: 'arrow-down-circle-outline',
      color: DONUT.purple,
      items: receivables.filter((r) => r.type === 'borrowed').map((r) => ({
        label: r.personName,
        value: r.amount,
        subtitle: formatDueDate(r.dueDate),
        alert: false,
      })),
      total: totalBorrowed,
      totalLabel: 'Total Borrowed',
    },
    {
      title: 'Fixed Expenses (Unpaid)',
      icon: 'lock-closed-outline',
      color: DONUT.peach,
      items: fixedExpenses.filter((f) => f.lastPaidMonth !== currentMonthStr).map((f) => ({
        label: f.name,
        value: f.amount,
        subtitle: `Due ${f.billingDay}${ordinalSuffix(f.billingDay)} of month`,
        alert: false,
      })),
      total: unpaidFixedExpensesTotal,
      totalLabel: 'Total Unpaid Fixed',
    },
    {
      title: 'Monthly Spends',
      icon: 'wallet-outline',
      color: DONUT.cyan,
      items: monthlyTxns
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3)
        .map((tx) => ({
          label: tx.notes || tx.category || 'Expense',
          value: tx.amount,
          subtitle: new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          alert: false,
        })),
      total: monthlyExpenses,
      totalLabel: selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Balance Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Net Worth Card — glass with gradient tint */}
        <View style={[styles.glassPanel, styles.heroCard]}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroLabel}>Total Net Worth</Text>
          <Text style={styles.heroValue}>{formatCurrency(totalNetWorth)}</Text>
          <View style={styles.heroBreakdown}>
            <View style={styles.heroChip}>
              <View style={[styles.heroChipDot, { backgroundColor: DONUT.blue }]} />
              <Text style={styles.heroChipLabel}>Banks</Text>
              <Text style={[styles.heroChipValue, { color: DONUT.blue }]}>{formatCurrency(effectiveBalance)}</Text>
            </View>
            <View style={styles.heroChip}>
              <View style={[styles.heroChipDot, { backgroundColor: DONUT.pink }]} />
              <Text style={styles.heroChipLabel}>Lent</Text>
              <Text style={[styles.heroChipValue, { color: DONUT.pink }]}>+{formatCurrency(totalLent)}</Text>
            </View>
            <View style={styles.heroChip}>
              <View style={[styles.heroChipDot, { backgroundColor: DONUT.coral }]} />
              <Text style={styles.heroChipLabel}>Cards</Text>
              <Text style={[styles.heroChipValue, { color: DONUT.coral }]}>-{formatCurrency(cardOutstandingTotal)}</Text>
            </View>
            <View style={styles.heroChip}>
              <View style={[styles.heroChipDot, { backgroundColor: DONUT.purple }]} />
              <Text style={styles.heroChipLabel}>Fixed</Text>
              <Text style={[styles.heroChipValue, { color: DONUT.purple }]}>-{formatCurrency(unpaidFixedExpensesTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Sections — glass cards with color-coded headers */}
        {sections.map((section) => (
          <View key={section.title} style={[styles.glassPanel, styles.section]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: `${section.color}1F` }]}>
                <Ionicons name={section.icon as any} size={18} color={section.color} />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.title === 'Monthly Spends' && (
                <TouchableOpacity
                  style={styles.monthBtn}
                  onPress={() => setMonthPickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.monthBtnText}>
                    {selectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={colors.primary} />
                </TouchableOpacity>
              )}
              <Text style={[styles.sectionTotal, { color: section.color }]}>{formatCurrency(section.total)}</Text>
            </View>
            {section.items.length > 0 && (
              <View style={styles.sectionBody}>
                {(expandedSections[section.title] ? section.items : section.items.slice(0, 3)).map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={item.onPress ? 0.7 : 1}
                    onPress={item.onPress}
                    style={[styles.itemRow, idx === (expandedSections[section.title] ? section.items.length : Math.min(3, section.items.length)) - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.itemLeft}>
                      {item.bank && <BankLogo title={item.bank} size={30} />}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemLabel}>{item.label}</Text>
                        {item.subtitle && (
                          <Text style={[styles.itemSubtitle, item.alert && { color: DONUT.red }]}>{item.subtitle}</Text>
                        )}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.itemValue, item.alert && { color: DONUT.red }]}>{formatCurrency(item.value)}</Text>
                      {item.onPress && (
                        <Ionicons name="create-outline" size={15} color={colors.onSurfaceVariant} style={{ marginLeft: 8 }} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                {section.items.length > 3 && (
                  <TouchableOpacity
                    style={styles.viewAllBtn}
                    onPress={() => toggleSection(section.title)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewAllText}>
                      {expandedSections[section.title] ? 'Show Less' : `Show More (${section.items.length - 3} more)`}
                    </Text>
                    <Ionicons
                      name={expandedSections[section.title] ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}
            {section.items.length === 0 && (
              <View style={styles.sectionBody}>
                <Text style={styles.emptyText}>No entries</Text>
              </View>
            )}
          </View>
        ))}

        {deficitsSum > 0 && (
          <View style={styles.deficitBanner}>
            <Ionicons name="warning" size={16} color={DONUT.amber} />
            <Text style={styles.deficitText}>
              Bank balance deficits: {formatCurrency(deficitsSum)} below minimum required
            </Text>
          </View>
        )}
      </ScrollView>

      <MonthPickerModal
        visible={monthPickerVisible}
        selected={selectedMonth}
        maxMonth={new Date(now.getFullYear(), now.getMonth(), 1)}
        onSelect={setSelectedMonth}
        onClose={() => setMonthPickerVisible(false)}
      />

      {/* Wallet balance editor */}
      <Modal
        visible={!!editingWallet}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingWallet(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingWallet(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{editingWallet?.name}</Text>
            <Text style={styles.modalSubtitle}>Current balance in this wallet (₹)</Text>
            <TextInput
              style={styles.modalInput}
              value={walletAmountInput}
              onChangeText={setWalletAmountInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.onSurfaceVariant}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setEditingWallet(null); setWalletAmountInput(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveWalletAmount}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 120,
  },
  glassPanel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 28,
    overflow: 'hidden',
  },
  heroCard: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderColor: 'rgba(94,230,255,0.28)',
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(94,230,255,0.08)',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  heroBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    justifyContent: 'center',
  },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 84,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  heroChipLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    marginBottom: 2,
  },
  heroChipValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  section: {
    borderRadius: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionTotal: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionBody: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  itemSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  itemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#1E1E2A',
    borderWidth: 1,
    borderColor: '#2E2E42',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  modalInput: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2E2E42',
    backgroundColor: '#15151F',
    color: colors.onSurface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2E2E42',
  },
  modalCancelText: {
    color: colors.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 13,
  },
  modalSave: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  modalSaveText: {
    color: '#0B0F1A',
    fontWeight: '700',
    fontSize: 13,
  },
  deficitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(226,164,92,0.12)',
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(226,164,92,0.3)',
  },
  deficitText: {
    fontSize: 12,
    color: '#E2A45C',
    fontWeight: '600',
    flex: 1,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  monthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  monthBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
