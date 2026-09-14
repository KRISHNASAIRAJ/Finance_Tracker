/**
 * HabitTrackerScreen — Notion-style habit tracker: per-habit tick boxes for
 * today, daily completion %, per-habit streaks, and a monthly overview grid
 * (day columns × habit rows, ticked = filled cell) with month average.
 */
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { tc } from '../../../shared/theme/tracend';
import Entrance from '../../../shared/components/Entrance';
import {
  HABITS,
  todayKey,
  monthOf,
  shiftMonth,
  monthLabel,
  daysInMonth,
  dayProgress,
  dayPercent,
  habitStreak,
  istDayKey,
} from '../habits';
import { useHabitStore, habitsForDay } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { MoreStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

export default function HabitTrackerScreen() {
  const navigation = useNavigation<Nav>();
  const days = useHabitStore((s) => s.days);
  const { user } = useAuth();

  const [viewMonth, setViewMonth] = useState(monthOf(todayKey()));

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
    const sum = tracked.reduce((s, d) => s + dayProgress(habitsByDay.get(d)!), 0);
    return sum / tracked.length;
  }, [monthDays, habitsByDay]);

  const todayIndex = monthDays.indexOf(today);
  const isCurrentMonth = viewMonth === monthOf(today);

  const toggle = (habitKey: string) => {
    useHabitStore.getState().toggleHabit(today, habitKey, user?.id);
  };

  const streakFor = (key: string) =>
    habitStreak(key, (k) => habitsByDay.get(k) ?? []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Habit Tracker</Text>
        <View style={styles.appBarSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Today card */}
        <Entrance index={0}>
          <View style={styles.todayCard}>
            <View style={styles.todayHeadRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.todayLabel}>TODAY · {dayPercent(ticked)}</Text>
                <Text style={styles.todaySub}>
                  {ticked.length} of {HABITS.length} done
                </Text>
              </View>
            </View>
            <View style={styles.habitList}>
              {HABITS.map((h) => {
                const done = ticked.includes(h.key);
                const streak = streakFor(h.key);
                return (
                  <TouchableOpacity
                    key={h.key}
                    style={styles.habitRow}
                    onPress={() => toggle(h.key)}
                    activeOpacity={0.75}
                  >
                    {/* tick box */}
                    <View style={[styles.tickBox, done && styles.tickBoxDone]}>
                      {done && <Ionicons name="checkmark" size={15} color="#0A0A10" />}
                    </View>
                    <Text style={styles.habitEmoji}>{h.emoji}</Text>
                    <Text style={[styles.habitText, done && styles.habitTextDone]} numberOfLines={2}>
                      {h.label}
                    </Text>
                    {streak >= 3 && (
                      <View style={styles.streakPill}>
                        <Text style={styles.streakPillText}>🔥 {streak}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Entrance>

        {/* Monthly overview */}
        <Entrance index={1}>
          <View style={styles.monthCard}>
            <View style={styles.monthNav}>
              <TouchableOpacity style={styles.monthBtn} onPress={() => setViewMonth(shiftMonth(viewMonth, -1))}>
                <Ionicons name="chevron-back" size={16} color={tc.textMuted} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.monthTitle}>{monthLabel(viewMonth)}</Text>
                <Text style={styles.monthAvg}>Monthly average {Math.round(monthAverage * 100)}%</Text>
              </View>
              <TouchableOpacity
                style={styles.monthBtn}
                onPress={() => {
                  const next = shiftMonth(viewMonth, 1);
                  if (next <= monthOf(today)) setViewMonth(next);
                }}
              >
                <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />
              </TouchableOpacity>
            </View>

            {/* progress blocks for the month */}
            <Text style={styles.monthBlocks}>
              {'⬛'.repeat(Math.round(monthAverage * 10)) + '⬜'.repeat(10 - Math.round(monthAverage * 10))}
              {'  '}{Math.round(monthAverage * 100)}%
            </Text>

            {/* grid: habit rows × day columns */}
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
                      <Text style={styles.gridLabelEmoji} numberOfLines={1}>{h.emoji}</Text>
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
                        >
                          {done && <View style={styles.gridCellDot} />}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </Entrance>
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
  appBarSide: { width: 40, height: 40 },
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
    gap: spacing.stackGapLg,
    paddingBottom: 100,
  },
  todayCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: rounded.xl,
    padding: 16,
    gap: 12,
  },
  todayHeadRow: { flexDirection: 'row', alignItems: 'center' },
  todayLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(139,149,255,0.9)',
    letterSpacing: 1.5,
  },
  todaySub: {
    fontSize: 12,
    color: tc.textMuted,
    marginTop: 2,
  },
  habitList: { gap: 4 },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: rounded.md,
  },
  tickBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tickBoxDone: {
    backgroundColor: '#4fdbcc',
    borderColor: '#4fdbcc',
  },
  habitEmoji: { fontSize: 15 },
  habitText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: tc.textPrimary,
    lineHeight: 18,
  },
  habitTextDone: {
    color: tc.textMuted,
    textDecorationLine: 'line-through',
    textDecorationColor: 'rgba(79,219,204,0.6)',
  },
  streakPill: {
    backgroundColor: 'rgba(234,100,121,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  streakPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ea6479',
  },
  monthCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: rounded.xl,
    padding: 16,
    gap: 12,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: tc.textPrimary,
  },
  monthAvg: {
    fontSize: 11,
    color: tc.textMuted,
    marginTop: 2,
  },
  monthBlocks: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  gridRow: { flexDirection: 'row', alignItems: 'center' },
  gridLabelCell: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  gridLabelEmoji: { fontSize: 13 },
  gridDayCell: {
    width: 16,
    alignItems: 'center',
    paddingVertical: 3,
  },
  gridDayText: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '600',
  },
  gridDayTextToday: { color: '#5ee6ff', fontWeight: '800' },
  gridCell: {
    width: 16,
    height: 16,
    borderRadius: 5,
    marginVertical: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellDone: {
    backgroundColor: 'rgba(79,219,204,0.35)',
    borderColor: 'rgba(79,219,204,0.55)',
  },
  gridCellDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4fdbcc',
  },
  gridTodayCol: {
    backgroundColor: 'rgba(94,230,255,0.08)',
  },
});
