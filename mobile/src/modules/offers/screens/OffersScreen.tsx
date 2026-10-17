/**
 * OffersScreen — discount offers / coupons with coupon codes, minimum spend
 * and expiry reminders (3 & 2 days before expiry at 6 PM IST).
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { useOffersStore, Offer, isExpired, daysUntilExpiry } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import CalendarPicker from '../../../shared/components/CalendarPicker';

const CATEGORIES = ['Shopping', 'Food', 'Travel', 'Entertainment', 'Fuel', 'Bills', 'Other'];

function todayISO(): string {
  return new Date(daysAhead(0)).toISOString().slice(0, 10);
}

function daysAhead(days: number): number {
  return Date.now() + 5.5 * 3600000 + days * 86400000;
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function fmtAmount(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function OffersScreen() {
  const navigation = useNavigation();
  const { offers, addOffer, updateOffer, deleteOffer } = useOffersStore();
  const { user } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [minSpend, setMinSpend] = useState('');
  const [expiresOn, setExpiresOn] = useState<string>(todayISO());
  const [notes, setNotes] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);

  const active = offers
    .filter((o) => !isExpired(o))
    .sort((a, b) => (a.expiresOn < b.expiresOn ? -1 : 1));
  const expired = offers
    .filter((o) => isExpired(o))
    .sort((a, b) => (a.expiresOn > b.expiresOn ? -1 : 1));

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setMerchant('');
    setCategory('');
    setCouponCode('');
    setDiscountValue('');
    setMinSpend('');
    setExpiresOn(todayISO());
    setNotes('');
  };

  const openEdit = (offer: Offer) => {
    setEditingId(offer.id);
    setTitle(offer.title);
    setMerchant(offer.merchant);
    setCategory(offer.category);
    setCouponCode(offer.couponCode);
    setDiscountValue(offer.discountValue);
    setMinSpend(offer.minSpendPaise ? String(offer.minSpendPaise / 100) : '');
    setExpiresOn(offer.expiresOn || todayISO());
    setNotes(offer.notes);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter the offer name.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
      Alert.alert('Missing expiry', 'Please pick the offer expiry date.');
      return;
    }
    const fields = {
      title: title.trim(),
      merchant: merchant.trim(),
      category: category.trim(),
      couponCode: couponCode.trim(),
      discountValue: discountValue.trim(),
      minSpendPaise: minSpend.trim() ? Math.round(parseFloat(minSpend) * 100) || null : null,
      expiresOn,
      notes: notes.trim(),
    };
    if (editingId) {
      updateOffer(editingId, fields, user?.id);
    } else {
      addOffer(fields, user?.id);
    }
    resetForm();
    setModalVisible(false);
  };

  const confirmDelete = (offer: Offer) => {
    Alert.alert('Delete offer', `Remove "${offer.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteOffer(offer.id, user?.id) },
    ]);
  };

  const renderOffer = (offer: Offer) => {
    const daysLeft = daysUntilExpiry(offer);
    const isExp = isExpired(offer);
    const urgent = !isExp && daysLeft <= 3;
    return (
      <View key={offer.id} style={[styles.card, isExp && styles.cardExpired]}>
        <View style={styles.cardMain}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, isExp && styles.dim]} numberOfLines={1}>
              {offer.title}
            </Text>
            {offer.discountValue ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{offer.discountValue}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            {offer.merchant ? (
              <View style={styles.metaBadge}>
                <Ionicons name="storefront-outline" size={11} color={colors.textSecondary} />
                <Text style={styles.metaText}>{offer.merchant}</Text>
              </View>
            ) : null}
            {offer.category ? (
              <View style={styles.metaBadge}>
                <Ionicons name="pricetag-outline" size={11} color={colors.textSecondary} />
                <Text style={styles.metaText}>{offer.category}</Text>
              </View>
            ) : null}
            {offer.minSpendPaise ? (
              <View style={styles.metaBadge}>
                <Ionicons name="wallet-outline" size={11} color={colors.textSecondary} />
                <Text style={styles.metaText}>Min {'\u20B9'}{fmtAmount(offer.minSpendPaise)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.metaBadge, urgent && styles.metaBadgeUrgent]}>
              <Ionicons name="time-outline" size={11} color={urgent ? colors.error : colors.primary} />
              <Text style={[styles.metaText, urgent && { color: colors.error, fontWeight: '700' }]}>
                {isExp
                  ? `Expired ${fmtDate(offer.expiresOn)}`
                  : daysLeft === 0
                    ? 'Expires today!'
                    : daysLeft === 1
                      ? 'Expires tomorrow'
                      : `Expires ${fmtDate(offer.expiresOn)} · ${daysLeft}d left`}
              </Text>
            </View>
          </View>

          {offer.couponCode ? (
            <View style={styles.couponRow}>
              <Ionicons name="ticket-outline" size={13} color={colors.primary} />
              <Text style={styles.couponText}>{offer.couponCode}</Text>
            </View>
          ) : null}
          {offer.notes ? <Text style={styles.cardNotes}>{offer.notes}</Text> : null}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEdit(offer)} style={{ padding: 4 }}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(offer)} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Offers</Text>
        <TouchableOpacity
          style={styles.fabSmall}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {offers.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="pricetags-outline" size={48} color={colors.outline} />
            <Text style={styles.emptyText}>No offers saved</Text>
            <Text style={styles.emptySubtext}>
              Tap + to track coupon codes and expiry dates — you{'\u2019'}ll get a reminder before they lapse
            </Text>
          </View>
        )}

        {active.length > 0 && <Text style={styles.sectionLabel}>ACTIVE ({active.length})</Text>}
        {active.map(renderOffer)}

        {expired.length > 0 && (
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>EXPIRED ({expired.length})</Text>
        )}
        {expired.map(renderOffer)}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={{ maxHeight: '85%' }} contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Offer' : 'Add Offer'}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TITLE *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 10% off on Amazon Pay"
                placeholderTextColor={colors.outline}
                value={title}
                onChangeText={setTitle}
                autoFocus
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>MERCHANT / BANK</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. HDFC, Swiggy"
                  placeholderTextColor={colors.outline}
                  value={merchant}
                  onChangeText={setMerchant}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>EXPIRY *</Text>
                <TouchableOpacity style={styles.dateTrigger} onPress={() => setCalendarVisible(true)}>
                  <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                  <Text style={styles.dateTriggerText} numberOfLines={1}>
                    {expiresOn ? fmtDate(expiresOn) : 'Pick date'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CATEGORY</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, category === c && styles.chipActive]}
                    onPress={() => setCategory(category === c ? '' : c)}
                  >
                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>DISCOUNT</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 20% off"
                  placeholderTextColor={colors.outline}
                  value={discountValue}
                  onChangeText={setDiscountValue}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>MIN SPEND {'\u20B9'}</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 999"
                  placeholderTextColor={colors.outline}
                  value={minSpend}
                  onChangeText={setMinSpend}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>COUPON CODE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. SAVE200"
                placeholderTextColor={colors.outline}
                value={couponCode}
                onChangeText={setCouponCode}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOTES</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                placeholder="Terms, where to use..."
                placeholderTextColor={colors.outline}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.submitButton} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.submitButtonText}>{editingId ? 'Update' : 'Add Offer'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  resetForm();
                  setModalVisible(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <CalendarPicker
            visible={calendarVisible}
            selected={expiresOn ? new Date(expiresOn + 'T00:00:00') : new Date()}
            onSelect={(d: Date) => {
              setExpiresOn(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]);
              setCalendarVisible(false);
            }}
            onClose={() => setCalendarVisible(false)}
          />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.containerPadding,
    paddingVertical: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  fabSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.containerPadding,
    paddingBottom: 40,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 14,
    gap: 10,
  },
  cardExpired: {
    opacity: 0.55,
  },
  cardMain: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    flexShrink: 1,
  },
  dim: {
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  discountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.background,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  metaBadgeUrgent: {
    backgroundColor: `${colors.error}18`,
  },
  metaText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${colors.primary}14`,
    borderWidth: 1,
    borderColor: `${colors.primary}44`,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  couponText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.primary,
  },
  cardNotes: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.onSurface,
    fontSize: 14,
  },
  notesInput: {
    minHeight: 60,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateTriggerText: {
    fontSize: 13,
    color: colors.onSurface,
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  submitButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
