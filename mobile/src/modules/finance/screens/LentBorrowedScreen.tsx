/**
 * LentBorrowedScreen — tracks money lent and borrowed (receivables, expected
 * income) with add/edit and mark-as-paid actions.
 */
import React, { useState, useMemo } from 'react';
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
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore, Receivable, ExpectedIncome } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import CalendarPicker from '../../../shared/components/CalendarPicker';

export default function LentBorrowedScreen() {
  const navigation = useNavigation();
  const { receivables, addReceivable, editReceivable, markReceivablePayment, deleteReceivable, expectedIncomes, addExpectedIncome, editExpectedIncome, deleteExpectedIncome } = useFinanceStore();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'lent' | 'borrowed'>('lent');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Receivable | null>(null);

  // Form fields
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [entryType, setEntryType] = useState<'lent' | 'borrowed'>('lent');
  
  // Date Picker States
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Payment Modal
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentItem, setPaymentItem] = useState<Receivable | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [incomeEditItem, setIncomeEditItem] = useState<ExpectedIncome | null>(null);
  const [incomeName, setIncomeName] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeNotes, setIncomeNotes] = useState('');
  const [incomeDate, setIncomeDate] = useState(new Date());
  const [incomeDatePickerVisible, setIncomeDatePickerVisible] = useState(false);

  const filteredItems = receivables.filter((r) => r.type === activeTab);
  const totalLent = receivables
    .filter((r) => r.type === 'lent')
    .reduce((sum, r) => sum + (r.amount - (r.paidAmount || 0)), 0);
  const totalBorrowed = receivables
    .filter((r) => r.type === 'borrowed')
    .reduce((sum, r) => sum + (r.amount - (r.paidAmount || 0)), 0);

  const groupedItems = useMemo(() => {
    const groups: Record<string, { personName: string; type: string; total: number; latestDue: Date; items: typeof filteredItems }> = {};
    for (const item of filteredItems) {
      const key = `${item.personName}__${item.type}`;
      if (!groups[key]) {
        groups[key] = { personName: item.personName, type: item.type, total: 0, latestDue: new Date(item.dueDate), items: [] };
      }
      groups[key].total += (item.amount - (item.paidAmount || 0));
      const d = new Date(item.dueDate);
      if (d < groups[key].latestDue) groups[key].latestDue = d;
      groups[key].items.push(item);
    }
    return Object.values(groups).sort((a, b) => a.latestDue.getTime() - b.latestDue.getTime());
  }, [filteredItems]);

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })}`;
  };

  const remainingFor = (items: Receivable[]) =>
    items.reduce((sum, item) => sum + ((item.amount || 0) - (item.paidAmount || 0)), 0);

  const outstandingOf = (item: Receivable) => item.amount - (item.paidAmount || 0);

  const applyQuickMath = (mode: 'plus' | 'minus' | 'minus5') => {
    if (!selectedItem) return;
    const typed = parseFloat(quickAmount);
    if (isNaN(typed) || typed <= 0) {
      Alert.alert('Enter the new amount first');
      return;
    }
    const typedPaise = Math.round(typed * 100);
    const current = parseFloat(amount || '0');
    const base = isNaN(current) ? 0 : Math.round(current * 100);
    let result: number;
    if (mode === 'plus') result = base + typedPaise;
    else if (mode === 'minus') result = Math.max(0, base - typedPaise);
    else result = Math.round(base * 0.95);
    setAmount((result / 100).toString());
  };

  const copyGroupDetails = async (group: { personName: string; items: Receivable[] }) => {
    const sorted = [...group.items].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const lines = sorted.map((item) => {
      const d = new Date(item.dueDate);
      const month = d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
      const day = d.getDate();
      const suffix = day % 10 === 1 && day !== 11 ? 'ST' : day % 10 === 2 && day !== 12 ? 'ND' : day % 10 === 3 && day !== 13 ? 'RD' : 'TH';
      const outstanding = (item.amount || 0) - (item.paidAmount || 0);
      const amountLabel = Math.round(outstanding / 100).toLocaleString('en-IN');
      const noteLabel = item.note && item.note.trim() ? item.note.trim() : 'CARD';
      return `${noteLabel} -> ${amountLabel} ${month} ${day}${suffix}`;
    });
    const total = remainingFor(sorted);
    const text = `${lines.join('\n')}\n\nTOTAL ${Math.round(total / 100).toLocaleString('en-IN')}`;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `Lent details for ${group.personName} copied to clipboard.`);
  };

  const openAddModal = () => {
    setSelectedItem(null);
    setPersonName('');
    setAmount('');
    setNotes('');
    setSelectedDate(new Date());
    setEntryType(activeTab);
    setModalVisible(true);
  };

  const openEditModal = (item: Receivable) => {
    setSelectedItem(item);
    setPersonName(item.personName);
    setAmount((item.amount / 100).toString());
    setQuickAmount('');
    setNotes(item.note || '');
    setEntryType(item.type);
    
    const parsedDate = new Date(item.dueDate);
    setSelectedDate(parsedDate);
    
    setModalVisible(true);
  };

  const handleSave = () => {
    const rawAmount = parseFloat(amount);
    if (!personName.trim()) {
      alert('Please enter a person name');
      return;
    }
    if (isNaN(rawAmount) || rawAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!notes.trim()) {
      alert('Please enter an expense name (e.g. CARD)');
      return;
    }

    const paiseAmount = Math.round(rawAmount * 100);

    if (selectedItem) {
      editReceivable(selectedItem.id, {
        personName: personName.trim(),
        amount: paiseAmount,
        note: notes.trim(),
        dueDate: selectedDate.toISOString(),
        type: entryType,
      }, user?.id);
    } else {
      addReceivable({
        personName: personName.trim(),
        amount: paiseAmount,
        paidAmount: 0,
        note: notes.trim(),
        dueDate: selectedDate.toISOString(),
        type: entryType,
      }, user?.id);
    }

    setModalVisible(false);
  };

  const handleDelete = () => {
    if (selectedItem) {
      deleteReceivable(selectedItem.id, user?.id);
      setModalVisible(false);
    }
  };

  const handleMarkPayment = () => {
    if (!paymentItem) return;
    const rawAmount = parseFloat(paymentAmount);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }
    const paiseAmount = Math.round(rawAmount * 100);
    markReceivablePayment(paymentItem.id, paiseAmount, user?.id);
    setPaymentModalVisible(false);
  };

  const openPaymentModal = (item: Receivable) => {
    setPaymentItem(item);
    setPaymentAmount('');
    setPaymentModalVisible(true);
  };

  const expectedTotal = expectedIncomes.reduce((sum, ei) => sum + ei.amount, 0);

  const openAddIncome = () => {
    setIncomeEditItem(null);
    setIncomeName('');
    setIncomeAmount('');
    setIncomeNotes('');
    setIncomeDate(new Date());
    setIncomeModalVisible(true);
  };

  const openEditIncome = (item: ExpectedIncome) => {
    setIncomeEditItem(item);
    setIncomeName(item.name);
    setIncomeAmount((item.amount / 100).toString());
    setIncomeNotes(item.notes || '');
    setIncomeDate(new Date(item.date));
    setIncomeModalVisible(true);
  };

  const handleIncomeSave = () => {
    const rawAmount = parseFloat(incomeAmount);
    if (!incomeName.trim()) { alert('Enter a name'); return; }
    if (isNaN(rawAmount) || rawAmount <= 0) { alert('Enter valid amount'); return; }
    const paiseAmount = Math.round(rawAmount * 100);

    if (incomeEditItem) {
      editExpectedIncome(incomeEditItem.id, {
        name: incomeName.trim(),
        amount: paiseAmount,
        notes: incomeNotes.trim(),
        date: incomeDate.toISOString(),
      }, user?.id);
    } else {
      addExpectedIncome({
        name: incomeName.trim(),
        amount: paiseAmount,
        notes: incomeNotes.trim(),
        date: incomeDate.toISOString(),
      }, user?.id);
    }
    setIncomeModalVisible(false);
  };

  const handleIncomeDelete = () => {
    if (incomeEditItem) {
      deleteExpectedIncome(incomeEditItem.id, user?.id);
      setIncomeModalVisible(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Lent & Borrow</Text>
        <TouchableOpacity style={styles.iconButton} onPress={openAddModal}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'lent' && styles.tabButtonActive]}
          onPress={() => setActiveTab('lent')}
        >
          <Text style={[styles.tabText, activeTab === 'lent' && styles.tabTextActive]}>
            Lent ({formatCurrency(totalLent)})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'borrowed' && styles.tabButtonActive]}
          onPress={() => setActiveTab('borrowed')}
        >
          <Text style={[styles.tabText, activeTab === 'borrowed' && styles.tabTextActive]}>
            Borrowed ({formatCurrency(totalBorrowed)})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Ledger List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {activeTab === 'lent' ? 'MONEY TO RECEIVE' : 'MONEY TO PAY'} (TAP TO EDIT)
          </Text>
          <View style={styles.listContainer}>
            {filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={36} color={colors.outline} />
                <Text style={styles.emptyText}>No records logged</Text>
              </View>
            ) : (
              groupedItems.map((group) => {
                const groupKey = `${group.personName}__${group.type}`;
                const isExpanded = expandedGroup === groupKey;
                const pendingCount = group.items.filter(i => i.status !== 'paid').length;
                return (
                  <View key={groupKey}>
                    <TouchableOpacity
                      style={styles.rowItem}
                      onPress={() => setExpandedGroup(isExpanded ? null : groupKey)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.itemLeft}>
                        <View
                          style={[
                            styles.iconWrapper,
                            { backgroundColor: group.type === 'lent' ? `${colors.success}15` : `${colors.error}15` },
                          ]}
                        >
                          <Ionicons
                            name={group.type === 'lent' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                            size={20}
                            color={group.type === 'lent' ? colors.success : colors.error}
                          />
                        </View>
                        <View>
                          <Text style={styles.itemTitle}>{group.personName}</Text>
                          <Text style={styles.itemSubtitle}>
                            {group.items.length} txns · Due {group.latestDue.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.itemAmount, { color: group.type === 'lent' ? colors.success : colors.error }]}>
                          {group.type === 'lent' ? '+' : '-'}{formatCurrency(group.total)}
                        </Text>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            copyGroupDetails({ personName: group.personName, items: group.items });
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="copy-outline" size={14} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.expandedSection}>
                        {group.items.map((item) => {
                          const remaining = item.amount - (item.paidAmount || 0);
                          const isFullyPaid = item.status === 'paid';
                          return (
                            <TouchableOpacity
                              key={item.id}
                              style={[styles.subItem, isFullyPaid && { opacity: 0.5 }]}
                              onPress={() => openEditModal(item)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.subItemLeft}>
                                <Text style={styles.subItemAmount}>
                                  {item.type === 'lent' ? '+' : '-'}{formatCurrency(item.amount)}
                                </Text>
                                {(item.paidAmount || 0) > 0 && (
                                  <Text style={styles.subItemRemaining}>
                                    Rem: {formatCurrency(remaining)}
                                  </Text>
                                )}
                                <Text style={styles.subItemDate}>
                                  {new Date(item.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </Text>
                              </View>
                              <View style={styles.subItemRight}>
                                {item.note ? <Text style={styles.subItemNote} numberOfLines={1}>{item.note}</Text> : null}
                                {item.status === 'paid' ? (
                                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                                ) : item.status === 'partial' ? (
                                  <Ionicons name="time-outline" size={14} color={colors.warning} />
                                ) : null}
                                {!isFullyPaid && (
                                  <TouchableOpacity
                                    style={styles.payBtn}
                                    onPress={(e) => { e.stopPropagation(); openPaymentModal(item); }}
                                  >
                                    <Ionicons name="arrow-down-circle-outline" size={12} color={colors.success} />
                                    <Text style={styles.payBtnText}>Receive</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                        <TouchableOpacity
                          style={styles.addSubBtn}
                          onPress={() => {
                            openAddModal();
                            setPersonName(group.personName);
                            setEntryType(group.type as 'lent' | 'borrowed');
                            setExpandedGroup(null);
                          }}
                        >
                          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                          <Text style={styles.addSubBtnText}>Add transaction</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Optional Income Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>OPTIONAL INCOME ({formatCurrency(expectedTotal)})</Text>
            <TouchableOpacity onPress={openAddIncome}>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.listContainer}>
            {expectedIncomes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cash-outline" size={36} color={colors.outline} />
                <Text style={styles.emptyText}>No expected income entries</Text>
                <Text style={[styles.emptyText, { fontSize: 10, color: colors.outline }]}>
                  Add uncertain cashbacks, refunds, etc.
                </Text>
              </View>
            ) : (
              expectedIncomes.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.rowItem}
                  onPress={() => openEditIncome(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <View style={[styles.iconWrapper, { backgroundColor: 'rgba(188,232,93,0.12)' }]}>
                      <Ionicons name="cash-outline" size={20} color={colors.chartreuse} />
                    </View>
                    <View>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.itemSubtitle}>
                        {item.notes || new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.itemAmount, { color: colors.chartreuse }]}>
                    +{formatCurrency(item.amount)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add / Edit Entry Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedItem ? 'Edit Entry' : 'Add Lent & Borrow'}
            </Text>

            {/* Lent vs Borrow toggle inside Modal */}
            <View style={styles.modalToggleRow}>
              <TouchableOpacity
                style={[styles.modalToggleBtn, entryType === 'lent' && styles.modalToggleBtnLent]}
                onPress={() => setEntryType('lent')}
              >
                <Text style={[styles.modalToggleText, entryType === 'lent' && styles.modalToggleTextActive]}>Lent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalToggleBtn, entryType === 'borrowed' && styles.modalToggleBtnBorrowed]}
                onPress={() => setEntryType('borrowed')}
              >
                <Text style={[styles.modalToggleText, entryType === 'borrowed' && styles.modalToggleTextActive]}>Borrowed</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PERSON NAME</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter name"
                placeholderTextColor={colors.outline}
                value={personName}
                onChangeText={setPersonName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="0.00"
                placeholderTextColor={colors.outline}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            {selectedItem && (
              <View style={styles.quickMathGroup}>
                <Text style={styles.paymentInfo}>
                  Existing outstanding: {formatCurrency(outstandingOf(selectedItem))}
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NEW AMOUNT (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.outline}
                    keyboardType="numeric"
                    value={quickAmount}
                    onChangeText={setQuickAmount}
                  />
                </View>
                <View style={styles.quickMathRow}>
                  <TouchableOpacity
                    style={[styles.quickMathBtn, { borderColor: colors.success }]}
                    onPress={() => applyQuickMath('plus')}
                  >
                    <Text style={[styles.quickMathBtnText, { color: colors.success }]}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickMathBtn, { borderColor: colors.error }]}
                    onPress={() => applyQuickMath('minus')}
                  >
                    <Text style={[styles.quickMathBtnText, { color: colors.error }]}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickMathBtn, { borderColor: colors.warning }]}
                    onPress={() => applyQuickMath('minus5')}
                  >
                    <Text style={[styles.quickMathBtnText, { color: colors.warning }]}>−5%</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Date Picker trigger */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DUE DATE</Text>
              <TouchableOpacity
                style={styles.datePickerTrigger}
                onPress={() => setDatePickerVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.datePickerText}>
                  {selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOTES / EXTRA INFORMATION</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Optional notes"
                placeholderTextColor={colors.outline}
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <View style={styles.modalButtons}>
              {selectedItem && (
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnDelete]}
                  onPress={handleDelete}
                >
                  <Text style={styles.modalBtnTextDelete}>Delete</Text>
                </TouchableOpacity>
              )}
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

      {/* Date Picker Custom Modal */}
      <CalendarPicker
        visible={datePickerVisible}
        selected={selectedDate}
        onSelect={(d) => { setSelectedDate(d); setDatePickerVisible(false); }}
        onClose={() => setDatePickerVisible(false)}
      />

      {/* Expected Income Modal */}
      <Modal visible={incomeModalVisible} transparent animationType="fade" onRequestClose={() => setIncomeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{incomeEditItem ? 'Edit Expected Income' : 'Add Expected Income'}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NAME</Text>
              <TextInput style={styles.textInput} placeholder="Cashback, refund, etc." placeholderTextColor={colors.outline} value={incomeName} onChangeText={setIncomeName} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
              <TextInput style={styles.textInput} placeholder="0.00" placeholderTextColor={colors.outline} keyboardType="numeric" value={incomeAmount} onChangeText={setIncomeAmount} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EXPECTED DATE</Text>
              <TouchableOpacity style={styles.datePickerTrigger} onPress={() => setIncomeDatePickerVisible(true)} activeOpacity={0.8}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.datePickerText}>
                  {incomeDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
              <TextInput style={styles.textInput} placeholder="Optional notes" placeholderTextColor={colors.outline} value={incomeNotes} onChangeText={setIncomeNotes} />
            </View>

            <View style={styles.modalButtons}>
              {incomeEditItem && (
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnDelete]} onPress={handleIncomeDelete}>
                  <Text style={styles.modalBtnTextDelete}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setIncomeModalVisible(false)}>
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleIncomeSave}>
                <Text style={styles.modalBtnTextSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CalendarPicker
        visible={incomeDatePickerVisible}
        selected={incomeDate}
        onSelect={(d) => { setIncomeDate(d); setIncomeDatePickerVisible(false); }}
        onClose={() => setIncomeDatePickerVisible(false)}
      />

      {/* Mark Payment Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="fade" onRequestClose={() => setPaymentModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mark Payment</Text>
            {paymentItem && (
              <>
                <Text style={styles.paymentInfo}>
                  {paymentItem.personName} · Total: {formatCurrency(paymentItem.amount)}
                </Text>
                {(paymentItem.paidAmount || 0) > 0 && (
                  <Text style={styles.paymentInfo}>
                    Already paid: {formatCurrency(paymentItem.paidAmount || 0)} · Remaining: {formatCurrency(paymentItem.amount - (paymentItem.paidAmount || 0))}
                  </Text>
                )}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PAYMENT RECEIVED (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.outline}
                    keyboardType="numeric"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    autoFocus
                  />
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setPaymentModalVisible(false)}>
                    <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleMarkPayment}>
                    <Text style={styles.modalBtnTextSave}>Mark Paid</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    marginHorizontal: spacing.containerPadding,
    marginTop: 16,
    borderRadius: rounded.lg,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: rounded.DEFAULT,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapLg,
    paddingBottom: 40,
  },
  section: {
    gap: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listContainer: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  itemSubtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
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
  modalToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    padding: 4,
  },
  modalToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: rounded.DEFAULT,
  },
  modalToggleBtnLent: {
    backgroundColor: colors.successContainer,
  },
  modalToggleBtnBorrowed: {
    backgroundColor: colors.errorContainer,
  },
  modalToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  modalToggleTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: '500',
  },
  adjBtn: {
    minWidth: 24,
    height: 24,
    borderRadius: rounded.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  adjBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickMathGroup: {
    gap: 8,
    padding: 12,
    borderRadius: rounded.DEFAULT,
    backgroundColor: colors.surfaceContainer,
  },
  quickMathRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickMathBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickMathBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    paddingHorizontal: 12,
    gap: 10,
  },
  datePickerText: {
    fontSize: 14,
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
  modalBtnDelete: {
    backgroundColor: colors.attentionDim,
  },
  modalBtnCancel: {
    backgroundColor: 'transparent',
  },
  modalBtnSave: {
    backgroundColor: colors.primaryContainer,
  },
  modalBtnTextDelete: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
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
  expandedSection: {
    backgroundColor: colors.surfaceContainer,
    borderBottomLeftRadius: rounded.DEFAULT,
    borderBottomRightRadius: rounded.DEFAULT,
    borderTopWidth: 0,
    paddingHorizontal: 12,
    paddingBottom: 8,
    marginTop: -4,
    marginBottom: 8,
  },
  subItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subItemAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  subItemDate: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  subItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  subItemNote: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    maxWidth: 120,
  },
  addSubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  addSubBtnText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  subItemRemaining: {
    fontSize: 10,
    color: colors.warning,
    fontWeight: '600',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.success}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: rounded.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.success,
  },
  payBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
  },
  paymentInfo: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    fontWeight: '500',
  },
});
