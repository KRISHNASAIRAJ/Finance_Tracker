/**
 * HabitTrackerScreen — Notion-style habit tracker: per-habit tick boxes for
 * today, daily completion %, per-habit streaks, and a monthly overview grid
 * (day columns × habit rows, ticked = filled cell) with month average.
 * Long-press a habit to edit its label/emoji, delete it, or add a new one.
 */
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import {
  HabitDef,
  todayKey,
  monthOf,
  shiftMonth,
  monthLabel,
  daysInMonth,
  dayProgress,
  dayPercent,
  habitStreak,
} from '../habits';
import { useHabitStore, habitsForDay, useHabitDefs } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { MoreStackParamList } from '../../../navigation/RootNavigator';
import { mc } from '../../../shared/theme/meridian';
import {
  Card,
  Label,
  PressScale,
  Ring,
  Rise,
  Screen,
} from '../../../shared/components/meridian';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

export default function HabitTrackerScreen() {
  const navigation = useNavigation<Nav>();
  const days = useHabitStore((s) => s.days);
  const setHabitOverrides = useHabitStore((s) => s.setHabitOverrides);
  const habitOverrides = useHabitStore((s) => s.habitOverrides);
  const { user } = useAuth();
  const HABITS = useHabitDefs();

  const [viewMonth, setViewMonth] = useState(monthOf(todayKey()));
  const [editHabit, setEditHabit] = useState<HabitDef | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitLabel, setNewHabitLabel] = useState('');
  const [newHabitEmoji, setNewHabitEmoji] = useState('');

  const today = todayKey();
  const ticked = habitsForDay(days, today);

  const habitsByDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of days) m.set(d.day, habitsForDay([d], d.day));
    return m;
  }, [days]);

  const monthDays = useMemo(() => {
    const n = daysInMonth(viewMonth);
    return Array.from({ length: n }, (_, i) => {
      const dd = String(i + 1).padStart(2, '0');
      return `${viewMonth}-${dd}`;
    });
  }, [viewMonth]);

  const monthAverage = useMemo(() => {
    const tracked = monthDays.filter((d) => habitsByDay.has(d));
    if (tracked.length === 0) return 0;
    const sum = tracked.reduce((s, d) => s + dayProgress(habitsByDay.get(d)!, HABITS), 0);
    return sum / tracked.length;
  }, [monthDays, habitsByDay, HABITS]);

  const todayIndex = monthDays.indexOf(today);

  const toggle = (habitKey: string) => {
    useHabitStore.getState().toggleHabit(today, habitKey, user?.id);
  };

  const streakFor = (key: string) =>
    habitStreak(key, (k) => habitsByDay.get(k) ?? []);

  // ---- habit editing (long-press) ----
  const openEditHabit = (h: HabitDef) => {
    setEditHabit(h);
    setEditLabel(h.label);
    setEditEmoji(h.emoji);
  };

  const saveHabitEdit = () => {
    if (!editHabit) return;
    const label = editLabel.trim();
    if (!label) return;
    const updated = HABITS.map((h) =>
      h.key === editHabit.key ? { ...h, label, emoji: editEmoji.trim() || h.emoji } : h
    );
    setHabitOverrides(updated, user?.id);
    setEditHabit(null);
  };

  const deleteHabit = (h: HabitDef) => {
    Alert.alert(
      'Remove habit?',
      `"${h.label}" will be removed from your tracker. Past ticks are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updated = HABITS.filter((x) => x.key !== h.key);
            setHabitOverrides(updated, user?.id);
            setEditHabit(null);
          },
        },
      ]
    );
  };

  const addHabit = () => {
    const label = newHabitLabel.trim();
    if (!label) return;
    const emoji = newHabitEmoji.trim() || '⭐';
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'habit';
    let key = base;
    let n = 2;
    while (HABITS.some((h) => h.key === key)) {
      key = `${base}_${n++}`;
    }
    setHabitOverrides([...HABITS, { key, label, emoji }], user?.id);
    setNewHabitLabel('');
    setNewHabitEmoji('');
    setShowAddHabit(false);
  };

  const resetHabitSet = () => {
    Alert.alert('Reset habits?', 'Your custom habits will be replaced with the original 10.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setHabitOverrides(null, user?.id) },
    ]);
  };

  return (
    <Screen bottomInset={40}>
      {/* Header */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale onPress={() => navigation.goBack()} scale={0.9} style={styles.iconButton} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <Text style={styles.appBarTitle}>Habit tracker</Text>
          <PressScale onPress={() => setShowAddHabit(true)} scale={0.9} style={styles.addBtn} accessibilityLabel="Add habit">
            <Ionicons name="add" size={19} color={mc.white} />
          </PressScale>
        </View>
      </Rise>

      {/* TODAY */}
      <Rise index={1}>
        <Card>
          <View style={styles.todayRow}>
            <Ring
              progress={dayProgress(ticked, HABITS)}
              size={56}
              stroke={7}
              color={mc.red}
            >
              <Text style={styles.ringText}>
                {ticked.length}/{HABITS.length}
              </Text>
            </Ring>
            <View style={styles.todayMain}>
              <Label color={mc.redSoft}>TODAY</Label>
              <Text style={styles.todayBig}>
                {ticked.length} of {HABITS.length} done
              </Text>
              <Text style={styles.todaySub}>Long-press a habit to edit</Text>
            </View>
            {habitOverrides && (
              <PressScale onPress={resetHabitSet} scale={0.9} accessibilityLabel="Reset habit list">
                <Ionicons name="refresh" size={16} color={mc.textDim} />
              </PressScale>
            )}
          </View>
          <View style={styles.habitList}>
            {HABITS.map((h) => {
              const done = ticked.includes(h.key);
              const streak = streakFor(h.key);
              return (
                <PressScale
                  key={h.key}
                  onPress={() => toggle(h.key)}
                  onLongPress={() => openEditHabit(h)}
                  delayLongPress={400}
                  scale={0.98}
                  style={styles.habitRow}
                >
                  <View style={[styles.circle, done && styles.circleDone]}>
                    {done ? <Ionicons name="checkmark" size={14} color={mc.ink} /> : null}
                  </View>
                  <Text style={styles.habitEmoji}>{h.emoji}</Text>
                  <Text style={[styles.habitText, done && styles.habitTextDone]} numberOfLines={2}>
                    {h.label}
                  </Text>
                  {streak >= 3 && (
                    <View style={styles.streakPill}>
                      <Ionicons name="flame" size={12} color={mc.redSoft} />
                      <Text style={styles.streakText}>{streak}</Text>
                    </View>
                  )}
                </PressScale>
              );
            })}
          </View>
        </Card>
      </Rise>

      {/* Monthly overview */}
      <Rise index={2}>
        <Card>
          <View style={styles.monthNav}>
            <PressScale onPress={() => setViewMonth(shiftMonth(viewMonth, -1))} scale={0.9} style={styles.monthBtn} accessibilityLabel="Previous month">
              <Ionicons name="chevron-back" size={17} color={mc.textDim} />
            </PressScale>
            <View style={styles.monthCenter}>
              <Text style={styles.monthTitle}>{monthLabel(viewMonth)}</Text>
              <Text style={styles.monthAvg}>
                Monthly average {Math.round(monthAverage * 100)}%
              </Text>
            </View>
            <PressScale
              onPress={() => {
                const next = shiftMonth(viewMonth, 1);
                if (next <= monthOf(today)) setViewMonth(next);
              }}
              scale={0.9}
              style={styles.monthBtn}
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={17} color={mc.textDim} />
            </PressScale>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* header row: day numbers */}
              <View style={styles.gridRow}>
                <View style={styles.gridLabelCell} />
                {monthDays.map((d, i) => (
                  <View
                    key={d}
                    style={[styles.gridDayCell, i === todayIndex && styles.gridTodayCol]}
                  >
                    <Text style={[styles.gridDayText, i === todayIndex && styles.gridDayTextToday]}>
                      {String(i + 1).padStart(2, '0')}
                    </Text>
                  </View>
                ))}
              </View>
              {/* habit rows */}
              {HABITS.map((h) => (
                <View key={h.key} style={styles.gridRow}>
                  <View style={styles.gridLabelCell}>
                    <Text style={styles.gridLabelEmoji} numberOfLines={1}>
                      {h.emoji}
                    </Text>
                  </View>
                  {monthDays.map((d, i) => {
                    const done = (habitsByDay.get(d) ?? []).includes(h.key);
                    return (
                      <View
                        key={d}
                        style={[
                          styles.gridCell,
                          done && styles.gridCellDone,
                          i === todayIndex && styles.gridTodayCol,
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </Card>
      </Rise>

      {/* Edit habit (long-press) */}
      {/* Edit habit (long-press) */}
      <Modal visible={!!editHabit} transparent animationType="fade" onRequestClose={() => setEditHabit(null)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setEditHabit(null)} activeOpacity={1}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit habit</Text>
            <View style={styles.modalEmojiRow}>
              <TextInput
                style={styles.modalEmojiInput}
                value={editEmoji}
                onChangeText={setEditEmoji}
                placeholder="Emoji"
                placeholderTextColor={mc.textDim}
                maxLength={4}
              />
              <TextInput
                style={styles.modalInputFlex}
                value={editLabel}
                onChangeText={setEditLabel}
                placeholder="Habit name"
                placeholderTextColor={mc.textDim}
                autoFocus
                onSubmitEditing={saveHabitEdit}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => editHabit && deleteHabit(editHabit)}
              >
                <Text style={styles.modalBtnGhostText}>Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={saveHabitEdit}>
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add habit */}
      <Modal visible={showAddHabit} transparent animationType="fade" onRequestClose={() => setShowAddHabit(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowAddHabit(false)} activeOpacity={1}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New habit</Text>
            <View style={styles.modalEmojiRow}>
              <TextInput
                style={styles.modalEmojiInput}
                value={newHabitEmoji}
                onChangeText={setNewHabitEmoji}
                placeholder="Emoji"
                placeholderTextColor={mc.textDim}
                maxLength={4}
              />
              <TextInput
                style={styles.modalInputFlex}
                value={newHabitLabel}
                onChangeText={setNewHabitLabel}
                placeholder="e.g. Stretch 10 minutes"
                placeholderTextColor={mc.textDim}
                autoFocus
                onSubmitEditing={addHabit}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setShowAddHabit(false)}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={addHabit}>
                <Text style={styles.modalBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
  },

  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  todayMain: {
    flex: 1,
    minWidth: 0,
  },
  todayBig: {
    fontSize: 22,
    fontWeight: '500',
    color: mc.text,
    marginTop: 4,
  },
  todaySub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },
  ringText: {
    fontSize: 12,
    fontWeight: '500',
    color: mc.text,
  },
  habitList: {
    marginTop: 12,
    gap: 2,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mc.line,
    backgroundColor: 'transparent',
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: mc.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    backgroundColor: mc.mint,
    borderColor: mc.mint,
  },
  habitEmoji: {
    fontSize: 16,
  },
  habitText: {
    flex: 1,
    fontSize: 15,
    color: mc.text,
  },
  habitTextDone: {
    color: mc.textDim,
    textDecorationLine: 'line-through',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: mc.redDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  streakText: {
    fontSize: 12,
    color: mc.redSoft,
    fontWeight: '600',
  },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: mc.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenter: {
    flex: 1,
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: mc.text,
  },
  monthAvg: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLabelCell: {
    width: 34,
    alignItems: 'center',
  },
  gridDayCell: {
    width: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTodayCol: {
    backgroundColor: mc.redDim,
    borderRadius: 6,
  },
  gridDayText: {
    fontSize: 9,
    color: mc.textDim,
  },
  gridDayTextToday: {
    color: mc.redSoft,
    fontWeight: '700',
  },
  gridCell: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: mc.raised,
    marginVertical: 2,
  },
  gridCellDone: {
    backgroundColor: mc.mint,
  },
  gridLabelEmoji: {
    fontSize: 13,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'center',
    padding: 26,
  },
  modalCard: {
    backgroundColor: mc.card,
    borderRadius: 26,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: mc.text,
  },
  modalEmojiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalEmojiInput: {
    backgroundColor: mc.raised,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: mc.text,
    fontSize: 16,
    width: 52,
    textAlign: 'center',
  },
  modalInputFlex: {
    flex: 1,
    backgroundColor: mc.raised,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: mc.text,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    backgroundColor: mc.red,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 20,
  },
  modalBtnGhost: {
    backgroundColor: 'transparent',
  },
  modalBtnGhostText: {
    fontSize: 14,
    color: mc.redSoft,
    fontWeight: '600',
  },
  modalBtnText: {
    fontSize: 14,
    color: mc.white,
    fontWeight: '600',
  },
});
