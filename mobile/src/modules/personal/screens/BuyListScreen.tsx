/**
 * BuyListScreen — Personal buy list: name, price, optional reminder date,
 * link, notes, and a completed tick. Reminders are scheduled locally via
 * notificationService for items that have a date.
 *
 * Restyled to the Meridian v2 reference (s32): a "TO BUY" hero with a
 * completion ring and estimated total, flat checkbox rows with price/date/
 * link metadata, and a collapsible COMPLETED section.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr, clamp01 } from '../../../shared/theme/meridian';
import { Card, EmptyState, Label, PressScale, Ring, Screen, TopBar } from '../../../shared/components/meridian';
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
  const [showCompleted, setShowCompleted] = useState(true);

  const pending = buyListItems.filter((i) => !i.completed);
  const done = buyListItems.filter((i) => i.completed);
  const total = buyListItems.length;
  const pricedPending = pending.filter((i) => i.price > 0);
  const estimatedPaise = pricedPending.reduce((sum, i) => sum + i.price, 0);

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
    <Card key={item.id} style={[styles.itemCard, item.completed && styles.itemCardDone]}>
      <TouchableOpacity
        style={styles.tickBtn}
        onPress={() => toggleBuyItem(item.id, user?.id)}
        accessibilityLabel={item.completed ? `Mark ${item.name} not bought` : `Mark ${item.name} bought`}
      >
        <View style={[styles.checkbox, item.completed && styles.checkboxDone]}>
          {item.completed ? <Ionicons name="checkmark" size={13} color={mc.ink} /> : null}
        </View>
      </TouchableOpacity>

      <View style={styles.itemMain}>
        <Text style={[styles.itemName, item.completed && styles.itemNameDone]} numberOfLines={2}>
          {item.name}
        </Text>

        {item.price > 0 ? (
          <Text style={[styles.itemPrice, item.completed && styles.itemPriceDone]}>
            ₹{(item.price / 100).toLocaleString('en-IN')}
          </Text>
        ) : null}

        {(item.itemDate || item.link) ? (
          <View style={styles.metaRow}>
            {item.itemDate ? (
              <View style={styles.metaChip}>
                <Ionicons name="calendar-outline" size={10} color={mc.textDim} />
                <Text style={styles.metaChipText}>
                  {new Date(item.itemDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            ) : null}
            {item.link ? (
              <TouchableOpacity style={[styles.metaChip, styles.metaChipLink]} onPress={() => openLink(item.link)}>
                <Ionicons name="link-outline" size={10} color={mc.sky} />
                <Text style={[styles.metaChipText, { color: mc.sky }]}>Link</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {item.notes ? <Text style={styles.itemNotes} numberOfLines={2}>{item.notes}</Text> : null}
      </View>

      <View style={styles.itemActions}>
        <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityLabel={`Edit ${item.name}`}>
          <Ionicons name="pencil" size={16} color={mc.textGhost} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => deleteBuyItem(item.id, user?.id)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel={`Delete ${item.name}`}
        >
          <Ionicons name="trash-outline" size={16} color={mc.textGhost} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <Screen bottomInset={36}>
      <TopBar
        title="Buy list"
        onBack={() => navigation.goBack()}
        variant="center"
        right={
          <PressScale
            onPress={() => {
              resetForm();
              setModalVisible(true);
            }}
            scale={0.92}
            style={styles.addCircle}
            accessibilityLabel="Add item"
          >
            <Ionicons name="add" size={18} color={mc.white} />
          </PressScale>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Buy list is empty"
          subtitle="Tap + to add things you want to buy"
        />
      ) : (
        <Card style={styles.heroCard}>
          <Ring
            size={64}
            stroke={7}
            progress={clamp01(done.length / total)}
            color={mc.mint}
            trackColor={mc.track}
          >
            <Text style={styles.ringText}>
              {done.length}/{total}
            </Text>
          </Ring>
          <View style={styles.heroRight}>
            <Label>TO BUY</Label>
            <Text style={styles.heroValue}>
              {pending.length} {pending.length === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.heroCaption}>
              {pricedPending.length > 0
                ? `Estimated ₹${Math.round(estimatedPaise / 100).toLocaleString('en-IN')} (${pricedPending.length} priced)`
                : 'No prices set yet'}
            </Text>
          </View>
        </Card>
      )}

      {/* Pending items */}
      {pending.map(renderItem)}

      {/* Completed */}
      {done.length > 0 && (
        <TouchableOpacity style={styles.completedHeader} onPress={() => setShowCompleted((v) => !v)} activeOpacity={0.7}>
          <Label>COMPLETED ({done.length})</Label>
          <Text style={styles.completedToggle}>{showCompleted ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      )}
      {showCompleted && done.map(renderItem)}

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{editingId ? 'Edit item' : 'Add to buy list'}</Text>

            <View style={styles.inputGroup}>
              <Label small style={styles.inputLabel}>NAME</Label>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Running shoes"
                placeholderTextColor={mc.textGhost}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Label small style={styles.inputLabel}>PRICE (OPTIONAL)</Label>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 2499"
                  placeholderTextColor={mc.textGhost}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Label small style={styles.inputLabel}>DATE (OPTIONAL)</Label>
                <TouchableOpacity style={styles.dateTrigger} onPress={() => setCalendarVisible(true)} activeOpacity={0.8}>
                  <Ionicons name="calendar-outline" size={14} color={mc.redSoft} />
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
                <Ionicons name="close-circle" size={15} color={mc.redSoft} />
                <Text style={styles.clearDateText}>Clear reminder date</Text>
              </TouchableOpacity>
            )}

            <View style={styles.inputGroup}>
              <Label small style={styles.inputLabel}>LINK (OPTIONAL)</Label>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. https://amazon.in/..."
                placeholderTextColor={mc.textGhost}
                value={link}
                onChangeText={setLink}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.inputGroup}>
              <Label small style={styles.inputLabel}>NOTES (OPTIONAL)</Label>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                placeholder="Size, colour, why you want it..."
                placeholderTextColor={mc.textGhost}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.sheetButtons}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnCancel]} onPress={() => setModalVisible(false)}>
                <Text style={styles.sheetBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnSave]} onPress={handleSave}>
                <Text style={styles.sheetBtnSaveText}>{editingId ? 'Save changes' : 'Add item'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CalendarPicker
        visible={calendarVisible}
        selected={itemDate ? new Date(itemDate + 'T00:00:00') : new Date()}
        onSelect={(d) => {
          setItemDate(
            new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
          );
          setCalendarVisible(false);
        }}
        onClose={() => setCalendarVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringText: {
    fontSize: 13,
    fontWeight: '500',
    color: mc.text,
  },
  heroRight: {
    flex: 1,
    gap: 2,
  },
  heroValue: {
    fontSize: 24,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  heroCaption: {
    fontSize: 12,
    color: mc.textDim,
  },

  // Item rows
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
  },
  itemCardDone: {
    opacity: 0.55,
  },
  tickBtn: {
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: mc.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: mc.mint,
    borderColor: mc.mint,
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  itemName: {
    fontSize: 15,
    color: mc.text,
  },
  itemNameDone: {
    textDecorationLine: 'line-through',
    color: mc.textDim,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: mc.mint,
  },
  itemPriceDone: {
    color: mc.textDim,
    fontWeight: '400',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: mc.raised,
    borderRadius: mr.tag,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  metaChipLink: {
    backgroundColor: mc.skyDim,
  },
  metaChipText: {
    fontSize: 11,
    color: mc.textDim,
  },
  itemNotes: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 2,
  },

  // Completed header
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  completedToggle: {
    fontSize: 12,
    fontWeight: '600',
    color: mc.textDim,
  },

  // Bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: mc.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
    elevation: 24,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: mc.text,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  textInput: {
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: mc.text,
  },
  notesInput: {
    minHeight: 60,
    paddingTop: 12,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: mc.raised,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateTriggerText: {
    fontSize: 13,
    color: mc.text,
    flex: 1,
  },
  clearDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearDateText: {
    fontSize: 12,
    color: mc.redSoft,
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  sheetBtn: {
    paddingVertical: 13,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnCancel: {
    flex: 1,
    backgroundColor: mc.raised,
  },
  sheetBtnSave: {
    flex: 1.4,
    backgroundColor: mc.red,
  },
  sheetBtnCancelText: {
    fontSize: 14,
    color: mc.textDim,
  },
  sheetBtnSaveText: {
    fontSize: 15,
    color: mc.white,
    fontWeight: '500',
  },
});
