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
import { getCategoryIcon, getCategoryColor } from '../../../shared/categoryMap';

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
  const { user } = require('../../../services/AuthProvider').useAuth();

  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentInput, setPaymentInput] = useState('');

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

  const cardLimit = card.cardLimit || 0;
  const utilization = cardLimit > 0 ? (card.balance / cardLimit) * 100 : 0;

  const formatCurrency = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle} numberOfLines={1}>{card.name}</Text>
        <View style={{ width: 40 }} />
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
              <View style={[styles.networkBadge, { borderColor: accent }]}>
                <Text style={[styles.networkBadgeText, { color: accent }]}>{card.network}</Text>
              </View>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>OUTSTANDING</Text>
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
                <Text style={styles.infoValue}>{card.billingDay}th of every month</Text>
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
            <Ionicons name="card-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.payButtonText}>Pay Bill</Text>
          </TouchableOpacity>
        </View>

        {/* Card Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {cardTransactions.length === 0 ? (
            <Text style={styles.emptyText}>No transactions found for this card</Text>
          ) : (
            [...cardTransactions]
              .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 10).map((tx: any, index: number) => (
              <View
                key={tx.id}
                style={[
                  styles.txItem,
                  index < cardTransactions.slice(0, 10).length - 1 && styles.txBorder,
                ]}
              >
                <View style={[styles.txIcon, { backgroundColor: `${getCategoryColor(tx.category)}20` }]}>
                  <Ionicons
                    name={getCategoryIcon(tx.category)}
                    size={18}
                    color={getCategoryColor(tx.category)}
                  />
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
        </View>
      </ScrollView>

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
  networkBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  networkBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  heroStats: { flexDirection: 'row', gap: 24 },
  heroStat: { flex: 1 },
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
  payButtonText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
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
});
