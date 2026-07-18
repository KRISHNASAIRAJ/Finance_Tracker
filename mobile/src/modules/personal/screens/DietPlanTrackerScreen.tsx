import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { usePersonalStore } from '../store';
import { requestNotificationPermissions, scheduleDietNotifications } from '../../../services/dietNotifications';

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const SLOT_META: Record<MealSlot, { label: string; icon: string; color: string; bg: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline', color: colors.primary, bg: `${colors.primary}15` },
  lunch:     { label: 'Lunch',     icon: 'restaurant-outline', color: '#f59e0b', bg: '#f59e0b20' },
  dinner:    { label: 'Dinner',    icon: 'moon-outline', color: '#3b82f6', bg: '#3b82f620' },
  snack:     { label: 'Snack',     icon: 'nutrition-outline', color: colors.success, bg: `${colors.success}15` },
};

export default function DietPlanTrackerScreen() {
  const navigation = useNavigation();
  const { meals, updateMealSlot } = usePersonalStore();

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const activePlan = meals.find((m) => m.day === selectedDay) || meals[0];

  useEffect(() => {
    (async () => {
      const granted = await requestNotificationPermissions();
      if (granted) {
        const mealMap: Record<string, typeof meals[0]> = {};
        meals.forEach((m) => { mealMap[m.day] = m; });
        await scheduleDietNotifications(mealMap);
      }
    })();
  }, []);

  const [editVisible, setEditVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState<MealSlot>('breakfast');
  const [editValue, setEditValue] = useState('');

  const openEdit = (slot: MealSlot) => {
    setEditingSlot(slot);
    setEditValue(activePlan[slot]);
    setEditVisible(true);
  };

  const handleSave = () => {
    updateMealSlot(selectedDay, editingSlot, editValue.trim());
    setEditVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.logoText}>Diet Planner</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Day Selector Scroll */}
      <View style={styles.daySelectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
          {DAYS.map((day) => {
            const isSelected = selectedDay === day;
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, isSelected && styles.dayButtonActive]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>
                  {day.substring(0, 3)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>{selectedDay}'s Nutrition Plan</Text>

        <View style={styles.slotsContainer}>
          {(Object.keys(SLOT_META) as MealSlot[]).map((slot) => {
            const meta = SLOT_META[slot];
            const value = activePlan[slot];
            return (
              <TouchableOpacity
                key={slot}
                style={styles.mealSlotCard}
                activeOpacity={0.7}
                onPress={() => openEdit(slot)}
              >
                <View style={styles.slotHeader}>
                  <View style={[styles.iconWrapper, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                  </View>
                  <Text style={styles.slotTitle}>{meta.label}</Text>
                  <Ionicons name="create-outline" size={14} color={colors.outline} style={styles.editIcon} />
                </View>
                <Text style={styles.mealName}>{value || 'Tap to add'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Edit Meal Modal */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit {SLOT_META[editingSlot].label}
            </Text>
            <Text style={styles.modalSub}>{selectedDay}</Text>

            <TextInput
              style={styles.textInput}
              placeholder={`e.g. ${SLOT_META[editingSlot].label} meal`}
              placeholderTextColor={colors.outline}
              value={editValue}
              onChangeText={setEditValue}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setEditVisible(false)}
              >
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSave}>
                <Text style={styles.modalBtnTextSave}>Save</Text>
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
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  daySelectorContainer: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  dayScroll: {
    paddingHorizontal: spacing.containerPadding,
    gap: 8,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
  },
  dayButtonActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  dayTextActive: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 8,
  },
  slotsContainer: {
    gap: 12,
  },
  mealSlotCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 16,
    gap: 10,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    flex: 1,
  },
  editIcon: {
    marginLeft: 'auto',
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    paddingLeft: 42,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: -8,
  },
  textInput: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 48,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: 'transparent',
  },
  modalBtnSave: {
    backgroundColor: colors.primaryContainer,
  },
  modalBtnTextCancel: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  modalBtnTextSave: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
});
