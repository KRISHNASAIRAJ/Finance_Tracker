/**
 * CardAssistantScreen — spend-based credit-card recommender UI that drives the
 * cardEngine and explains the best card for a transaction.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Platform, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { recommendCards, type SuggestionInput } from '../cardEngine';
import { CARD_DEFINITIONS } from '../cardData';
import { useFinanceStore } from '../store';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';

type SpendMode = 'online' | 'offline' | 'upi';

const formatCur = (paise: number) => `\u20B9${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const cardColors: Record<string, string> = {
  'SBI Cashback Card': colors.action,
  'SBI SimplySAVE': colors.amber,
  'IDFC Power+': colors.stable,
  'Amazon Pay ICICI': colors.action,
  'HSBC Platinum RuPay': colors.secondary,
  'CRED IndusInd': colors.stable,
  'Slice Card': colors.amber,
  'Load Card': colors.secondary,
};

interface RenderedResult {
  card: (typeof CARD_DEFINITIONS)[number];
  effectiveRate: number;
  estimatedCashback: number;
  capWarning?: string;
  matchedCategory: string;
  reason: string;
}

export default function CardAssistantScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FinanceStackParamList, 'CardAssistant'>>();
  const { cards } = useFinanceStore();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<SpendMode>('online');
  const [storeName, setStoreName] = useState('');

  const ownedCardNames = new Set(cards.map((c: any) => c.name.toLowerCase()));

  const amt = parseFloat(amount);
  const hasAmount = !isNaN(amt) && amt > 0;

  const results: RenderedResult[] = React.useMemo(() => {
    if (!hasAmount) return [];
    const input: SuggestionInput = {
      amount: Math.round(amt * 100),
      storeName: storeName.trim() || undefined,
      isOnline: mode === 'online' ? true : mode === 'offline' ? false : undefined,
      isUpi: mode === 'upi',
    };
    return recommendCards(input)
      .filter(r => ownedCardNames.has(r.card.name.toLowerCase()))
      .filter(r => r.effectiveRate > 0)
      .slice(0, 5);
  }, [amount, mode, storeName, hasAmount, amt, ownedCardNames]);

  const clearAmount = () => {
    setAmount('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Card Assistant</Text>
        <TouchableOpacity
          style={styles.askAiBtn}
          onPress={() => navigation.navigate('CardChat')}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles" size={16} color={colors.primary} />
          <Text style={styles.askAiText}>Ask AI</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Spend Mode Toggle */}
        <View style={styles.modeToggleRow}>
          {([
            { key: 'online' as SpendMode, label: 'Online', icon: 'globe', color: colors.action },
            { key: 'offline' as SpendMode, label: 'Offline', icon: 'storefront', color: colors.amber },
            { key: 'upi' as SpendMode, label: 'UPI', icon: 'phone-portrait', color: colors.stable },
          ]).map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeBtn, mode === m.key && { backgroundColor: `${m.color}20`, borderColor: `${m.color}40` }]}
              onPress={() => setMode(m.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={m.icon as any} size={16} color={mode === m.key ? m.color : colors.onSurfaceVariant} />
              <Text style={[styles.modeText, mode === m.key && { color: m.color, fontWeight: '700' }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount Input */}
        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>AMOUNT (₹)</Text>
            <View style={styles.amountInputWrap}>
              <TextInput
                style={styles.textInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="Enter spend amount"
                placeholderTextColor={colors.outline}
              />
              {amount.length > 0 && (
                <TouchableOpacity onPress={clearAmount} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={16} color={colors.outline} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>STORE (OPTIONAL)</Text>
            <TextInput
              style={styles.textInput}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Amazon, Swiggy..."
              placeholderTextColor={colors.outline}
              autoCapitalize="none"
            />
          </View>
        </View>

        {mode === 'upi' && (
          <View style={styles.upiNote}>
            <Ionicons name="information-circle" size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.upiNoteText}>UPI works only with RuPay cards — Slice, CRED IndusInd, SBI SimplySAVE, IDFC Power+</Text>
          </View>
        )}

        {/* Results */}
        {hasAmount && results.length > 0 && (
          <View style={styles.resultsBlock}>
            <Text style={styles.resultsTitle}>
              {`${formatCur(Math.round(amt * 100))} · ${mode === 'upi' ? 'UPI' : mode === 'online' ? 'Online' : 'Offline'}`}
            </Text>

            {results.map((r, i) => (
              <View
                key={r.card.id}
                style={[
                  styles.resultCard,
                  i === 0 && styles.topCard,
                  { borderLeftColor: cardColors[r.card.name] || colors.primary },
                ]}
              >
                <View style={styles.resultHeader}>
                  <View style={styles.resultTitle}>
                    <View style={[styles.dot, { backgroundColor: cardColors[r.card.name] || colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.cardName}>{r.card.name}</Text>
                        <Text style={styles.cardNetwork}>{r.card.network}</Text>
                      </View>
                      <Text style={styles.cardSub}>
                        {r.card.lifetimeFree ? 'LTF' : `₹${r.card.annualFee}/yr`} · {r.reason}
                      </Text>
                    </View>
                  </View>
                  {i === 0 && (
                    <View style={styles.bestChip}>
                      <Text style={styles.bestChipText}>BEST</Text>
                    </View>
                  )}
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metric}>
                    <Text style={styles.metricVal}>{r.effectiveRate}%</Text>
                    <Text style={styles.metricLbl}>Rate</Text>
                  </View>
                  {r.estimatedCashback > 0 && (
                    <View style={styles.metric}>
                      <Text style={[styles.metricVal, { color: colors.stable }]}>+{formatCur(r.estimatedCashback)}</Text>
                      <Text style={styles.metricLbl}>Cashback</Text>
                    </View>
                  )}
                </View>

                {r.capWarning && (
                  <View style={styles.warnRow}>
                    <Ionicons name="warning-outline" size={11} color={colors.amber} />
                    <Text style={styles.warnText}>{r.capWarning}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Empty state */}
        {!hasAmount && (
          <View style={styles.emptyWrap}>
            <Ionicons name="calculator-outline" size={32} color={colors.outline} />
            <Text style={styles.emptyTitle}>Card Calculator</Text>
            <Text style={styles.emptyDesc}>
              Enter a spend amount, select Online/Offline/UPI,{'\n'}
              and see which card gives the best rewards.
            </Text>
          </View>
        )}

        {/* IDFC Fuel Calculator */}
        <FuelCalculatorBlock />
      </ScrollView>
    </SafeAreaView>
  );
}

function FuelCalculatorBlock() {
  const [fuelAmt, setFuelAmt] = useState('');
  const [mode, setMode] = useState<'wallet' | 'tap' | 'none'>('wallet');
  const [grocery, setGrocery] = useState(false);

  const calc = React.useMemo(() => {
    const a = parseFloat(fuelAmt) || 0;
    if (a <= 0) return null;

    if (grocery) {
      const s = Math.min(a, 2000) * 100;
      return { rewardPts: Math.round(s * 0.05), happyCoins: 0, total: Math.round(s * 0.05), gross: Math.round(s * 0.05), surcharge: 0, isFuel: false, netPct: 5 };
    }

    const fuelCap = Math.min(a, 12000) * 100;
    const grossReward = Math.round(fuelCap * 0.05);
    const surcharge = Math.round(fuelCap * 0.0108);

    if (mode === 'none') {
      const netReward = Math.round(fuelCap * 3.92 / 100);
      return { rewardPts: netReward, happyCoins: 0, total: netReward, gross: grossReward, surcharge, isFuel: true, netPct: 3.9 };
    }

    if (mode === 'tap') {
      const netReward = Math.round(fuelCap * 4.5 / 100);
      return { rewardPts: netReward, happyCoins: 0, total: netReward, gross: grossReward, surcharge, isFuel: true, netPct: 4.5 };
    }

    // wallet/QR mode
    const netReward = Math.round(fuelCap * 3.92 / 100);
    const coins = Math.round(Math.min(a, 10000) * 100 * 1.5 / 100);
    return { rewardPts: netReward, happyCoins: coins, total: netReward + coins, gross: grossReward, surcharge, isFuel: true, netPct: 5 };
  }, [fuelAmt, mode, grocery]);

  return (
    <View style={styles.fuelBlock}>
      <View style={styles.fuelHeader}>
        <Ionicons name="calculator-outline" size={18} color={colors.stable} />
        <Text style={styles.fuelTitle}>IDFC Power+ Fuel Calculator</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>AMOUNT (₹)</Text>
          <TextInput style={styles.textInput} value={fuelAmt} onChangeText={setFuelAmt} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.outline} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>TYPE</Text>
          <TouchableOpacity style={styles.typeBtn} onPress={() => setGrocery(!grocery)} activeOpacity={0.8}>
            <Text style={styles.typeBtnText}>{grocery ? 'Grocery/Utility' : 'HPCL Fuel'}</Text>
            <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {!grocery && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { key: 'wallet', label: 'Wallet/QR', pct: '5%' },
            { key: 'tap', label: 'Card Tap', pct: '4.5%' },
            { key: 'none', label: 'Card Only', pct: '3.9%' },
          ].map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeSubBtn, mode === m.key && styles.modeSubBtnSel]}
              onPress={() => setMode(m.key as any)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeSubLabel, mode === m.key && styles.modeSubLabelSel]}>{m.label}</Text>
              <Text style={[styles.modeSubPct, mode === m.key && styles.modeSubPctSel]}>{m.pct}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {calc && (
        <View style={styles.savingCard}>
          <Text style={styles.savingTitle}>{calc.isFuel ? `Net Savings — ${calc.netPct}%` : 'Grocery/Utility — 5%'}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={styles.savingLabel}>Gross Rewards</Text>
              <Text style={styles.savingVal}>+{formatCur(calc.gross)}</Text>
            </View>
            {calc.isFuel && calc.surcharge > 0 && (
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={[styles.savingLabel, { color: colors.error }]}>Surcharge ~1.08%</Text>
                <Text style={[styles.savingVal, { color: colors.error }]}>-{formatCur(calc.surcharge)}</Text>
              </View>
            )}
            {calc.happyCoins > 0 && (
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={styles.savingLabel}>Happy Coins 1.5%</Text>
                <Text style={styles.savingVal}>+{formatCur(calc.happyCoins)}</Text>
              </View>
            )}
          </View>
          <View style={styles.savingTotal}>
            <Text style={styles.savingTotalLabel}>NET SAVINGS</Text>
            <Text style={styles.savingTotalVal}>+{formatCur(calc.total)}</Text>
          </View>
          <Text style={styles.capText}>
            {calc.isFuel ? 'Fuel cap: ₹12K/cycle · Happy Coins ₹10K' : 'Grocery/Utility cap: ₹2K/cycle'}
          </Text>
        </View>
      )}
    </View>
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
    height: 56,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 6, borderRadius: rounded.full },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  askAiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: rounded.full,
    backgroundColor: `${colors.primary}12`,
    borderWidth: StyleSheet.hairlineWidth, borderColor: `${colors.primary}25`,
  },
  askAiText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  scroll: { padding: spacing.containerPadding, gap: 16, paddingBottom: 60 },
  modeToggleRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: rounded.DEFAULT,
    backgroundColor: colors.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  modeText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  label: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginBottom: 6 },
  amountInputWrap: { position: 'relative' },
  textInput: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    height: 44,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: '500',
  },
  clearBtn: { position: 'absolute', right: 10, top: 12, padding: 2 },
  upiNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${colors.primary}08`, borderWidth: StyleSheet.hairlineWidth, borderColor: `${colors.primary}12`,
    borderRadius: rounded.DEFAULT, padding: 10,
  },
  upiNoteText: { fontSize: 11, color: colors.onSurfaceVariant, flex: 1 },
  inputRow: { flexDirection: 'row', gap: 10 },
  resultsBlock: { gap: 10 },
  resultsTitle: { fontSize: 12, fontWeight: '700', color: colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultCard: {
    backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderLeftWidth: 3,
    padding: 14, gap: 10,
  },
  topCard: { backgroundColor: `${colors.primaryContainer}06`, borderColor: `${colors.primaryContainer}25` },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  resultTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardName: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  cardNetwork: {
    fontSize: 9, fontWeight: '700', color: colors.onSurfaceVariant,
    backgroundColor: `${colors.onSurfaceVariant}15`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: rounded.full,
  },
  cardSub: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 2 },
  bestChip: {
    backgroundColor: 'rgba(226,164,92,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: rounded.full,
  },
  bestChipText: { fontSize: 9, fontWeight: '800', color: colors.amber },
  metricsRow: { flexDirection: 'row', gap: 28 },
  metric: { gap: 2 },
  metricVal: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
  metricLbl: { fontSize: 10, color: colors.onSurfaceVariant },
  warnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(226,164,92,0.08)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: rounded.DEFAULT,
  },
  warnText: { fontSize: 10, color: colors.amber, flex: 1 },
  emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  emptyDesc: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20 },
  fuelBlock: {
    backgroundColor: 'rgba(89,214,199,0.04)', borderRadius: rounded.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 16, gap: 14, marginTop: 8,
  },
  fuelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fuelTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, height: 44, paddingHorizontal: 12,
  },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  modeSubBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: rounded.DEFAULT, backgroundColor: colors.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 2,
  },
  modeSubBtnSel: { backgroundColor: `${colors.primary}12`, borderColor: colors.primaryContainer },
  modeSubLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant },
  modeSubLabelSel: { color: colors.primary },
  modeSubPct: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
  modeSubPctSel: { color: colors.primary },
  savingCard: {
    backgroundColor: 'rgba(89,214,199,0.06)', borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14, gap: 12,
  },
  savingTitle: { fontSize: 13, fontWeight: '700', color: colors.stable, textAlign: 'center' },
  savingLabel: { fontSize: 10, color: colors.onSurfaceVariant },
  savingVal: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  savingTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(89,214,199,0.12)',
  },
  savingTotalLabel: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.5 },
  savingTotalVal: { fontSize: 20, fontWeight: '800', color: colors.stable },
  capText: { fontSize: 10, color: colors.onSurfaceVariant, textAlign: 'center', fontStyle: 'italic' },
});
