/**
 * BuyListScreen — Personal buy list: name, price, optional reminder date,
 * link, notes, and a completed tick. Reminders are scheduled locally via
 * notificationService for items that have a date.
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
  Linking,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { usePersonalStore, BuyListItem } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import CalendarPicker from '../../../shared/components/CalendarPicker';

function fmtPrice(paise: number): string {
  if (!paise) return '';
  return (paise / 100).toString();
}

export default function BuyListScreen() {
  const navigation = useNavigation();
  const { buyListItems, addBuyItem, updateBuyItem, deleteBuyItem, toggleBuyItem } = usePersonalStore();
  const { user } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [itemDate, setItemDate] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);

  const pending = buyListItems.filter((i) => !i.completed);
  const done = buyListItems.filter((i) => i.completed);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setItemDate(null);
    setLink('');
    setNotes('');
  };

  const openEdit = (item: BuyListItem) => {
    setEditingId(item.id);
    setName(item.name);
    setPrice(fmtPrice(item.price));
    setItemDate(item.itemDate);
    setLink(item.link || '');
    setNotes(item.notes || '');
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter the item name.');
      return;
    }
    const pricePaise = price.trim() ? Math.round(parseFloat(price) * 100) || 0 : 0;
    const fields = {
      name: name.trim(),
      price: pricePaise,
      itemDate,
      link: link.trim(),
      notes: notes.trim(),
    };
    if (editingId) {
      updateBuyItem(editingId, fields, user?.id);
    } else {
      addBuyItem(fields, user?.id);
    }
    resetForm();
    setModalVisible(false);
  };

  const openLink = async (url: string) => {
    try {
      const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      await Linking.openURL(normalized);
    } catch {
      Alert.alert('Cannot open link', url);
    }
  };

  const renderItem = (item: BuyListItem) => (
    <View key={item.id} style={[styles.itemCard, item.completed && styles.itemCardDone]}>
      <TouchableOpacity style={styles.tickBtn} onPress={() => toggleBuyItem(item.id, user?.id)}>
        <Ionicons
          name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={item.completed ? colors.success : colors.outline}
        />
      </TouchableOpacity>
      <View style={styles.itemMain}>
        <Text style={[styles.itemName, item.completed && styles.itemNameDone]}>{item.name}</Text>
        <View style={styles.metaRow}>
          {item.price > 0 && (
            <Text style={styles.metaPrice}>
              {'\u20B9'}{(item.price / 100).toLocaleString('en-IN')}
            </Text>
          )}
          {item.itemDate && (
            <View style={styles.metaBadge}>
              <Ionicons name="calendar-outline" size={11} color={colors.primary} />
              <Text style={styles.metaText}>
                {new Date(item.itemDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          )}
          {item.link ? (
            <TouchableOpacity style={styles.metaBadge} onPress={() => openLink(item.link)}>
              <Ionicons name="link-outline" size={11} color={colors.primary} />
              <Text style={[styles.metaText, { textDecorationLine: 'underline' }]}>Link</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity onPress={() => openEdit(item)} style={{ padding: 4 }}>
          <Ionicons name="create-outline" size={16} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            deleteBuyItem(item.id, user?.id);
          }}
          style={{ padding: 4 }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Buy List</Text>
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
        {buyListItems.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={48} color={colors.outline} />
            <Text style={styles.emptyText}>Buy list is empty</Text>
            <Text style={styles.emptySubtext}>Tap + to add things you want to buy</Text>
          </View>
        )}

        {pending.length > 0 && (
          <Text style={styles.sectionLabel}>TO BUY ({pending.length})</Text>
        )}
        {pending.map(renderItem)}

        {done.length > 0 && (
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>COMPLETED ({done.length})</Text>
        )}
        {done.map(renderItem)}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Item' : 'Add to Buy List'}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NAME</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Running shoes"
                placeholderTextColor={colors.outline}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>PRICE (OPTIONAL)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 2499"
                  placeholderTextColor={colors.outline}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>DATE (OPTIONAL)</Text>
                <TouchableOpacity style={styles.dateTrigger} onPress={() => setCalendarVisible(true)}>
                  <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                  <Text style={styles.dateTriggerText} numberOfLines={1}>
                    {itemDate
                      ? new Date(itemDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                      : 'Remind me'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {itemDate && (
              <TouchableOpacity style={styles.clearDate} onPress={() => setItemDate(null)}>
                <Ionicons name="close-circle" size={16} color={colors.error} />
                <Text style={styles.clearDateText}>Clear reminder date</Text>
              </TouchableOpacity>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>LINK (OPTIONAL)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. https://amazon.in/..."
                placeholderTextColor={colors.outline}
                value={link}
                onChangeText={setLink}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                placeholder="Size, colour, why you want it..."
                placeholderTextColor={colors.outline}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Text style={styles.submitButtonText}>{editingId ? 'Update' : 'Add Item'}</Text>
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
          </View>
        </View>

        <CalendarPicker
          visible={calendarVisible}
          selected={itemDate ? new Date(itemDate + 'T00:00:00') : new Date()}
          onSelect={(d: Date) => {
            setItemDate(
              new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
            );
            setCalendarVisible(false);
          }}
          onClose={() => setCalendarVisible(false)}
        />
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
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 14,
    gap: 10,
  },
  itemCardDone: {
    opacity: 0.55,
  },
  tickBtn: {
    padding: 2,
  },
  itemMain: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
  },
  itemNameDone: {
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
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
  metaText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  itemNotes: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 4,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
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
    minHeight: 70,
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
  clearDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  clearDateText: {
    fontSize: 12,
    color: colors.error,
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
