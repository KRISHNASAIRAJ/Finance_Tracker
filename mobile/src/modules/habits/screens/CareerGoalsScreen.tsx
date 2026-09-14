/**
 * CareerGoalsScreen — 2025→2031 roadmap timeline with year goals.
 * Long-press a goal item to edit/delete it; long-press a year card header to
 * edit the year title/emoji or add goals.
 */
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
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { tc } from '../../../shared/theme/tracend';
import Entrance from '../../../shared/components/Entrance';
import { CareerGoalYear, effectiveGoals, currentYearGoalsFrom } from '../../../shared/careerGoals';
import { useCareerGoalsStore } from '../careerGoalsStore';
import { useAuth } from '../../../services/AuthProvider';
import { MoreStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

export default function CareerGoalsScreen() {
  const navigation = useNavigation<Nav>();
  const now = new Date();
  const currentYear = now.getFullYear();
  const overrides = useCareerGoalsStore((s) => s.overrides);
  const setOverrides = useCareerGoalsStore((s) => s.setOverrides);
  const { user } = useAuth();

  const goals = effectiveGoals(overrides);
  const activeGoals = currentYearGoalsFrom(goals, now);

  // ---- item edit modal state ----
  const [itemEdit, setItemEdit] = useState<{ year: number; index: number; text: string } | null>(null);
  // ---- year edit modal state ----
  const [yearEdit, setYearEdit] = useState<{ year: number; title: string; emoji: string } | null>(null);
  // ---- add-goal modal state ----
  const [adding, setAdding] = useState<{ year: number; text: string } | null>(null);

  const mutateGoals = (fn: (list: CareerGoalYear[]) => CareerGoalYear[]) => {
    const next = fn(goals.map((g) => ({ ...g, items: [...g.items] })));
    setOverrides(next, user?.id);
  };

  const saveItemEdit = () => {
    if (!itemEdit) return;
    const text = itemEdit.text.trim();
    if (!text) return;
    mutateGoals((list) =>
      list.map((g) =>
        g.year === itemEdit.year
          ? { ...g, items: g.items.map((it, i) => (i === itemEdit.index ? text : it)) }
          : g
      )
    );
    setItemEdit(null);
  };

  const deleteItem = (year: number, index: number) => {
    Alert.alert('Delete goal?', 'This goal will be removed from your roadmap.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          mutateGoals((list) =>
            list.map((g) => (g.year === year ? { ...g, items: g.items.filter((_, i) => i !== index) } : g))
          ),
      },
    ]);
  };

  const saveYearEdit = () => {
    if (!yearEdit) return;
    const title = yearEdit.title.trim();
    const emoji = yearEdit.emoji.trim();
    if (!title) return;
    mutateGoals((list) =>
      list.map((g) => (g.year === yearEdit.year ? { ...g, title, emoji: emoji || '🎯' } : g))
    );
    setYearEdit(null);
  };

  const saveAddGoal = () => {
    if (!adding) return;
    const text = adding.text.trim();
    if (!text) return;
    mutateGoals((list) =>
      list.map((g) => (g.year === adding.year ? { ...g, items: [...g.items, text] } : g))
    );
    setAdding(null);
  };

  const resetToDefault = () => {
    Alert.alert('Reset roadmap?', 'All your edits will be replaced with the original roadmap.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setOverrides(null, user?.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Career Goals</Text>
        <TouchableOpacity style={styles.appBarSide} onPress={resetToDefault} activeOpacity={0.7}>
          <Ionicons name="refresh" size={18} color={tc.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Entrance index={0}>
          <Text style={styles.hintText}>Long-press a goal to edit · long-press a year to rename</Text>
        </Entrance>

        {activeGoals && (
          <Entrance index={0}>
            <View style={styles.activeBanner}>
              <LinearGradient
                colors={['rgba(139,149,255,0.16)', 'rgba(79,219,204,0.08)', 'rgba(0,0,0,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <Text style={styles.activeLabel}>FOCUS YEAR</Text>
              <Text style={styles.activeTitle}>
                {activeGoals.emoji} {activeGoals.year} · {activeGoals.title}
              </Text>
              <Text style={styles.activeCount}>
                {activeGoals.items.length} goals this year — the mission is personal.
              </Text>
            </View>
          </Entrance>
        )}

        {goals.map((g, idx) => {
          const isPast = g.year < currentYear;
          const isActive = g.year === currentYear;
          return (
            <Entrance key={g.year} index={idx + 1}>
              <View style={[styles.yearCard, isActive && styles.yearCardActive]}>
                <TouchableOpacity
                  style={styles.yearHeadRow}
                  onLongPress={() => setYearEdit({ year: g.year, title: g.title, emoji: g.emoji })}
                  delayLongPress={400}
                  activeOpacity={0.8}
                >
                  <View style={styles.yearBadge}>
                    <Text style={[styles.yearBadgeText, isActive && styles.yearBadgeTextActive]}>{g.year}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.yearTitle}>
                      {g.emoji} {g.title}
                    </Text>
                    {isActive && <Text style={styles.yearNow}>THIS YEAR</Text>}
                    {isPast && <Text style={styles.yearDone}>Foundation laid 🌱</Text>}
                  </View>
                </TouchableOpacity>
                <View style={styles.itemList}>
                  {g.items.map((it, i) => (
                    <TouchableOpacity
                      key={`${g.year}-${i}`}
                      style={styles.itemRow}
                      onLongPress={() => setItemEdit({ year: g.year, index: i, text: it })}
                      delayLongPress={400}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.itemDot, isPast && styles.itemDotDone]} />
                      <Text style={[styles.itemText, isPast && styles.itemTextDone]}>{it}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.addItemRow}
                    onPress={() => setAdding({ year: g.year, text: '' })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={14} color="rgba(139,149,255,0.8)" />
                    <Text style={styles.addItemText}>Add goal for {g.year}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Entrance>
          );
        })}
      </ScrollView>

      {/* Edit goal item */}
      <Modal visible={!!itemEdit} transparent animationType="fade" onRequestClose={() => setItemEdit(null)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setItemEdit(null)} activeOpacity={1}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit goal</Text>
            <TextInput
              style={styles.modalInput}
              value={itemEdit?.text ?? ''}
              onChangeText={(t) => setItemEdit((prev) => (prev ? { ...prev, text: t } : prev))}
              placeholder="Goal text"
              placeholderTextColor={tc.textMuted}
              autoFocus
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => {
                  if (itemEdit) deleteItem(itemEdit.year, itemEdit.index);
                  setItemEdit(null);
                }}
              >
                <Text style={styles.modalBtnGhostText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={saveItemEdit}>
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit year meta */}
      <Modal visible={!!yearEdit} transparent animationType="fade" onRequestClose={() => setYearEdit(null)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setYearEdit(null)} activeOpacity={1}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit {yearEdit?.year}</Text>
            <TextInput
              style={styles.modalInput}
              value={yearEdit?.emoji ?? ''}
              onChangeText={(t) => setYearEdit((prev) => (prev ? { ...prev, emoji: t } : prev))}
              placeholder="Emoji"
              placeholderTextColor={tc.textMuted}
            />
            <TextInput
              style={styles.modalInput}
              value={yearEdit?.title ?? ''}
              onChangeText={(t) => setYearEdit((prev) => (prev ? { ...prev, title: t } : prev))}
              placeholder="Year title"
              placeholderTextColor={tc.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setYearEdit(null)}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={saveYearEdit}>
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add goal */}
      <Modal visible={!!adding} transparent animationType="fade" onRequestClose={() => setAdding(null)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setAdding(null)} activeOpacity={1}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add goal for {adding?.year}</Text>
            <TextInput
              style={styles.modalInput}
              value={adding?.text ?? ''}
              onChangeText={(t) => setAdding((prev) => (prev ? { ...prev, text: t } : prev))}
              placeholder="e.g. Net worth ₹3 lakh"
              placeholderTextColor={tc.textMuted}
              autoFocus
              onSubmitEditing={saveAddGoal}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setAdding(null)}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={saveAddGoal}>
                <Text style={styles.modalBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
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
    paddingHorizontal: spacing.containerPadding,
    paddingVertical: 8,
    gap: 8,
  },
  appBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  appBarSide: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.containerPadding,
    gap: spacing.stackGapMd,
    paddingBottom: 100,
  },
  activeBanner: {
    borderRadius: rounded.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139,149,255,0.3)',
    padding: 18,
    overflow: 'hidden',
    gap: 6,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(139,149,255,0.9)',
    letterSpacing: 2,
  },
  activeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  activeCount: {
    fontSize: 12,
    color: tc.textMuted,
  },
  yearCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: rounded.xl,
    padding: 16,
    gap: 12,
  },
  yearCardActive: {
    borderColor: 'rgba(139,149,255,0.45)',
    backgroundColor: 'rgba(139,149,255,0.07)',
  },
  yearHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  yearBadge: {
    width: 56,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
  },
  yearBadgeTextActive: { color: '#8b95ff' },
  yearTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  yearNow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8b95ff',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  yearDone: {
    fontSize: 10,
    color: 'rgba(79,219,204,0.75)',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  itemList: { gap: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 5,
  },
  itemDotDone: { backgroundColor: 'rgba(79,219,204,0.8)' },
  itemText: {
    flex: 1,
    fontSize: 13,
    color: tc.textPrimary,
    lineHeight: 18,
  },
  itemTextDone: {
    color: tc.textMuted,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 17,
  },
  addItemText: {
    fontSize: 12,
    color: 'rgba(139,149,255,0.8)',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#14141F',
    borderRadius: rounded.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: rounded.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tc.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    backgroundColor: '#8b95ff',
    borderRadius: rounded.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A0A10',
  },
  modalBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalBtnGhostText: {
    fontSize: 13,
    fontWeight: '700',
    color: tc.textMuted,
  },
});
