import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, autoDetectCategory } from '../../../shared/categoryMap';
import { FinanceStackParamList } from '../../../navigation/RootNavigator';

type RouteProps = RouteProp<FinanceStackParamList, 'SmsConfirmation'>;

const ENTRY_TYPES = [
  { key: 'expense', label: 'Expense', icon: 'arrow-down-circle-outline' as const },
  { key: 'income', label: 'Income', icon: 'arrow-up-circle-outline' as const },
  { key: 'lent', label: 'Lent', icon: 'people-outline' as const },
  { key: 'borrowed', label: 'Borrowed', icon: 'person-outline' as const },
  { key: 'bill', label: 'Bill Paid', icon: 'receipt-outline' as const },
];

export default function SmsConfirmationScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { smsData } = route.params;
  const { addTransaction, addReceivable } = useFinanceStore() as any;
  const { user } = useAuth();

  const parsedAmount = smsData.parsedAmount ? smsData.parsedAmount / 100 : 0;
  const defaultType = smsData.parsedType === 'credit' ? 'income' : 'expense';

  const [entryType, setEntryType] = useState<string>(defaultType);
  const [amount, setAmount] = useState(parsedAmount > 0 ? String(parsedAmount) : '');
  const [merchant, setMerchant] = useState(smsData.parsedMerchant || '');
  const [selectedCategory, setSelectedCategory] = useState(
    autoDetectCategory(merchant, 'expense')
  );
  const [personName, setPersonName] = useState('');
  const [notes, setNotes] = useState('');
  const [isManualCategory, setIsManualCategory] = useState(false);

  useEffect(() => {
    if (!isManualCategory && merchant) {
      setSelectedCategory(autoDetectCategory(merchant, entryType === 'income' ? 'income' : 'expense'));
    }
  }, [entryType, merchant]);

  const categoriesList = entryType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isPersonType = entryType === 'lent' || entryType === 'borrowed';
  const showCategorySelector = entryType === 'expense' || entryType === 'income' || entryType === 'bill';

  const handleSave = () => {
    const rawAmount = parseFloat(amount);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount');
      return;
    }
    const amountPaise = Math.round(rawAmount * 100);

    if (isPersonType) {
      if (!personName.trim()) {
        Alert.alert('Name required', 'Please enter the person name');
        return;
      }
      addReceivable({
        personName: personName.trim(),
        amount: amountPaise,
        note: notes.trim() || merchant,
        dueDate: new Date().toISOString(),
        type: entryType === 'lent' ? 'lent' : 'borrowed',
      }, user?.id);
    } else {
      addTransaction({
        type: entryType === 'expense' ? 'expense' :
              entryType === 'income' ? 'income' :
              entryType === 'bill' ? 'expense' : 'expense',
        amount: amountPaise,
        currency: 'INR',
        category: selectedCategory,
        notes: `${merchant}${notes.trim() ? ` — ${notes.trim()}` : ''}`,
        source: 'sms_auto',
      }, user?.id);
    }

    navigation.goBack();
    if (smsData.onDone) {
      setTimeout(() => smsData.onDone?.(), 100);
    }
  };

  const handleIgnore = () => {
    navigation.goBack();
  };

  const confidencePercent = Math.round((smsData.confidence || 0) * 100);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.appBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Confirm Transaction</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* SMS Preview */}
        <View style={styles.smsPreview}>
          <View style={styles.smsPreviewHeader}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.smsSender}>{smsData.senderId}</Text>
            <View
              style={[
                styles.confidenceBadge,
                {
                  backgroundColor:
                    confidencePercent >= 70
                      ? `${colors.success}20`
                      : 'rgba(245,158,11,0.12)',
                },
              ]}
            >
              <Text
                style={[
                  styles.confidenceText,
                  { color: confidencePercent >= 70 ? colors.success : '#f59e0b' },
                ]}
              >
                {confidencePercent}% match
              </Text>
            </View>
          </View>
          <Text style={styles.smsBody} numberOfLines={4}>
            {smsData.smsBody}
          </Text>
        </View>

        {/* Entry Type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TRANSACTION TYPE</Text>
          <View style={styles.typeRow}>
            {ENTRY_TYPES.map((t) => {
              const active = entryType === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => setEntryType(t.key)}
                >
                  <Ionicons
                    name={t.icon}
                    size={14}
                    color={active ? '#fff' : colors.onSurfaceVariant}
                  />
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AMOUNT (₹)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="0.00"
            placeholderTextColor={colors.outline}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        {/* Person name (for lent/borrowed) */}
        {isPersonType && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PERSON NAME</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter name"
              placeholderTextColor={colors.outline}
              value={personName}
              onChangeText={setPersonName}
            />
          </View>
        )}

        {/* Merchant */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MERCHANT / DESCRIPTION</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Amazon, Swiggy"
            placeholderTextColor={colors.outline}
            value={merchant}
            onChangeText={(t) => {
              setMerchant(t);
              if (!isManualCategory) {
                setSelectedCategory(autoDetectCategory(t, entryType === 'income' ? 'income' : 'expense'));
              }
            }}
          />
        </View>

        {/* Category */}
        {showCategorySelector && (
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>CATEGORY</Text>
              {!isManualCategory && merchant.trim() !== '' && (
                <View style={styles.autoBadge}>
                  <Ionicons name="flash" size={10} color={colors.primary} />
                  <Text style={styles.autoBadgeText}>Auto</Text>
                </View>
              )}
            </View>
            <View style={styles.categoryGrid}>
              {categoriesList.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[
                      styles.categoryChip,
                      isSelected && { backgroundColor: `${cat.color}20`, borderColor: cat.color },
                    ]}
                    onPress={() => {
                      setSelectedCategory(cat.name);
                      setIsManualCategory(true);
                    }}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={13}
                      color={isSelected ? cat.color : colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.categoryText,
                        isSelected && { color: cat.color, fontWeight: '700' },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTES (OPTIONAL)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Extra info..."
            placeholderTextColor={colors.outline}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Add Transaction</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ignoreButton} onPress={handleIgnore}>
            <Text style={styles.ignoreButtonText}>Ignore</Text>
          </TouchableOpacity>
        </View>
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
  scrollContent: { padding: spacing.containerPadding, gap: 16, paddingBottom: 40 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: { padding: 8, borderRadius: rounded.full },
  appBarTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  smsPreview: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.lg,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  smsPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smsSender: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: rounded.full,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  smsBody: {
    fontSize: 13,
    color: colors.onSurface,
    lineHeight: 18,
  },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  typeChipActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryContainer,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  typeChipTextActive: {
    color: '#fff',
  },
  textInput: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 44,
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: '500',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  autoBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  buttonContainer: { gap: 10, paddingTop: 8 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 16,
    borderRadius: rounded.lg,
    elevation: 6,
  },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  ignoreButton: { alignItems: 'center', paddingVertical: 12 },
  ignoreButtonText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
});
