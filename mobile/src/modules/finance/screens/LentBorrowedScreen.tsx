/**
 * LentBorrowedScreen — money lent and borrowed (receivables, expected
 * income) with add/edit and mark-as-paid actions.
 *
 * Restyled to the Meridian v2 reference: a lent/borrowed segmented control,
 * a "money to receive" card with a per-person share bar, person rows and
 * the optional-income panel. Every action (add, edit, receive, group
 * receive, receive log, share, delete) still works.
 */
import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Share,
  TouchableOpacity,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  EmptyState,
  Fab,
  Label,
  PressScale,
  Rise,
  Screen,
  SegmentedControl,
  StackedShareBar,
} from '../../../shared/components/meridian';
import { useFinanceStore, Receivable, ExpectedIncome, ReceiveLogEntry } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import CalendarPicker from '../../../shared/components/CalendarPicker';
export default function LentBorrowedScreen() {
  const navigation = useNavigation();
  const { receivables, addReceivable, editReceivable, markReceivablePayment, deleteReceivable, expectedIncomes, addExpectedIncome, editExpectedIncome, deleteExpectedIncome, receiveLog, addReceiveLog } = useFinanceStore();
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
  // Group Receive flow — applies an amount across a person's outstanding
  // entries oldest-first (full entries removed, partial one reduced), plus a
  // receive log hidden behind a "Log" option.
  const [receiveGroup, setReceiveGroup] = useState<{ personName: string; type: 'lent' | 'borrowed'; items: Receivable[] } | null>(null);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveLogVisible, setReceiveLogVisible] = useState(false);
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

  const applyQuickMath = (mode: 'plus' | 'minus' | 'minus5', target: 'amount' | 'quick' = 'quick') => {
    if (selectedItem) {
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
      else result = base + Math.round(typedPaise * 0.95);
      setAmount((result / 100).toString());
      setQuickAmount('');
      return;
    }

    const current = parseFloat(amount || '0');
    const base = isNaN(current) ? 0 : Math.round(current * 100);

    if (target === 'amount') {
      if (mode === 'minus5') {
        if (base <= 0) {
          Alert.alert('Enter the initial amount first');
          return;
        }
        setAmount((Math.round(base * 0.95) / 100).toString());
        return;
      }
      const typed = parseFloat(quickAmount);
      if (isNaN(typed) || typed <= 0) {
        Alert.alert('Enter the quick amount first');
        return;
      }
      const typedPaise = Math.round(typed * 100);
      const result = mode === 'plus' ? base + typedPaise : Math.max(0, base - typedPaise);
      setAmount((result / 100).toString());
      setQuickAmount('');
      return;
    }

    const typed = parseFloat(quickAmount);
    if (isNaN(typed) || typed <= 0) {
      Alert.alert('Enter the quick amount first');
      return;
    }
    const typedPaise = Math.round(typed * 100);
    let result: number;
    if (mode === 'plus') result = base + typedPaise;
    else if (mode === 'minus') result = Math.max(0, base - typedPaise);
    else result = base + Math.round(typedPaise * 0.95);
    setAmount((result / 100).toString());
    setQuickAmount('');
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
    // Native share sheet (WhatsApp, Instagram, Telegram, ...) with a
    // clipboard fallback only when sharing genuinely fails — dismissing
    // the sheet must NOT copy.
    try {
      await Share.share({ message: text, title: `Lent details — ${group.personName}` });
    } catch (e: any) {
      if (e?.code === 'cancel' || String(e?.message || '').toLowerCase().includes('cancel')) return;
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', `Lent details for ${group.personName} copied to clipboard.`);
    }
  };

  const openAddModal = () => {
    setSelectedItem(null);
    setPersonName('');
    setAmount('');
    setQuickAmount('');
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

  const openReceiveGroupModal = (group: { personName: string; type: 'lent' | 'borrowed'; items: Receivable[] }) => {
    setReceiveGroup(group);
    setReceiveAmount('');
  };

  const handleGroupReceive = () => {
    if (!receiveGroup) return;
    const raw = parseFloat(receiveAmount);
    if (isNaN(raw) || raw <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    const requested = Math.round(raw * 100);
    let pool = requested;
    const outstanding = receiveGroup.items
      .filter((item) => item.amount - (item.paidAmount || 0) > 0)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const breakdown: ReceiveLogEntry['breakdown'] = [];
    for (const item of outstanding) {
      if (pool <= 0) break;
      const remaining = item.amount - (item.paidAmount || 0);
      const applied = Math.min(pool, remaining);
      if (applied >= remaining) {
        // Fully covered — the entry is removed entirely.
        deleteReceivable(item.id, user?.id);
      } else {
        // Partially covered — reduce it by what was applied.
        markReceivablePayment(item.id, applied, user?.id);
      }
      breakdown.push({
        label: item.note?.trim() || 'Entry',
        date: item.dueDate,
        applied,
      });
      pool -= applied;
    }
    addReceiveLog({
      personName: receiveGroup.personName,
      type: receiveGroup.type,
      amount: requested,
      unapplied: pool,
      breakdown,
    });
    setReceiveAmount('');
    setReceiveGroup(null);
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
    <Screen bottomInset={40}>
      {/* Header */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale onPress={() => navigation.goBack()} scale={0.9} style={styles.iconButton} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <Text style={styles.logoText}>Lent and borrow</Text>
          <Fab onPress={openAddModal} icon="add" size={38} accessibilityLabel="Add entry" />
        </View>
      </Rise>

      {/* Lent / Borrowed */}
      <Rise index={1}>
        <SegmentedControl
          options={[
            { key: 'lent', label: `Lent ${formatCurrency(totalLent)}` },
            { key: 'borrowed', label: `Borrowed ${formatCurrency(totalBorrowed)}` },
          ]}
          value={activeTab}
          onChange={(k) => setActiveTab(k as 'lent' | 'borrowed')}
        />
      </Rise>

      {/* Money to receive / pay */}
      <Rise index={2}>
        <Card>
          <Label>{activeTab === 'lent' ? 'MONEY TO RECEIVE' : 'MONEY TO PAY'}</Label>
          <Text style={[styles.moneyValue, { color: activeTab === 'lent' ? mc.mint : mc.redSoft }]}>
            {activeTab === 'lent' ? '+' : '-'}
            {formatCurrency(activeTab === 'lent' ? totalLent : totalBorrowed)}
          </Text>
          {(activeTab === 'lent' ? totalLent : totalBorrowed) > 0 ? (
            <>
              <StackedShareBar
                segments={groupedItems.map((g, i) => ({
                  key: `${g.personName}-${i}`,
                  value: g.total,
                  color: [mc.red, mc.amber, mc.sky, mc.violet, mc.mint][i % 5],
                  minWidth: 6,
                }))}
                height={12}
                style={styles.shareBar}
              />
              <View style={styles.legendRow}>
                {groupedItems.slice(0, 4).map((g, i) => (
                  <View key={`${g.personName}-${i}`} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: [mc.red, mc.amber, mc.sky, mc.violet, mc.mint][i % 5] },
                      ]}
                    />
                    <Text style={styles.legendLabel} numberOfLines={1}>
                      {g.personName}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.sectionSub}>
              {activeTab === 'lent'
                ? 'Nothing outstanding right now.'
                : 'You do not owe anyone anything right now.'}
            </Text>
          )}
        </Card>
      </Rise>

      {/* Ledger */}
      <Rise index={3}>
        <View style={styles.listCard}>
          {groupedItems.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No records logged"
              subtitle={activeTab === 'lent' ? 'Money you lend shows up here.' : 'Money you borrow shows up here.'}
            />
          ) : (
            groupedItems.map((group, idx) => {
              const groupKey = `${group.personName}__${group.type}`;
              const isExpanded = expandedGroup === groupKey;
              const pendingCount = group.items.filter((i) => i.status !== 'paid').length;
              const dueDays =
                (new Date(group.latestDue).getTime() - Date.now()) / 86400000;
              const dueColor = dueDays <= 3 ? mc.redSoft : dueDays <= 7 ? mc.amber : mc.textDim;
              const initial = (group.personName || '?').trim().charAt(0).toUpperCase();
              return (
                <View key={groupKey} style={[idx > 0 && styles.rowDivider]}>
                  <PressScale
                    onPress={() => setExpandedGroup(isExpanded ? null : groupKey)}
                    scale={0.99}
                    style={styles.rowItem}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: group.type === 'lent' ? mc.redDim : mc.skyDim },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          { color: group.type === 'lent' ? mc.redSoft : mc.sky },
                        ]}
                      >
                        {initial}
                      </Text>
                    </View>
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {group.personName}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.itemSubtitle}>
                          {group.items.length} txns · {pendingCount} pending
                        </Text>
                        <View style={styles.dueChip}>
                          <Text style={[styles.dueChipText, { color: dueColor }]}>
                            Due{' '}
                            {group.latestDue.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.itemRightCol}>
                      <Text
                        style={[
                          styles.itemAmount,
                          { color: group.type === 'lent' ? mc.mint : mc.redSoft },
                        ]}
                      >
                        {group.type === 'lent' ? '+' : '-'}
                        {formatCurrency(group.total)}
                      </Text>
                      <PressScale
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          copyGroupDetails({ personName: group.personName, items: group.items });
                        }}
                        scale={0.9}
                        accessibilityLabel="Share the list"
                        style={styles.copyBtn}
                      >
                        <Ionicons name="share-social-outline" size={14} color={mc.textDim} />
                      </PressScale>
                    </View>
                  </PressScale>

                  {isExpanded ? (
                    <View style={styles.expandedSection}>
                      <View style={styles.groupActions}>
                        <PressScale
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            openReceiveGroupModal({
                              personName: group.personName,
                              type: group.type as 'lent' | 'borrowed',
                              items: group.items,
                            });
                          }}
                          scale={0.95}
                          style={styles.receiveAllBtn}
                        >
                          <Ionicons
                            name={group.type === 'lent' ? 'download-outline' : 'cash-outline'}
                            size={12}
                            color={mc.white}
                          />
                          <Text style={styles.receiveAllText}>
                            {group.type === 'lent' ? 'Receive' : 'Pay back'}
                          </Text>
                        </PressScale>
                        <PressScale
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            setReceiveLogVisible(true);
                          }}
                          scale={0.95}
                          style={styles.logBtn}
                        >
                          <Ionicons name="receipt-outline" size={12} color={mc.textDim} />
                          <Text style={styles.logBtnText}>Log</Text>
                        </PressScale>
                      </View>
                      {group.items.map((item) => {
                        const remaining = item.amount - (item.paidAmount || 0);
                        const isFullyPaid = item.status === 'paid';
                        return (
                          <PressScale
                            key={item.id}
                            onPress={() => openEditModal(item)}
                            scale={0.99}
                            style={[styles.subItem, isFullyPaid && { opacity: 0.5 }]}
                          >
                            <View style={styles.subItemLeft}>
                              <Text style={styles.subItemAmount}>
                                {item.type === 'lent' ? '+' : '-'}
                                {formatCurrency(item.amount)}
                              </Text>
                              {(item.paidAmount || 0) > 0 ? (
                                <Text style={styles.subItemRemaining}>
                                  Rem: {formatCurrency(remaining)}
                                </Text>
                              ) : null}
                              <Text style={styles.subItemDate}>
                                {new Date(item.dueDate).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </Text>
                            </View>
                            <View style={styles.subItemRight}>
                              {item.note ? (
                                <Text style={styles.subItemNote} numberOfLines={1}>
                                  {item.note}
                                </Text>
                              ) : null}
                              {item.status === 'paid' ? (
                                <Ionicons name="checkmark-circle" size={14} color={mc.mint} />
                              ) : item.status === 'partial' ? (
                                <Ionicons name="time-outline" size={14} color={mc.amber} />
                              ) : null}
                              {!isFullyPaid ? (
                                <PressScale
                                  onPress={(e: any) => {
                                    e?.stopPropagation?.();
                                    openPaymentModal(item);
                                  }}
                                  scale={0.95}
                                  style={styles.payBtn}
                                >
                                  <Ionicons
                                    name="arrow-down-circle-outline"
                                    size={12}
                                    color={mc.mint}
                                  />
                                  <Text style={styles.payBtnText}>Receive</Text>
                                </PressScale>
                              ) : null}
                            </View>
                          </PressScale>
                        );
                      })}
                      <PressScale
                        onPress={() => {
                          openAddModal();
                          setPersonName(group.personName);
                          setEntryType(group.type as 'lent' | 'borrowed');
                          setExpandedGroup(null);
                        }}
                        scale={0.97}
                        style={styles.addSubBtn}
                      >
                        <Ionicons name="add-circle-outline" size={15} color={mc.textDim} />
                        <Text style={styles.addSubBtnText}>Add transaction</Text>
                      </PressScale>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </Rise>

      {/* Optional income */}
      <Rise index={4}>
        <View style={styles.sectionHeader}>
          <Label>OPTIONAL INCOME ({formatCurrency(expectedTotal)})</Label>
          <PressScale onPress={openAddIncome} scale={0.9} accessibilityLabel="Add optional income">
            <Ionicons name="add" size={20} color={mc.redSoft} />
          </PressScale>
        </View>
        {expectedIncomes.length === 0 ? (
          <Card>
            <EmptyState
              icon="cash-outline"
              title="No optional income yet"
              subtitle="Add cashbacks and refunds you expect"
            />
          </Card>
        ) : (
          <View style={styles.listCard}>
            {expectedIncomes.map((item, idx) => (
              <PressScale
                key={item.id}
                onPress={() => openEditIncome(item)}
                scale={0.99}
                style={[styles.rowItem, idx > 0 && styles.rowDivider]}
              >
                <View style={[styles.avatar, { backgroundColor: mc.mintDim }]}>
                  <Ionicons name="cash-outline" size={17} color={mc.mint} />
                </View>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {item.notes ||
                      new Date(item.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                  </Text>
                </View>
                <Text style={[styles.itemAmount, { color: mc.mint }]}>+{formatCurrency(item.amount)}</Text>
              </PressScale>
            ))}
          </View>
        )}
      </Rise>

      {/* Add / Edit Entry Modal (unchanged design, restyled) */}
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
              {selectedItem ? 'Edit entry' : 'Add lent or borrowed'}
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
              <Text style={styles.inputLabel}>PERSON</Text>
              <View style={styles.personInputWrap}>
                <Ionicons name="person-outline" size={17} color={mc.textDim} />
                <TextInput
                  style={styles.textInputInner}
                  placeholder="Enter name"
                  placeholderTextColor={mc.textGhost}
                  value={personName}
                  onChangeText={setPersonName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
              <TextInput
                style={[styles.textInput, styles.amountInput]}
                placeholder="0.00"
                placeholderTextColor={mc.textGhost}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            {!selectedItem && (
              <>
                <View style={styles.quickMathRow}>
                  <TouchableOpacity
                    style={[styles.quickMathBtn, { borderColor: mc.mint }]}
                    onPress={() => applyQuickMath('plus', 'amount')}
                  >
                    <Text style={[styles.quickMathBtnText, { color: mc.mint }]}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickMathBtn, { borderColor: mc.redSoft }]}
                    onPress={() => applyQuickMath('minus', 'amount')}
                  >
                    <Text style={[styles.quickMathBtnText, { color: mc.redSoft }]}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickMathBtn, { borderColor: mc.amber }]}
                    onPress={() => applyQuickMath('minus5', 'amount')}
                  >
                    <Text style={[styles.quickMathBtnText, { color: mc.amber }]}>−5%</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>QUICK AMOUNT (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={mc.textFaint}
                    keyboardType="numeric"
                    value={quickAmount}
                    onChangeText={setQuickAmount}
                  />
                </View>

                <View style={styles.quickMathRow}>
                  <TouchableOpacity
                    style={[styles.quickMathBtn, { borderColor: mc.mint }]}
                    onPress={() => applyQuickMath('plus', 'quick')}
                  >
                    <Text style={[styles.quickMathBtnText, { color: mc.mint }]}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickMathBtn, { borderColor: mc.redSoft }]}
                    onPress={() => applyQuickMath('minus', 'quick')}
                  >
                    <Text style={[styles.quickMathBtnText, { color: mc.redSoft }]}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickMathBtn, { borderColor: mc.amber }]}
                    onPress={() => applyQuickMath('minus5', 'quick')}
                  >
                    <Text style={[styles.quickMathBtnText, { color: mc.amber }]}>−5%</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {selectedItem && (
              <View style={styles.quickMathGroup}>
                <Text style={styles.paymentInfo}>
                  Existing outstanding: {formatCurrency(outstandingOf(selectedItem))}
                </Text>
                <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>QUICK AMOUNT (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  placeholderTextColor={mc.textFaint}
                  keyboardType="numeric"
                  value={quickAmount}
                  onChangeText={setQuickAmount}
                />
              </View>
              <View style={styles.quickMathRow}>
                <TouchableOpacity
                  style={[styles.quickMathBtn, { borderColor: mc.mint }]}
                  onPress={() => applyQuickMath('plus')}
                >
                  <Text style={[styles.quickMathBtnText, { color: mc.mint }]}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickMathBtn, { borderColor: mc.redSoft }]}
                  onPress={() => applyQuickMath('minus')}
                >
                  <Text style={[styles.quickMathBtnText, { color: mc.redSoft }]}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickMathBtn, { borderColor: mc.amber }]}
                  onPress={() => applyQuickMath('minus5')}
                >
<Text style={[styles.quickMathBtnText, { color: mc.amber }]}>−5%</Text>
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
                <Ionicons name="calendar-outline" size={18} color={mc.redSoft} />
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
                placeholderTextColor={mc.textFaint}
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
              <TextInput style={styles.textInput} placeholder="Cashback, refund, etc." placeholderTextColor={mc.textFaint} value={incomeName} onChangeText={setIncomeName} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
              <TextInput style={styles.textInput} placeholder="0.00" placeholderTextColor={mc.textFaint} keyboardType="numeric" value={incomeAmount} onChangeText={setIncomeAmount} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EXPECTED DATE</Text>
              <TouchableOpacity style={styles.datePickerTrigger} onPress={() => setIncomeDatePickerVisible(true)} activeOpacity={0.8}>
                <Ionicons name="calendar-outline" size={18} color={mc.text} />
                <Text style={styles.datePickerText}>
                  {incomeDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
              <TextInput style={styles.textInput} placeholder="Optional notes" placeholderTextColor={mc.textFaint} value={incomeNotes} onChangeText={setIncomeNotes} />
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
                    placeholderTextColor={mc.textFaint}
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
      <Modal visible={!!receiveGroup} transparent animationType="fade" onRequestClose={() => setReceiveGroup(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {receiveGroup?.type === 'lent' ? 'Receive —' : 'Pay back —'} {receiveGroup?.personName}
            </Text>
            <Text style={styles.paymentInfo}>
              Applied oldest-first: fully covered entries are removed, a
              partially covered entry is reduced by the remainder.
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {receiveGroup?.type === 'lent' ? 'AMOUNT RECEIVED (₹)' : 'AMOUNT PAID (₹)'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="0.00"
                placeholderTextColor={mc.textFaint}
                keyboardType="numeric"
                value={receiveAmount}
                onChangeText={setReceiveAmount}
                autoFocus
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setReceiveGroup(null)}>
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleGroupReceive}>
                <Text style={styles.modalBtnTextSave}>Confirm</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.logLink} onPress={() => setReceiveLogVisible(true)}>
              <Ionicons name="receipt-outline" size={12} color={mc.text} />
              <Text style={styles.logLinkText}>Receive log</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={receiveLogVisible} transparent animationType="fade" onRequestClose={() => setReceiveLogVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Receive Log</Text>
            <ScrollView style={styles.logScroll} showsVerticalScrollIndicator={false}>
              {receiveLog.length === 0 ? (
                <Text style={styles.logEmpty}>No receive activity yet.</Text>
              ) : (
                receiveLog.map((entry) => (
                  <View key={entry.id} style={styles.logEntry}>
                    <View style={styles.logEntryHeader}>
                      <Text style={styles.logEntryName}>
                        {entry.personName} · {entry.type === 'lent' ? 'lent' : 'borrowed'}
                      </Text>
                      <Text style={styles.logEntryAmount}>{formatCurrency(entry.amount)}</Text>
                    </View>
                    <Text style={styles.logEntryDate}>
                      {new Date(entry.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </Text>
                    {entry.breakdown.map((b, i) => (
                      <Text key={`${entry.id}_bd_${i}`} style={styles.logBreakdown}>
                        {b.label} — {formatCurrency(b.applied)} ({new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
                      </Text>
                    ))}
                    {entry.unapplied > 0 && (
                      <Text style={styles.logUnapplied}>Unapplied: {formatCurrency(entry.unapplied)}</Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setReceiveLogVisible(false)}>
                <Text style={styles.modalBtnTextCancel}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  logoText: {
    flex: 1,
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },
  sectionSub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 10,
  },

  moneyValue: {
    fontSize: 34,
    fontWeight: '500',
    marginVertical: 6,
  },
  shareBar: {
    marginVertical: 10,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: mc.textDim,
    maxWidth: 90,
  },

  listCard: {
    backgroundColor: mc.card,
    borderRadius: mr.card,
    overflow: 'hidden',
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemLeft: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 15,
    color: mc.text,
  },
  itemSubtitle: {
    fontSize: 11,
    color: mc.textDim,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  dueChip: {
    backgroundColor: mc.raised,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dueChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemRightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  copyBtn: {
    alignSelf: 'flex-end',
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 14,
    color: mc.textDim,
    marginTop: 8,
  },

  expandedSection: {
    backgroundColor: mc.raised,
    borderRadius: mr.row,
    marginHorizontal: 10,
    marginBottom: 10,
    padding: 10,
    gap: 8,
  },
  groupActions: {
    flexDirection: 'row',
    gap: 8,
  },
  receiveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.red,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  receiveAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: mc.white,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.raised,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logBtnText: {
    fontSize: 12,
    color: mc.textDim,
    fontWeight: '600',
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.card,
    borderRadius: 16,
    padding: 10,
  },
  subItemLeft: {
    flex: 1,
    minWidth: 0,
  },
  subItemAmount: {
    fontSize: 14,
    color: mc.text,
    fontWeight: '500',
  },
  subItemDate: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  subItemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  subItemNote: {
    fontSize: 11,
    color: mc.textDim,
    maxWidth: 140,
  },
  subItemRemaining: {
    fontSize: 11,
    color: mc.amber,
    marginTop: 2,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: mc.mintDim,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  payBtnText: {
    fontSize: 11,
    color: mc.mint,
    fontWeight: '600',
  },
  addSubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  addSubBtnText: {
    fontSize: 13,
    color: mc.textDim,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: mc.text,
  },
  modalToggleRow: {
    flexDirection: 'row',
    backgroundColor: mc.raised,
    borderRadius: 20,
    padding: 4,
  },
  modalToggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  modalToggleBtnLent: {
    backgroundColor: mc.red,
  },
  modalToggleBtnBorrowed: {
    backgroundColor: mc.red,
  },
  modalToggleText: {
    fontSize: 14,
    color: mc.textDim,
  },
  modalToggleTextActive: {
    color: mc.white,
    fontWeight: '500',
  },
  personInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  textInputInner: {
    flex: 1,
    paddingVertical: 14,
    color: mc.text,
    fontSize: 15,
  },
  amountInput: {
    fontSize: 20,
    paddingVertical: 15,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: mc.textDim,
    paddingHorizontal: 4,
  },
  textInput: {
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: mc.text,
    fontSize: 15,
  },
  quickMathGroup: {
    gap: 8,
  },
  quickMathRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickMathBtn: {
    width: 44,
    height: 40,
    borderRadius: 12,
    backgroundColor: mc.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickMathBtnText: {
    fontSize: 20,
    fontWeight: '600',
    color: mc.text,
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
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: mc.raised,
  },
  modalBtnDelete: {
    backgroundColor: mc.redDim,
  },
  modalBtnSave: {
    flex: 1.4,
    backgroundColor: mc.red,
  },
  modalBtnTextCancel: {
    fontSize: 14,
    color: mc.textDim,
  },
  modalBtnTextDelete: {
    fontSize: 14,
    color: mc.redSoft,
    fontWeight: '600',
  },
  modalBtnTextSave: {
    fontSize: 16,
    color: mc.white,
    fontWeight: '500',
  },
  paymentInfo: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: -2,
  },
  logLink: {
    paddingVertical: 8,
  },
  logLinkText: {
    fontSize: 13,
    color: mc.sky,
    fontWeight: '600',
  },
  logScroll: {
    maxHeight: 320,
    marginBottom: 8,
  },
  logEmpty: {
    fontSize: 13,
    color: mc.textDim,
    paddingVertical: 18,
    textAlign: 'center',
  },
  logEntry: {
    backgroundColor: mc.raised,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  logEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  logEntryName: {
    fontSize: 13,
    fontWeight: '600',
    color: mc.text,
    flex: 1,
  },
  logEntryAmount: {
    fontSize: 13,
    color: mc.mint,
    fontWeight: '600',
  },
  logEntryDate: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 4,
  },
  logBreakdown: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 6,
    lineHeight: 15,
  },
  logUnapplied: {
    fontSize: 11,
    color: mc.amber,
    marginTop: 6,
  },
});
