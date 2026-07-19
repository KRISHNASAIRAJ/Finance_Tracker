import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../shared/theme/colors';
import { spacing, rounded } from '../../shared/theme/spacing';
import { recommendCards, SuggestionInput, CardRecommendation } from '../../modules/finance/cardEngine';
import { CARD_DEFINITIONS } from '../../modules/finance/cardData';

const QUICK_SCENARIOS: { label: string; input: SuggestionInput; icon: string }[] = [
  { label: 'Fuel ₹500', input: { amount: 50000, mcc: '5541', storeName: 'HPCL Fuel' }, icon: 'car-sport' },
  { label: 'Amazon ₹1K', input: { amount: 100000, storeName: 'Amazon', haveAmazonPrime: true }, icon: 'cart' },
  { label: 'Dinner ₹800', input: { amount: 80000, mcc: '5812', storeName: 'Restaurant' }, icon: 'restaurant' },
  { label: 'Grocery ₹1.5K', input: { amount: 150000, mcc: '5411', storeName: 'Grocery' }, icon: 'basket' },
  { label: 'Online ₹2K', input: { amount: 200000, isOnline: true }, icon: 'globe' },
  { label: 'Utility ₹3K', input: { amount: 300000, mcc: '4900', storeName: 'Electricity Bill' }, icon: 'flash' },
];

const formatCur = (paise: number) => `\u20B9${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

interface Props {
  showFuelCalc?: boolean;
}

export default function CardAssistant({ showFuelCalc }: Props) {
  const [amount, setAmount] = useState('');
  const [storeName, setStoreName] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<SuggestionInput | null>(null);
  const [showFuelCalculator, setShowFuelCalculator] = useState(false);

  const results = useMemo(() => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      if (!selectedScenario) return [];
      return recommendCards(selectedScenario).slice(0, 5);
    }
    return recommendCards({
      amount: Math.round(amt * 100),
      storeName: storeName || undefined,
    }).slice(0, 5);
  }, [amount, storeName, selectedScenario]);

  const handleScenario = (s: typeof QUICK_SCENARIOS[0]) => {
    setSelectedScenario(s.input);
    setAmount('');
    setStoreName('');
  };

  const cardColors: Record<string, string> = {
    'SBI Cashback Card': '#3B82F6',
    'SBI SimplySAVE': '#F59E0B',
    'IDFC Power+': '#10B981',
    'Amazon Pay ICICI': '#8B5CF6',
    'HSBC Platinum RuPay': '#EF4444',
    'CRED IndusInd': '#06B6D4',
    'Slice Card': '#F97316',
    'Pazapp Card': '#84CC16',
    'Load Card': '#6B7280',
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <Text style={styles.title}>Card Assistant</Text>
        </View>
        <Text style={styles.subtitle}>Offline T&C based</Text>
      </View>

      {/* Input area */}
      <View style={styles.inputRow}>
        <View style={styles.amountWrap}>
          <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
          <TextInput
            style={styles.textInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.outline}
          />
        </View>
        <View style={styles.storeWrap}>
          <Text style={styles.inputLabel}>STORE / MERCHANT</Text>
          <TextInput
            style={styles.textInput}
            value={storeName}
            onChangeText={setStoreName}
            placeholder="eg. Amazon, Swiggy"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* Quick scenarios */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scenariosScroll}>
        {QUICK_SCENARIOS.map((s, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.scenarioPill, selectedScenario === s.input && styles.scenarioPillActive]}
            onPress={() => handleScenario(s)}
            activeOpacity={0.8}
          >
            <Ionicons name={s.icon as any} size={14} color={selectedScenario === s.input ? '#fff' : colors.primary} />
            <Text style={[styles.scenarioText, selectedScenario === s.input && styles.scenarioTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      {results.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.resultsHeader}>
            {(amount || selectedScenario) ? 'Best Cards for This Spend' : 'Best Cards'}
          </Text>
          {results.map((r, i) => (
            <View
              key={r.card.id}
              style={[
                styles.resultCard,
                i === 0 && r.effectiveRate > 0 && styles.resultCardBest,
                { borderLeftColor: cardColors[r.card.name] || colors.primary },
              ]}
            >
              <View style={styles.resultTop}>
                <View style={styles.resultLeft}>
                  <View style={[styles.cardDot, { backgroundColor: cardColors[r.card.name] || colors.primary }]} />
                  <View>
                    <Text style={styles.cardTitle}>{r.card.name}</Text>
                    <Text style={styles.cardMeta}>
                      {r.card.lifetimeFree ? 'LTF' : `₹${r.card.annualFee}/yr`} · {r.matchedCategory}
                    </Text>
                  </View>
                </View>
                {i === 0 && r.effectiveRate > 0 && (
                  <View style={styles.bestBadge}>
                    <Ionicons name="trophy" size={10} color="#F59E0B" />
                    <Text style={styles.bestBadgeText}>BEST</Text>
                  </View>
                )}
              </View>

              <View style={styles.resultMetrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{r.effectiveRate}%</Text>
                  <Text style={styles.metricLabel}>Cashback Rate</Text>
                </View>
                {r.estimatedCashback > 0 && (
                  <View style={styles.metric}>
                    <Text style={[styles.metricValue, { color: '#10B981' }]}>
                      +{formatCur(r.estimatedCashback)}
                    </Text>
                    <Text style={styles.metricLabel}>Estimated Earn</Text>
                  </View>
                )}
              </View>

              <Text style={styles.reason}>{r.reason}</Text>

              {r.capWarning && (
                <View style={styles.warningRow}>
                  <Ionicons name="warning-outline" size={12} color="#F59E0B" />
                  <Text style={styles.warningText}>{r.capWarning}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* No results info */}
      {results.length === 0 && !amount && !selectedScenario && (
        <View style={styles.emptyState}>
          <Ionicons name="bulb-outline" size={24} color={colors.outline} />
          <Text style={styles.emptyText}>Enter an amount or merchant to see which card gives you the best rewards.</Text>
        </View>
      )}

      {/* Tools row */}
      {showFuelCalc && (
        <TouchableOpacity
          style={styles.toolButton}
          onPress={() => setShowFuelCalculator(!showFuelCalculator)}
          activeOpacity={0.8}
        >
          <Ionicons name="calculator-outline" size={18} color={colors.primary} />
          <Text style={styles.toolButtonText}>
            {showFuelCalculator ? 'Hide Fuel Savings Calculator' : 'IDFC Power+ Fuel Savings Calculator'}
          </Text>
          <Ionicons name={showFuelCalculator ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      {showFuelCalculator && <FuelCalculator />}
    </View>
  );
}

function FuelCalculator() {
  const [fuelAmount, setFuelAmount] = useState('');
  const [hpPayMode, setHpPayMode] = useState<'qr' | 'wallet' | 'none'>('qr');
  const [isGrocery, setIsGrocery] = useState(false);

  const calc = useMemo(() => {
    const amt = parseFloat(fuelAmount) || 0;
    if (amt <= 0) return null;

    const amountPaise = amt * 100;
    
    // Fuel caps — per statement cycle (for IDFC Power+)
    // 30X Rewards = 30 RP per ₹150, 1 RP = ₹0.25 → 5% gross
    // Fuel surcharge: 1.08% (GST inclusive) deducted → net 3.92% from rewards
    // Happy Coins: 1.5% (no surcharge deduction on coins)
    const NET_REWARD_RATE = 3.92; // 5% - 1.08% surcharge
    const HAPPY_COIN_RATE = 1.5;
    
    const fuelSpend = Math.min(amt, 12000);
    const fuelPaise = fuelSpend * 100;
    
    // Fuel: net rewards after surcharge
    const fuelRewards = Math.round(fuelPaise * NET_REWARD_RATE / 100);
    const fuelGross = Math.round(fuelPaise * 0.05); // before surcharge
    const fuelSurcharge = Math.round(fuelPaise * 0.0108); // 1.08% surcharge
    
    // Happy Coins: 1.5% on HP Pay (only for fuel, capped at ₹10,000)
    let happyCoins = 0;
    if (hpPayMode !== 'none' && !isGrocery) {
      const coinSpend = Math.min(amt, 10000);
      happyCoins = Math.round(coinSpend * 100 * HAPPY_COIN_RATE / 100);
    }
    
    // Grocery cap: ₹2,000
    if (isGrocery) {
      const grocerySpend = Math.min(amt, 2000);
      const groceryPaise = grocerySpend * 100;
      return {
        rewardPts: Math.round(groceryPaise * 0.05),
        happyCoins: 0,
        totalSavings: Math.round(groceryPaise * 0.05),
        rewardPercent: 5,
        isFuel: false,
        grossReward: Math.round(groceryPaise * 0.05),
        surcharge: 0,
      };
    }

    return {
      rewardPts: fuelRewards,
      happyCoins,
      totalSavings: fuelRewards + happyCoins,
      rewardPercent: hpPayMode !== 'none' ? Number((NET_REWARD_RATE + HAPPY_COIN_RATE).toFixed(1)) : Number(NET_REWARD_RATE.toFixed(1)),
      isFuel: true,
      grossReward: fuelGross,
      surcharge: fuelSurcharge,
    };
  }, [fuelAmount, hpPayMode, isGrocery]);

  return (
    <View style={styles.fuelCalc}>
      <View style={styles.inputRow}>
        <View style={styles.amountWrap}>
          <Text style={styles.inputLabel}>SPEND AMOUNT (₹)</Text>
          <TextInput
            style={styles.textInput}
            value={fuelAmount}
            onChangeText={setFuelAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.outline}
          />
        </View>
        <View style={styles.storeWrap}>
          <Text style={styles.inputLabel}>TYPE</Text>
          <TouchableOpacity
            style={styles.typeToggle}
            onPress={() => setIsGrocery(!isGrocery)}
            activeOpacity={0.8}
          >
            <Text style={styles.typeToggleText}>
              {isGrocery ? 'Grocery/Utility' : 'HPCL Fuel'}
            </Text>
            <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {!isGrocery && (
        <View style={styles.hpPayModes}>
          <Text style={styles.inputLabel}>HP PAY MODE</Text>
          <View style={styles.modeRow}>
            {[
              { key: 'qr', label: 'Pay by QR', rate: '5.4%' },
              { key: 'wallet', label: 'Wallet Upload', rate: '5.4%' },
              { key: 'none', label: 'Card Only', rate: '3.9%' },
            ].map(m => (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeBtn, hpPayMode === m.key && styles.modeBtnActive]}
                onPress={() => setHpPayMode(m.key as 'qr' | 'wallet' | 'none')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeBtnText, hpPayMode === m.key && styles.modeBtnTextActive]}>
                  {m.label}
                </Text>
                <Text style={[styles.modeRate, hpPayMode === m.key && styles.modeRateActive]}>{m.rate}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {calc && (
        <View style={styles.savingsCard}>
          <Text style={styles.savingsTitle}>
            {calc.isFuel ? `Fuel Savings — Net ${calc.rewardPercent}%` : `Grocery/Utility Savings — 5%`}
          </Text>
          <View style={styles.savingsRow}>
            <View style={styles.savingsItem}>
              <Text style={styles.savingsLabel}>30X Rewards (gross)</Text>
              <Text style={styles.savingsValue}>+{formatCur(calc.grossReward ?? calc.rewardPts)}</Text>
            </View>
            {calc.isFuel && (calc.surcharge ?? 0) > 0 && (
              <View style={styles.savingsItem}>
                <Text style={[styles.savingsLabel, { color: colors.error }]}>Surcharge ~1.08%</Text>
                <Text style={[styles.savingsValue, { color: colors.error }]}>-{formatCur(calc.surcharge ?? 0)}</Text>
              </View>
            )}
            {calc.happyCoins > 0 && (
              <View style={styles.savingsItem}>
                <Text style={styles.savingsLabel}>Happy Coins 1.5%</Text>
                <Text style={styles.savingsValue}>+{formatCur(calc.happyCoins)}</Text>
              </View>
            )}
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>NET SAVINGS</Text>
            <Text style={styles.totalValue}>+{formatCur(calc.totalSavings)}</Text>
          </View>
          {calc.isFuel && (
            <Text style={styles.capNote}>
              Fuel cap: ₹12,000/cycle · 1.08% surcharge deducted · Happy Coins cap: ₹10,000
            </Text>
          )}
          {!calc.isFuel && (
            <Text style={styles.capNote}>
              Grocery & Utility cap: ₹2,000/cycle (max 400 RP)
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  amountWrap: { flex: 1 },
  storeWrap: { flex: 1.5 },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 40,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: '500',
  },
  scenariosScroll: {
    maxHeight: 36,
  },
  scenarioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: rounded.full,
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
    marginRight: 8,
  },
  scenarioPillActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryContainer,
  },
  scenarioText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  scenarioTextActive: {
    color: '#fff',
  },
  resultsSection: {
    gap: 10,
  },
  resultsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultCard: {
    backgroundColor: colors.background,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderLeftWidth: 3,
    padding: 12,
    gap: 8,
  },
  resultCardBest: {
    borderColor: `${colors.primaryContainer}30`,
    backgroundColor: `${colors.primaryContainer}08`,
  },
  resultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  cardMeta: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: rounded.full,
  },
  bestBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
  },
  resultMetrics: {
    flexDirection: 'row',
    gap: 24,
    paddingVertical: 4,
  },
  metric: {
    gap: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.onSurface,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  reason: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: rounded.DEFAULT,
  },
  warningText: {
    fontSize: 10,
    color: '#F59E0B',
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: rounded.DEFAULT,
    backgroundColor: `${colors.primary}08`,
    borderWidth: 1,
    borderColor: `${colors.primary}15`,
  },
  toolButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  fuelCalc: {
    gap: 12,
    paddingTop: 4,
  },
  typeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 40,
    paddingHorizontal: 12,
  },
  typeToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  hpPayModes: {
    gap: 8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: rounded.DEFAULT,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 2,
  },
  modeBtnActive: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primaryContainer,
  },
  modeBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  modeBtnTextActive: {
    color: colors.primary,
  },
  modeRate: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.onSurface,
  },
  modeRateActive: {
    color: colors.primary,
  },
  savingsCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
    padding: 14,
    gap: 12,
  },
  savingsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  savingsItem: {
    alignItems: 'center',
    gap: 4,
  },
  savingsLabel: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  savingsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.onSurface,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.15)',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
  },
  capNote: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
