import React, { useState, useEffect } from 'react';
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
import { useFinanceStore, Transaction, getMinBalanceForAccount, CreditCard } from '../store';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';
import { getCategoryIcon, getCategoryColor } from '../../../shared/categoryMap';
import { useFinanceSync, queueTransactionSync, queueCardSync } from '../hooks/useFinanceSync';
import { useAuth } from '../../../services/AuthProvider';
import { scheduleAllReminders } from '../../../services/notificationService';
import CardAssistant from '../../../shared/components/CardAssistant';
import PayzappWalletScreen from '../../../shared/components/PayzappWallet';

type NavigationProp = NativeStackNavigationProp<FinanceStackParamList, 'FinanceHome'>;

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
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(month.getFullYear(), month.getMonth(), i));
    }
    return days;
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.calOverlay}>
        <View style={styles.calCard}>
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={() => changeMonth(-1)}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.calMonthText}>
              {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => changeMonth(1)}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.calWeekdays}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <Text key={d} style={styles.calWeekdayText}>{d}</Text>
            ))}
          </View>
          <View style={styles.calGrid}>
            {getDays().map((day, idx) => {
              if (!day) return <View key={`empty-${idx}`} style={styles.calDayCell} />;
              const isSelected = day.toDateString() === selected.toDateString();
              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={[styles.calDayCell, isSelected && styles.calDaySelected]}
                  onPress={() => { onSelect(day); onClose(); }}
                >
                  <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected]}>
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.calCloseBtn} onPress={onClose}>
            <Text style={styles.calCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function FinanceHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const {
    transactions,
    cards,
    receivables,
    accounts,
    fixedExpenses,
    notifications,
    getTotalBalance,
    getMonthlyExpenses,
    editCard,
  } = useFinanceStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const { loading: syncing } = useFinanceSync();

  const [isExpanded, setIsExpanded] = React.useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [billAmountInput, setBillAmountInput] = useState('');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [showCardAssistant, setShowCardAssistant] = useState(false);
  const [showPayzappWallet, setShowPayzappWallet] = useState(false);

  useEffect(() => {
    scheduleAllReminders();
  }, []);

  const openEdit = (card: CreditCard) => {
    setEditingCard(card);
    setBillAmountInput(card.billAmount ? (card.billAmount / 100).toString() : ((card.balance || 0) / 100).toString());
    setPaidAmountInput(card.paidAmount ? (card.paidAmount / 100).toString() : '0');
    setDueDate(card.dueDate ? new Date(card.dueDate) : new Date());
  };

  const handleSave = () => {
    if (!editingCard) return;
    const billAmount = Math.round(parseFloat(billAmountInput) * 100);
    const paidAmount = Math.round(parseFloat(paidAmountInput) * 100);
    if (isNaN(billAmount)) { alert('Enter a valid bill amount'); return; }
    if (isNaN(paidAmount)) { alert('Enter a valid paid amount'); return; }

    const updated: Partial<CreditCard> = { dueDate: dueDate.toISOString(), billAmount, paidAmount };
    if (typeof editCard === 'function') {
      editCard(editingCard.id, updated);
    }
    if (user) {
      queueCardSync(user.id, 'update', { id: editingCard.id, ...updated });
    }
    setEditingCard(null);
    scheduleAllReminders();
  };

  const handleMarkFullyPaid = () => {
    if (!editingCard) return;
    const billAmount = Math.round(parseFloat(billAmountInput) * 100);
    if (isNaN(billAmount)) { alert('Enter a valid bill amount'); return; }
    setPaidAmountInput((billAmount / 100).toString());
  };

  const billLeft = editingCard
    ? Math.max(0, (Math.round(parseFloat(billAmountInput || '0') * 100) || 0) - (Math.round(parseFloat(paidAmountInput || '0') * 100) || 0))
    : 0;

  const totalBalance = getTotalBalance();
  const monthlyExpenses = getMonthlyExpenses();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Dynamic calculations from user backup lists
  const totalLent = receivables.filter((r: any) => r.type === 'lent').reduce((acc: number, r: any) => acc + r.amount, 0);
  const totalBorrowed = receivables.filter((r: any) => r.type === 'borrowed').reduce((acc: number, r: any) => acc + r.amount, 0);
  const cardOutstandingTotal = cards.reduce((acc: number, c: any) => acc + c.balance, 0);
  const fixedExpensesTotal = fixedExpenses.reduce((sum: number, f: any) => sum + f.amount, 0);
  const unpaidFixedExpensesTotal = fixedExpenses
    .filter((f: any) => f.lastPaidMonth !== currentMonthStr)
    .reduce((sum: number, f: any) => sum + f.amount, 0);
  
  // Calculate minimum balance deficits
  const deficitsSum = accounts.reduce((sum: number, acc: any) => {
    const min = getMinBalanceForAccount(acc.title);
    return sum + (acc.amount < min ? min - acc.amount : 0);
  }, 0);

  // User Formula: bank balance + lent - borrow - fixed expenses - credit card bills - minimum balances (if less than defined)
  const totalNetWorth = totalBalance + totalLent - totalBorrowed - unpaidFixedExpensesTotal - cardOutstandingTotal - deficitsSum;

  // Dynamic category calculations for Expense Distribution
  const EXCLUDED_CHART_CATEGORIES = ['Rent', 'SIP', 'Investments', 'Housing'];
  const expenseTxs = transactions.filter(
    (tx: any) =>
      (tx.type === 'expense' || tx.type === 'fuel_purchase' || tx.type === 'vehicle_service') &&
      tx.type !== 'fixed_expense' &&
      !EXCLUDED_CHART_CATEGORIES.includes(tx.category)
  );
  const totalExpense = expenseTxs.reduce((sum: number, tx: any) => sum + tx.amount, 0);

  const categoryTotals: { [key: string]: number } = {};
  expenseTxs.forEach((tx: any) => {
    categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
  });

  const categoriesSorted = Object.keys(categoryTotals).map((cat: string) => ({
    name: cat,
    amount: categoryTotals[cat],
    percentage: totalExpense > 0 ? (categoryTotals[cat] / totalExpense) * 100 : 0,
  })).sort((a: any, b: any) => b.amount - a.amount); 

  const formatCurrency = (paise: number) => {
    const rupees = paise / 100;
    return `₹${rupees.toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  const formatCurrencyDetailed = (paise: number) => {
    const rupees = paise / 100;
    return `₹${rupees.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  };



  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Meridian</Text>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => (navigation as any).navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.onSurface} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Balance Summary Section */}
        <TouchableOpacity
          style={styles.netWorthContainer}
          onPress={() => navigation.navigate('BalanceSummary')}
          activeOpacity={0.9}
        >
          <Text style={styles.netWorthLabel}>Balance Summary</Text>
          <Text style={styles.netWorthValue}>{formatCurrency(totalNetWorth)}</Text>
        </TouchableOpacity>

        {/* Bento Grid Summaries */}
        <View style={styles.bentoGrid}>
          {/* Monthly Spend (Links to MonthlySpendScreen) */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => navigation.navigate('MonthlySpend')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoIconWrapper, { backgroundColor: `${colors.primaryContainer}20` }]}>
              <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.bentoLabel}>Monthly Spend</Text>
              <Text style={styles.bentoValue}>{formatCurrency(monthlyExpenses)}</Text>
            </View>
          </TouchableOpacity>

          {/* Credit Card Bills (Links to CreditCards) */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => navigation.navigate('CreditCards')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoIconWrapper, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="card-outline" size={18} color="#f59e0b" />
            </View>
            <View>
              <Text style={styles.bentoLabel}>Credit Card Bills</Text>
              <Text style={styles.bentoValue}>{formatCurrency(cardOutstandingTotal)}</Text>
            </View>
          </TouchableOpacity>

          {/* Bank Balances (Links to BankAccounts) */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => navigation.navigate('BankAccounts')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoIconWrapper, { backgroundColor: '#10b98120' }]}>
              <Ionicons name="business-outline" size={18} color="#10b981" />
            </View>
            <View>
              <Text style={styles.bentoLabel}>Bank Balances</Text>
              <Text style={styles.bentoValue}>{formatCurrency(totalBalance)}</Text>
            </View>
          </TouchableOpacity>

          {/* Net Lent (Links to LentBorrowed) */}
          <TouchableOpacity
            style={styles.bentoCard}
            onPress={() => navigation.navigate('LentBorrowed')}
            activeOpacity={0.8}
          >
            <View style={[styles.bentoIconWrapper, { backgroundColor: '#3b82f620' }]}>
              <Ionicons name="arrow-up-circle-outline" size={18} color="#3b82f6" />
            </View>
            <View>
              <Text style={styles.bentoLabel}>Net Lent</Text>
              <Text style={[styles.bentoValue, { color: colors.success }]}>+{formatCurrency(totalLent)}</Text>
            </View>
          </TouchableOpacity>

          {/* Fixed Expenses (Links to FixedExpensesScreen) */}
          <TouchableOpacity
            style={[styles.bentoCard, styles.bentoCardFullWidth]}
            onPress={() => navigation.navigate('FixedExpenses')}
            activeOpacity={0.85}
          >
            <View style={[styles.bentoIconWrapper, { backgroundColor: '#6366f120' }]}>
              <Ionicons name="lock-closed-outline" size={18} color="#6366f1" />
            </View>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={styles.fixedHeaderRow}>
                  <Text style={styles.bentoLabel}>Fixed Expenses</Text>
                  {unpaidFixedExpensesTotal > 0 ? (
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>
                        {fixedExpenses.filter((f: any) => f.lastPaidMonth === currentMonthStr).length} paid
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.statusPill, { backgroundColor: `${colors.success}18`, borderColor: `${colors.success}30` }]}>
                      <Text style={[styles.statusPillText, { color: colors.success }]}>All paid</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.bentoValue}>{formatCurrency(unpaidFixedExpensesTotal)}</Text>
                <Text style={styles.bentoValueSecondary}>of {formatCurrency(fixedExpensesTotal)} total</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceVariant} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Expense Distribution Card (Clickable) */}
        <TouchableOpacity
          style={styles.distributionCard}
          onPress={() => navigation.navigate('FinanceReports')}
          activeOpacity={0.9}
        >
          <Text style={styles.cardTitle}>Expense Distribution</Text>
          <View style={styles.distributionContent}>
            {/* Custom Visual Donut Ring Representation */}
            <View style={styles.donutContainer}>
              <View style={[styles.donutOuterRing, { borderColor: categoriesSorted[0] ? getCategoryColor(categoriesSorted[0].name) : colors.primary, borderTopColor: 'transparent', borderRightColor: 'transparent' }]}>
                <View style={styles.donutInnerRing}>
                  <Text style={styles.donutSub}>Total</Text>
                  <Text style={styles.donutVal}>
                    {formatCurrency(totalExpense)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Dynamic Legend List */}
            <View style={styles.legendContainer}>
              {categoriesSorted.slice(0, 3).map((cat) => {
                const dotColor = getCategoryColor(cat.name);
                
                return (
                  <View key={cat.name} style={styles.legendItem}>
                    <View style={styles.row}>
                      <View style={[styles.legendDot, { backgroundColor: dotColor }]} />
                      <Text style={styles.legendName} numberOfLines={1}>{cat.name}</Text>
                    </View>
                    <Text style={styles.legendPercentage}>{cat.percentage.toFixed(0)}%</Text>
                  </View>
                );
              })}
              {categoriesSorted.length === 0 && (
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>No logs recorded</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Credit Cards Horizontal Slider */}
        <View style={styles.cardsSection}>
          <View style={styles.cardsHeader}>
            <Text style={styles.cardTitle}>Credit Cards</Text>
            <TouchableOpacity onPress={() => navigation.navigate('CreditCards')}>
              <Ionicons name="arrow-forward" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsScroll}
            snapToInterval={296}
            decelerationRate="fast"
          >
            {[...cards]
              .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
              .map((card: any) => {
              // Set border accent color based on network/bank name
              let borderColor = 'rgba(255, 255, 255, 0.05)';
              let decorColor = 'rgba(255, 255, 255, 0.02)';
              if (card.name.toLowerCase().includes('cashback')) {
                borderColor = 'rgba(59, 130, 246, 0.2)'; // Blue
                decorColor = 'rgba(59, 130, 246, 0.05)';
              } else if (card.name.toLowerCase().includes('power')) {
                borderColor = 'rgba(16, 185, 129, 0.2)'; // Green
                decorColor = 'rgba(16, 185, 129, 0.05)';
              } else if (card.name.toLowerCase().includes('simplysave')) {
                borderColor = 'rgba(245, 158, 11, 0.2)'; // Orange
                decorColor = 'rgba(245, 158, 11, 0.05)';
              } else if (card.name.toLowerCase().includes('hsbc')) {
                borderColor = 'rgba(239, 68, 68, 0.2)'; // Red
                decorColor = 'rgba(239, 68, 68, 0.05)';
              } else if (card.name.toLowerCase().includes('amazon')) {
                borderColor = 'rgba(139, 92, 246, 0.2)'; // Purple
                decorColor = 'rgba(139, 92, 246, 0.05)';
              }

              return (
                <TouchableOpacity
                  key={card.id}
                  style={[styles.premiumCard, { borderColor }]}
                  onPress={() => openEdit(card)}
                  activeOpacity={0.9}
                >
                  <View style={[styles.cardDecor, { backgroundColor: decorColor }]} />
                  <View style={styles.cardTop}>
                    <View>
                      <Text style={styles.cardBank}>{card.name}</Text>
                      <Text style={styles.cardNumber}>•••• {card.endingWith}</Text>
                    </View>
                    <Ionicons name="card" size={22} color="rgba(255,255,255,0.6)" />
                  </View>
                  <View style={styles.cardBottom}>
                    <View>
                      <Text style={styles.cardBalanceLabel}>
                        {card.billAmount ? 'Bill Left' : 'Current Balance'}
                      </Text>
                      <Text style={styles.cardBalanceValue}>
                        {card.billAmount
                          ? formatCurrency(Math.max(0, card.billAmount - (card.paidAmount || 0)))
                          : formatCurrency(card.balance)}
                      </Text>
                    </View>
                    <Text style={styles.cardDueDate}>
                      Due {(card.dueDate ? new Date(card.dueDate) : new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Recent Activity (Live logs) */}
        <View style={styles.recentActivitySection}>
          <View style={styles.recentHeader}>
            <Text style={styles.cardTitle}>Recent Transactions</Text>
            {transactions.length > 5 && (
              <TouchableOpacity
                style={styles.viewAllPill}
                onPress={() => navigation.navigate('AllTransactions')}
                activeOpacity={0.8}
              >
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons name="arrow-forward" size={13} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.activityList}>
            {[...transactions]
              .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, isExpanded ? undefined : 5)
              .map((tx: any) => {
              const isIncome = tx.type === 'income';
              const catColor = getCategoryColor(tx.category, isIncome);
              return (
                <TouchableOpacity
                  key={tx.id}
                  style={styles.activityRow}
                  onPress={() => navigation.navigate('EditTransaction', { transactionId: tx.id })}
                >
                  <View style={styles.row}>
                    <View style={[styles.activityIcon, { backgroundColor: `${catColor}15` }]}>
                      <Ionicons name={getCategoryIcon(tx.category)} size={16} color={catColor} />
                    </View>
                    <View style={styles.detailsContainer}>
                      <Text style={styles.activityTitle}>{tx.notes || tx.category}</Text>
                      <Text style={styles.activitySubtitle}>
                        {tx.category} • {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.amountRightContainer}>
                    <Text style={[styles.activityAmount, { color: catColor }]}>
                      {isIncome ? '+' : '-'}{formatCurrencyDetailed(tx.amount)}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.outline} style={{ marginLeft: 4 }} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Quick Tools — Two-column bento */}
        <View style={styles.toolsGrid}>
          <TouchableOpacity
            style={styles.toolBentoCard}
            onPress={() => setShowCardAssistant(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.toolIconWrap, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="sparkles" size={22} color={colors.primary} />
            </View>
            <Text style={styles.toolCardTitle}>Card Assistant</Text>
            <Text style={styles.toolCardDesc}>Best card for every spend{'\n'}T&C-based offline engine</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.outline} style={styles.toolCardArrow} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolBentoCard}
            onPress={() => setShowPayzappWallet(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.toolIconWrap, { backgroundColor: 'rgba(132, 204, 22, 0.12)' }]}>
              <Ionicons name="wallet" size={22} color="#84CC16" />
            </View>
            <Text style={styles.toolCardTitle}>Payzapp Wallet</Text>
            <Text style={styles.toolCardDesc}>Track ₹40K loads{'\n'}₹400 cashback via HDFC Millennia</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.outline} style={styles.toolCardArrow} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Card Assistant Modal */}
      <Modal visible={showCardAssistant} transparent animationType="slide" onRequestClose={() => setShowCardAssistant(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.modalAppBar}>
              <TouchableOpacity onPress={() => setShowCardAssistant(false)}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
              <Text style={styles.modalAppBarTitle}>Card Assistant</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <CardAssistant showFuelCalc />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payzapp Wallet Modal */}
      <Modal visible={showPayzappWallet} transparent animationType="slide" onRequestClose={() => setShowPayzappWallet(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.modalAppBar}>
              <TouchableOpacity onPress={() => setShowPayzappWallet(false)}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
              <Text style={styles.modalAppBarTitle}>Payzapp Wallet Loads</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <PayzappWalletScreen />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bill Payment Modal */}
      {editingCard && (
        <Modal visible={!!editingCard} transparent animationType="fade" onRequestClose={() => setEditingCard(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingCard.name}</Text>
              <Text style={styles.modalSub}>
                •••• {editingCard.endingWith}  ·  {editingCard.network}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>BILL AMOUNT (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  value={billAmountInput}
                  onChangeText={setBillAmountInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.outline}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PAID (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  value={paidAmountInput}
                  onChangeText={setPaidAmountInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.outline}
                />
              </View>

              <View style={styles.billLeftRow}>
                <Text style={styles.billLeftLabel}>BILL LEFT</Text>
                <Text style={[styles.billLeftValue, billLeft > 0 && styles.billLeftDue]}>
                  {formatCurrency(billLeft)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.markPaidBtn}
                onPress={handleMarkFullyPaid}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.markPaidBtnText}>Mark as Fully Paid</Text>
              </TouchableOpacity>

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
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.03)',
  },
  showMoreText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  notifBtn: {
    padding: 8,
    borderRadius: rounded.full,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  notificationWrapper: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: rounded.full,
    backgroundColor: colors.primaryContainer,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 120, // offset for navigation bar
  },
  netWorthContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  netWorthLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  netWorthValue: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -1,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.2)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: rounded.full,
    marginTop: 6,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    gap: 16,
  },
  bentoCardFullWidth: {
    minWidth: '95%',
  },
  bentoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  bentoLabel: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  bentoValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
  },
  bentoValueSecondary: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 1,
    fontWeight: '400',
  },
  fixedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: rounded.full,
    backgroundColor: `${colors.error}14`,
    borderWidth: 1,
    borderColor: `${colors.error}28`,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.error,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distributionCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 16,
  },
  distributionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 16,
  },
  donutContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 12,
    borderColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutOuterRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 12,
    transform: [{ rotate: '45deg' }],
  },
  donutInnerRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  donutSub: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  donutVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.onSurface,
  },
  legendContainer: {
    flex: 1,
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: rounded.full,
  },
  legendName: {
    fontSize: 13,
    color: colors.onSurface,
  },
  legendPercentage: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  cardsSection: {
    gap: 12,
  },
  cardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardsScroll: {
    gap: 16,
    paddingRight: spacing.containerPadding,
  },
  premiumCard: {
    width: 280,
    height: 160,
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  cardDecor: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(124, 58, 237, 0.05)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardBank: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  cardNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: 2,
    marginTop: 4,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardBalanceLabel: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginBottom: 2,
  },
  cardBalanceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
  },
  cardDueDate: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.error,
  },
  recentActivitySection: {
    gap: 12,
  },
  activityList: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: rounded.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  activitySubtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  detailsContainer: {
    gap: 2,
  },
  amountRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 96, // moved higher up to avoid bottom navigation block
    right: 24,
    width: 56,
    height: 56,
    borderRadius: rounded.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: `${colors.primary}18`,
    borderRadius: rounded.full,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  // Modal styles
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
  // Calendar styles integrated into styles
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  calCard: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calMonthText: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  calWeekdays: { flexDirection: 'row', justifyContent: 'space-around' },
  calWeekdayText: { width: 36, textAlign: 'center', fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '600' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  calDayCell: { width: 36, height: 36, borderRadius: rounded.full, alignItems: 'center', justifyContent: 'center' },
  calDaySelected: { backgroundColor: colors.primary },
  calDayText: { fontSize: 13, color: colors.onSurface, fontWeight: '500' },
  calDayTextSelected: { color: '#fff', fontWeight: '700' },
  calCloseBtn: { alignItems: 'center', paddingVertical: 10 },
  calCloseBtnText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
  billLeftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  billLeftLabel: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  billLeftValue: { fontSize: 20, fontWeight: '800', color: colors.success },
  billLeftDue: { color: colors.error },
  markPaidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    backgroundColor: `${colors.success}25`,
    borderWidth: 1,
    borderColor: `${colors.success}40`,
  },
  markPaidBtnText: { fontSize: 14, fontWeight: '700', color: colors.success },
  // Tools bento grid
  toolsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  toolBentoCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    gap: 10,
    position: 'relative',
  },
  toolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  toolCardDesc: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },
  toolCardArrow: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  // Full-screen modal
  fullModalContent: {
    flex: 1,
    backgroundColor: colors.background,
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 48,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalAppBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.containerPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalAppBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  modalScrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 40,
  },
});
