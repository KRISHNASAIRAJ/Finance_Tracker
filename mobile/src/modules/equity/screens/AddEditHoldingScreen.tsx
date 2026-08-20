/**
 * AddEditHoldingScreen — form to create or edit a holding (equity/MF/ETF/other)
 * with fields for quantity, price, source, SIP, and allocation category.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useInvestmentsStore, Holding } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { queueHoldingSync } from '../hooks/useEquitySync';

type RouteParams = {
  AddEditHolding: { holdingId?: string } | undefined;
};

export default function AddEditHoldingScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'AddEditHolding'>>();
  const { user } = useAuth();
  const holdingId = route.params?.holdingId;
  const existing = holdingId
    ? useInvestmentsStore((s) => s.holdings.find((h) => h.id === holdingId))
    : undefined;
  const isEdit = !!existing;

  const [symbol, setSymbol] = useState(existing?.symbol ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<Holding['type']>(existing?.type ?? 'equity');
  const [quantity, setQuantity] = useState(existing ? String(existing.quantity) : '');
  const [avgPrice, setAvgPrice] = useState(existing ? String(existing.avgPrice / 100) : '');
  const [currentPrice, setCurrentPrice] = useState(existing ? String(existing.currentPrice / 100) : '');
  const [folio, setFolio] = useState(existing?.folio ?? '');
  const [amc, setAmc] = useState(existing?.amc ?? '');
  const [schemeCode, setSchemeCode] = useState(existing?.schemeCode ?? '');
  const [isin, setIsin] = useState(existing?.isin ?? '');
  const [sipAmount, setSipAmount] = useState(existing?.sipAmount ? String(existing.sipAmount / 100) : '');
  const [sipDay, setSipDay] = useState(existing?.sipDay ? String(existing.sipDay) : '');

  const types: Holding['type'][] = ['equity', 'mf', 'etf', 'other'];

  const handleSave = () => {
    if (!symbol.trim() || !name.trim() || !quantity || !avgPrice) {
      Alert.alert('Missing fields', 'Symbol, name, quantity, and avg price are required.');
      return;
    }

    const qty = parseFloat(quantity);
    const avg = Math.round(parseFloat(avgPrice) * 100);
    const curr = currentPrice ? Math.round(parseFloat(currentPrice) * 100) : avg;
    const sipPaise = sipAmount ? Math.round(parseFloat(sipAmount) * 100) : undefined;
    const sipDayNum = sipDay ? parseInt(sipDay, 10) : undefined;

    if (isNaN(qty) || isNaN(avg)) {
      Alert.alert('Invalid numbers', 'Quantity and price must be valid numbers.');
      return;
    }

    const mfFields = type === 'mf'
      ? { folio: folio.trim() || undefined, amc: amc.trim() || undefined, schemeCode: schemeCode.trim() || undefined, isin: isin.trim() || undefined, sipAmount: sipPaise, sipDay: sipDayNum }
      : {};

    const store = useInvestmentsStore.getState();

    if (isEdit && holdingId) {
      store.updateHolding(holdingId, {
        symbol: symbol.trim().toUpperCase(),
        name: name.trim(),
        type,
        quantity: qty,
        avgPrice: avg,
        currentPrice: curr,
        ...mfFields,
      });
      if (user) {
        queueHoldingSync(user.id, 'update', {
          id: holdingId,
          symbol: symbol.trim().toUpperCase(),
          name: name.trim(),
          type,
          quantity: qty,
          avgPrice: avg,
          currentPrice: curr,
          ...mfFields,
        });
      }
    } else {
      const id = store.addHolding({
        symbol: symbol.trim().toUpperCase(),
        name: name.trim(),
        type,
        quantity: qty,
        avgPrice: avg,
        currentPrice: curr,
        source: 'manual',
        ...mfFields,
      });
      if (user) {
        queueHoldingSync(user.id, 'create', {
          id,
          symbol: symbol.trim().toUpperCase(),
          name: name.trim(),
          type,
          quantity: qty,
          avgPrice: avg,
          currentPrice: curr,
          source: 'manual' as const,
          ...mfFields,
        });
      }
    }

    navigation.goBack();
  };

  const handleDelete = () => {
    if (!holdingId) return;
    Alert.alert('Delete Holding', `Remove ${existing?.symbol} from your portfolio?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          useInvestmentsStore.getState().deleteHolding(holdingId);
          if (user) queueHoldingSync(user.id, 'delete', { id: holdingId });
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Symbol */}
        <Text style={styles.label}>{type === 'mf' ? 'ISIN / Scheme Code' : 'Symbol'}</Text>
        <TextInput
          style={styles.input}
          value={symbol}
          onChangeText={setSymbol}
          placeholder={type === 'mf' ? 'e.g. INF879O01100' : 'e.g. RELIANCE'}
          placeholderTextColor={colors.outline}
          autoCapitalize="characters"
        />

        {/* Name */}
        <Text style={styles.label}>{type === 'mf' ? 'Scheme Name' : 'Company / Fund Name'}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Reliance Industries Ltd."
          placeholderTextColor={colors.outline}
        />

        {/* Type selector */}
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow}>
          {types.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, type === t && styles.typeBtnActive]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quantity */}
        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.outline}
        />

        {/* Avg Buy Price */}
        <Text style={styles.label}>Average Buy Price (₹)</Text>
        <TextInput
          style={styles.input}
          value={avgPrice}
          onChangeText={setAvgPrice}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.outline}
        />

        {/* Current Price */}
        <Text style={styles.label}>Current Price (₹) — optional</Text>
        <TextInput
          style={styles.input}
          value={currentPrice}
          onChangeText={setCurrentPrice}
          keyboardType="decimal-pad"
          placeholder="Same as buy price"
          placeholderTextColor={colors.outline}
        />

        {/* MF-specific fields */}
        {type === 'mf' && (
          <>
            <View style={styles.divider} />

            {/* Folio Number */}
            <Text style={styles.label}>Folio Number</Text>
            <TextInput
              style={styles.input}
              value={folio}
              onChangeText={setFolio}
              placeholder="e.g. 12345678"
              placeholderTextColor={colors.outline}
            />

            {/* AMC */}
            <Text style={styles.label}>AMC (Fund House)</Text>
            <TextInput
              style={styles.input}
              value={amc}
              onChangeText={setAmc}
              placeholder="e.g. SBI Mutual Fund"
              placeholderTextColor={colors.outline}
            />

            {/* Scheme Code */}
            <Text style={styles.label}>Scheme Code</Text>
            <TextInput
              style={styles.input}
              value={schemeCode}
              onChangeText={setSchemeCode}
              placeholder="e.g. INF200K01XX1"
              placeholderTextColor={colors.outline}
              autoCapitalize="characters"
            />

            {/* ISIN */}
            <Text style={styles.label}>ISIN</Text>
            <TextInput
              style={styles.input}
              value={isin}
              onChangeText={setIsin}
              placeholder="e.g. INF209K01EH4"
              placeholderTextColor={colors.outline}
              autoCapitalize="characters"
            />

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>SIP Details (Optional)</Text>

            {/* SIP Amount */}
            <Text style={styles.label}>Monthly SIP Amount (₹)</Text>
            <TextInput
              style={styles.input}
              value={sipAmount}
              onChangeText={setSipAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.outline}
            />

            {/* SIP Day */}
            <Text style={styles.label}>SIP Day of Month (1-28)</Text>
            <TextInput
              style={styles.input}
              value={sipDay}
              onChangeText={setSipDay}
              keyboardType="number-pad"
              placeholder="1-28"
              placeholderTextColor={colors.outline}
            />
          </>
        )}

        {/* Save */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>{isEdit ? 'Update Holding' : 'Add Holding'}</Text>
        </TouchableOpacity>

        {/* Delete */}
        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.deleteBtnText}>Delete Holding</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: 12,
    paddingBottom: 40,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginBottom: -6,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.onSurface,
    fontSize: 16,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  typeBtnActive: {
    backgroundColor: `${colors.primary}20`,
    borderColor: colors.primary,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  typeBtnTextActive: {
    color: colors.primary,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: rounded.DEFAULT,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.error}30`,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surface,
    marginVertical: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.tertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
