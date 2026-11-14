/**
 * BalanceSummaryScreen — consolidated balance summary across bank accounts,
 * wallets, credit cards and lending, with due dates and min-balance
 * exclusions.
 *
 * Restyled to the Meridian v2 reference (s25): a net-worth hero with an
 * allocation bar and the banks/lent/cards stat trio, then flat section
 * cards in semantic accents. Wallet rows stay tappable (balance editor) and
 * the Monthly Spends section keeps its month picker.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { Card, Label, PressScale, Screen, TopBar } from '../../../shared/components/meridian';
import { useFinanceStore, getMinBalanceForAccount } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import MonthPickerModal from '../components/MonthPickerModal';
import WalletBalanceEditor from '../components/WalletBalanceEditor';
import BankLogo from '../../../shared/components/BankLogo';

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
  // These sections open expanded so every row is visible.
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Bank Balances': true,
    Wallets: true,
  });
  const [editingWallet, setEditingWallet] = useState<{ id: string; name: string; amount: number } | null>(null);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const openWalletEditor = (id: string, name: string, current: number) => {
    setEditingWallet({ id, name, amount: current });
  };

  const saveWalletAmount = (amountPaise: number) => {
    if (!editingWallet) return;
    setWalletAmount(editingWallet.id, amountPaise, user?.id);
    setEditingWallet(null);
  };

  // Make sure the standard wallet rows exist (idempotent).
  React.useEffect(() => {
    seedWallets(user?.id);
  }, [user?.id]);

  const accountsTotal = accounts.reduce((sum, acc) => sum + acc.amount, 0);
  const walletTotal = (wallets || []).reduce((sum, w) => sum + w.amount, 0);
  // Wallets are cash — they are their own section and they count towards the
  // balance and the net worth (no minimum-balance rule applies to them).
  const totalBalance = accountsTotal + walletTotal;
  const totalMinBalance = accounts.reduce((sum, acc) => sum + getMinBalanceForAccount(acc.title), 0);
  const effectiveBalance = totalBalance - totalMinBalance;
  // What the banks contribute to the net worth after the minimum-balance rule.
  const banksNet = accountsTotal - totalMinBalance;
  const totalLent = receivables.filter((r) => r.type === 'lent').reduce((sum, r) => sum + (r.amount - (r.paidAmount || 0)), 0);
  const totalBorrowed = receivables.filter((r) => r.type === 'borrowed').reduce((sum, r) => sum + (r.amount - (r.paidAmount || 0)), 0);

  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const unpaidFixedExpensesTotal = fixedExpenses
    .filter((f) => f.lastPaidMonth !== currentMonthStr)
    .reduce((sum, f) => sum + f.amount, 0);
  const unpaidFixedCount = fixedExpenses.filter((f) => f.lastPaidMonth !== currentMonthStr).length;
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

  // ─── Derived section data ──────────────────────────────────────────────
  const bankItems = accounts.map((acc) => ({
    key: acc.id ?? acc.title,
    label: acc.title,
    bank: acc.title,
    value: acc.amount,
    subtitle:
      acc.amount < getMinBalanceForAccount(acc.title)
        ? `Below min ₹${(getMinBalanceForAccount(acc.title) / 100).toLocaleString('en-IN')}`
        : '',
    alert: acc.amount < getMinBalanceForAccount(acc.title),
    onPress: undefined as undefined | (() => void),
  }));

  const walletItems = (wallets || []).map((w) => ({
    key: w.id,
    label: w.name,
    bank: undefined as string | undefined,
    value: w.amount,
    subtitle: w.amount > 0 ? 'Wallet · tap to update' : 'Wallet · tap to set balance',
    alert: false,
    onPress: () => openWalletEditor(w.id, w.name, w.amount),
  }));
  const zeroWallets = (wallets || []).filter((w) => (w.amount ?? 0) <= 0).length;

  const cardItems = cards
    .filter((c) => c.balance > 0)
    .map((c) => ({
      key: c.id ?? `${c.name}-${c.endingWith}`,
      label: `${c.name} •••• ${c.endingWith}`,
      bank: undefined as string | undefined,
      value: c.balance,
      subtitle: formatDueDate(c.dueDate),
      alert: false,
      onPress: undefined as undefined | (() => void),
    }));

  const lentItems = receivables
    .filter((r) => r.type === 'lent')
    .map((r) => ({
      key: r.id,
      label: r.personName,
      bank: undefined as string | undefined,
      value: r.amount - (r.paidAmount || 0),
      subtitle: formatDueDate(r.dueDate),
      alert: false,
      onPress: undefined as undefined | (() => void),
    }));

  const borrowedCount = receivables.filter((r) => r.type === 'borrowed').length;

  // Allocation bar — banks (sky), wallets (violet), to receive (mint)
  const allocTotal = Math.max(1, banksNet + walletTotal + totalLent);
  const alloc = [
    { label: 'Banks', color: mc.sky, value: Math.max(0, banksNet) },
    { label: 'Wallets', color: mc.violet, value: walletTotal },
    { label: 'To receive', color: mc.mint, value: totalLent },
  ].map((s) => ({ ...s, widthPct: (Math.max(0, s.value) / allocTotal) * 100 }));

  interface SectionRowItem {
    key: string;
    label: string;
    bank?: string;
    value: number;
    subtitle: string;
    alert: boolean;
    onPress?: () => void;
  }

  const renderSectionRow = (item: SectionRowItem) => (
    <TouchableOpacity
      key={item.key}
      activeOpacity={item.onPress ? 0.7 : 1}
      onPress={item.onPress}
      style={styles.itemRow}
    >
      <View style={styles.itemLeft}>
        {item.bank ? <BankLogo title={item.bank} size={30} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.itemLabel} numberOfLines={1}>{item.label}</Text>
          {item.subtitle ? (
            <Text style={[styles.itemSubtitle, item.alert && { color: mc.redSoft }]} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.itemValueWrap}>
        <Text style={[styles.itemValue, item.alert && { color: mc.redSoft }]}>
          {formatCurrency(item.value)}
        </Text>
        {item.onPress ? <Ionicons name="create-outline" size={15} color={mc.textDim} style={{ marginLeft: 6 }} /> : null}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (
    title: string,
    icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap,
    accent: string,
    dim: string,
    items: SectionRowItem[],
    total: number,
    emptyText: string,
    footerNote?: string
  ) => {
    const expanded = expandedSections[title];
    const visible = expanded ? items : items.slice(0, 3);
    return (
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: dim }]}>
            <Ionicons name={icon} size={17} color={accent} />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={[styles.sectionTotal, { color: accent }]}>{formatCurrency(total)}</Text>
        </View>
        {items.length === 0 ? (
          <Text style={styles.sectionEmpty}>{emptyText}</Text>
        ) : (
          <>
            {visible.map(renderSectionRow)}
            {items.length > 3 ? (
              <TouchableOpacity style={styles.moreBtn} onPress={() => toggleSection(title)} activeOpacity={0.8}>
                <Text style={styles.moreText}>
                  {expanded ? 'Show less' : `Show all ${items.length}`}
                </Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={mc.redSoft} />
              </TouchableOpacity>
            ) : null}
          </>
        )}
        {footerNote ? <Text style={styles.sectionFoot}>{footerNote}</Text> : null}
      </Card>
    );
  };

  return (
    <Screen bottomInset={36}>
      <TopBar title="Balance summary" onBack={() => navigation.goBack()} variant="left" />

      {/* Hero — net worth, allocation bar, stat trio */}
      <Card>
        <Label>TOTAL NET WORTH</Label>
        <Text style={styles.heroValue}>{formatCurrency(totalNetWorth)}</Text>

        <View style={styles.allocBar}>
          {alloc.map((seg) => (
            <View
              key={seg.label}
              style={[styles.allocSeg, { width: `${seg.widthPct}%`, backgroundColor: seg.color }]}
            />
          ))}
        </View>
        <View style={styles.allocLegend}>
          {alloc.map((seg) => (
            <View key={seg.label} style={styles.allocLegendItem}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <Text style={styles.legendText}>{seg.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statTrio}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{formatCurrency(banksNet)}</Text>
            <Text style={styles.statLabel}>BANKS*</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: mc.mint }]}>+{formatCurrency(totalLent)}</Text>
            <Text style={styles.statLabel}>LENT</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: mc.redSoft }]}>-{formatCurrency(cardOutstandingTotal)}</Text>
            <Text style={styles.statLabel}>CARDS</Text>
          </View>
        </View>
        <Text style={styles.footnote}>
          {`*Bank balance above minimum balances (₹${Math.round(accountsTotal / 100).toLocaleString('en-IN')} total)`}
        </Text>
      </Card>

      {/* Bank balances */}
      {renderSection(
        'Bank Balances',
        'business-outline',
        mc.sky,
        mc.skyDim,
        bankItems,
        accountsTotal,
        'No bank accounts yet'
      )}

      {/* Wallets */}
      {renderSection(
        'Wallets',
        'wallet-outline',
        mc.violet,
        mc.violetDim,
        walletItems,
        walletTotal,
        'No wallets yet',
        zeroWallets > 0 ? `${zeroWallets} wallet${zeroWallets === 1 ? '' : 's'} at ₹0` : undefined
      )}

      {/* Credit card bills */}
      {renderSection(
        'Credit Card Bills',
        'card-outline',
        mc.redSoft,
        mc.redDim,
        cardItems,
        cardOutstandingTotal,
        'No card bills due'
      )}

      {/* Lent money */}
      {renderSection(
        'Lent Money',
        'arrow-up-circle-outline',
        mc.mint,
        mc.mintDim,
        lentItems,
        totalLent,
        'Nobody owes you yet'
      )}

      {/* Borrowed + fixed unpaid — two up */}
      <View style={styles.twoUp}>
        <Card style={styles.twoUpCell}>
          <Label>BORROWED</Label>
          <Text style={styles.twoUpValue}>{formatCurrency(totalBorrowed)}</Text>
          <Text style={styles.twoUpCaption}>
            {borrowedCount === 0 ? 'No entries' : `${borrowedCount} pending`}
          </Text>
        </Card>
        <Card style={styles.twoUpCell}>
          <Label>FIXED UNPAID</Label>
          <Text style={[styles.twoUpValue, unpaidFixedExpensesTotal === 0 && { color: mc.mint }]}>
            {formatCurrency(unpaidFixedExpensesTotal)}
          </Text>
          <Text style={styles.twoUpCaption}>
            {unpaidFixedCount === 0 ? 'All paid' : `${unpaidFixedCount} unpaid`}
          </Text>
        </Card>
      </View>

      {/* Monthly spends (kept) */}
      <Card>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: mc.skyDim }]}>
            <Ionicons name="wallet-outline" size={17} color={mc.sky} />
          </View>
          <Text style={styles.sectionTitle}>Monthly Spends</Text>
          <PressScale
            style={styles.monthPill}
            onPress={() => setMonthPickerVisible(true)}
            scale={0.96}
            accessibilityLabel="Choose month"
          >
            <Text style={styles.monthPillText}>
              {selectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </Text>
            <Ionicons name="chevron-down" size={12} color={mc.textDim} />
          </PressScale>
        </View>
        <View style={styles.monthTotalRow}>
          <Text style={styles.sectionTotal}>{formatCurrency(monthlyExpenses)}</Text>
        </View>
        {monthlyTxns
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 3)
          .map((tx) => (
            <View key={tx.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemLabel} numberOfLines={1}>{tx.notes || tx.category || 'Expense'}</Text>
                <Text style={styles.itemSubtitle}>
                  {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              <Text style={styles.itemValue}>{formatCurrency(tx.amount)}</Text>
            </View>
          ))}
        {monthlyTxns.length === 0 ? <Text style={styles.sectionEmpty}>No spends this month yet</Text> : null}
      </Card>

      {/* Deficits banner */}
      {deficitsSum > 0 ? (
        <Card style={styles.deficitCard}>
          <Ionicons name="warning" size={17} color={mc.amber} />
          <Text style={styles.deficitText}>
            Bank balance deficits: {formatCurrency(deficitsSum)} below minimum required
          </Text>
        </Card>
      ) : null}

      <MonthPickerModal
        visible={monthPickerVisible}
        selected={selectedMonth}
        maxMonth={new Date(now.getFullYear(), now.getMonth(), 1)}
        onSelect={setSelectedMonth}
        onClose={() => setMonthPickerVisible(false)}
      />

      {/* Wallet balance editor */}
      <WalletBalanceEditor
        visible={!!editingWallet}
        name={editingWallet?.name ?? ''}
        amount={editingWallet?.amount ?? 0}
        onSave={saveWalletAmount}
        onClose={() => setEditingWallet(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroValue: {
    fontSize: 36,
    fontWeight: '500',
    color: mc.text,
    marginTop: 4,
    marginBottom: 14,
  },
  allocBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 3,
    marginBottom: 10,
  },
  allocSeg: {
    height: 12,
    borderRadius: 6,
  },
  allocLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  allocLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: mc.textDim,
  },
  statTrio: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
    paddingTop: 12,
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
  statLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: mc.textDim,
  },
  footnote: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 10,
  },
  sectionCard: {
    paddingBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: mr.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    color: mc.text,
  },
  sectionTotal: {
    fontSize: 15,
    fontWeight: '500',
  },
  sectionEmpty: {
    fontSize: 13,
    color: mc.textFaint,
    paddingVertical: 6,
  },
  sectionFoot: {
    fontSize: 11,
    color: mc.textDim,
    textAlign: 'center',
    paddingTop: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  itemLabel: {
    fontSize: 14,
    color: mc.text,
  },
  itemSubtitle: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  itemValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemValue: {
    fontSize: 14,
    fontWeight: '500',
    color: mc.text,
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
  },
  moreText: {
    fontSize: 12,
    fontWeight: '600',
    color: mc.redSoft,
  },
  twoUp: {
    flexDirection: 'row',
    gap: 10,
  },
  twoUpCell: {
    flex: 1,
    gap: 4,
  },
  twoUpValue: {
    fontSize: 20,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  twoUpCaption: {
    fontSize: 11,
    color: mc.textDim,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.raised,
    borderRadius: mr.chip,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  monthPillText: {
    fontSize: 12,
    color: mc.text,
  },
  monthTotalRow: {
    marginBottom: 4,
  },
  deficitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: mc.amberDim,
  },
  deficitText: {
    flex: 1,
    fontSize: 13,
    color: mc.amber,
  },
});
