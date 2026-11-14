/**
 * WeeklyReviewScreen — "Weekly review" (s36).
 *
 * A Sunday → Saturday recap computed from the same stores the rest of the
 * app writes: finance (spend, fixed expenses), sleep, habits and tasks.
 * No sample numbers — an empty week shows honest empty states.
 *
 * "Set as goals" turns the three focus items into tasks (with the usual
 * due-time reminder).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  Label,
  PressScale,
  Rise,
  Ring,
  Screen,
  TopBar,
} from '../../../shared/components/meridian';
import { useFinanceStore } from '../store';
import { useSleepStore, formatSleepDuration } from '../../sleep/store';
import { useHabitStore, useHabitDefs } from '../../habits/store';
import { useTasksStore } from '../../tasks/store';
import { useAuth } from '../../../services/AuthProvider';
import { DEFAULT_TARGET_MIN } from '../../sleep/sleepScore';
import {
  localDayKey,
  shiftLocalDayKey,
  formatRupees,
} from '../financeFormat';
import {
  computeWeekReview,
  scoreDescriptor,
  weekLabel,
  weekStartOf,
} from '../weeklyReview';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function WeeklyReviewScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const transactions = useFinanceStore((s) => s.transactions);
  const fixedExpenses = useFinanceStore((s) => s.fixedExpenses);
  const receivables = useFinanceStore((s) => s.receivables);
  const sleepEntries = useSleepStore((s) => s.entries);
  const habitDays = useHabitStore((s) => s.days);
  const habitDefs = useHabitDefs();
  const tasks = useTasksStore((s) => s.tasks);

  const todayKey = localDayKey(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [goalsCreated, setGoalsCreated] = useState(false);

  const weekStartKey = useMemo(
    () => shiftLocalDayKey(weekStartOf(todayKey), weekOffset * 7),
    [todayKey, weekOffset],
  );
  const weekEndKey = shiftLocalDayKey(weekStartKey, 6);

  // A fresh week should show the button again.
  useEffect(() => {
    setGoalsCreated(false);
  }, [weekStartKey]);

  const review = useMemo(
    () =>
      computeWeekReview({
        weekStartKey,
        transactions,
        fixedExpenseNames: fixedExpenses.map((f) => f.name),
        sleepEntries,
        habitDays: habitDays.map((d) => ({ day: d.day, habits: d.habits })),
        habitDefs,
        tasks,
        lent: receivables
          .filter((r) => r.type === 'lent')
          .map((r) => ({
            personName: r.personName,
            amount: r.amount,
            paidAmount: r.paidAmount ?? 0,
            dueDate: r.dueDate,
          })),
        todayKey,
      }),
    [
      weekStartKey,
      transactions,
      fixedExpenses,
      sleepEntries,
      habitDays,
      habitDefs,
      tasks,
      receivables,
      todayKey,
    ],
  );

  const descriptor = review.score !== null ? scoreDescriptor(review.score) : null;
  const ringColor =
    review.score === null ? mc.track : review.score >= 60 ? mc.mint : review.score >= 40 ? mc.amber : mc.red;

  const deltaText = (() => {
    if (review.scoreDelta === null) return 'First week with data';
    const abs = Math.abs(review.scoreDelta);
    if (review.scoreDelta === 0) return 'Level with last week';
    return review.scoreDelta > 0 ? `Up ${abs} points from last week` : `Down ${abs} points from last week`;
  })();
  const deltaColor =
    review.scoreDelta === null || review.scoreDelta === 0 ? mc.textDim : review.scoreDelta > 0 ? mc.mint : mc.redSoft;

  const spendCaption = (() => {
    if (review.spendDeltaPct === null) return { text: 'No spend logged this week', color: mc.textDim };
    if (review.spendDeltaPct <= 0) return { text: `${Math.abs(review.spendDeltaPct)}% less than last week`, color: mc.mint };
    return { text: `${review.spendDeltaPct}% more than last week`, color: mc.redSoft };
  })();

  const sleepCaption = (() => {
    if (review.sleepAvgMin === null) return { text: 'No nights logged', color: mc.textDim };
    if (review.sleepAvgMin >= DEFAULT_TARGET_MIN) {
      const over = review.sleepAvgMin - DEFAULT_TARGET_MIN;
      return { text: over === 0 ? 'On target' : `${over} min over target`, color: mc.mint };
    }
    return { text: `${DEFAULT_TARGET_MIN - review.sleepAvgMin} min under target`, color: mc.amber };
  })();

  const habitsValue = review.habitsPct === null ? '—' : `${Math.round(review.habitsPct * 100)}%`;
  const tasksCaption =
    review.urgentOpen > 0
      ? { text: `${review.urgentOpen} urgent still open`, color: mc.redSoft }
      : { text: 'All clear', color: mc.mint };

  // ── heat cells ──────────────────────────────────────────────────────────
  const weekMaxSpend = Math.max(1, ...review.days.map((d) => d.spendPaise));
  const spendCell = (v: number): string => {
    if (v <= 0) return '#3A0A14';
    const r = v / weekMaxSpend;
    if (r <= 0.25) return '#5A0818';
    if (r <= 0.5) return '#7A0A22';
    if (r <= 0.75) return '#B80020';
    return '#EB0028';
  };
  const sleepCell = (min: number | null): string => {
    if (min === null) return mc.track;
    if (min >= DEFAULT_TARGET_MIN - 30) return mc.violet; // within 30 min of target
    return '#3A3358';
  };
  const habitCell = (p: number | null): string => {
    if (p === null) return mc.track;
    if (p >= 0.8) return mc.mint;
    if (p >= 0.5) return '#1E7A5E';
    if (p > 0) return '#164A3A';
    return mc.track;
  };

  const shareWeek = () => {
    const lines = [
      `Meridian — Weekly review`,
      weekLabel(weekStartKey),
      review.score !== null ? `Score: ${review.score}/100 — ${descriptor?.label ?? ''}` : 'Score: not enough data',
      `Spend: ${formatRupees(review.spendPaise)} (${spendCaption.text})`,
      review.sleepAvgMin !== null ? `Sleep: ${formatSleepDuration(review.sleepAvgMin / 60)} avg` : null,
      review.habitsPct !== null ? `Habits: ${Math.round(review.habitsPct * 100)}%` : null,
      `Tasks: ${review.tasksDone} of ${review.tasksPlanned} done`,
    ].filter(Boolean) as string[];
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  const setAsGoals = () => {
    if (goalsCreated) return;
    const dueDate = new Date();
    // Due the Saturday closing next week.
    const saturday = shiftLocalDayKey(weekEndKey, 7);
    const [y, m, d] = saturday.split('-').map(Number);
    dueDate.setTime(new Date(y, (m || 1) - 1, d || 1, 9, 0, 0, 0).getTime());
    for (const item of review.focus) {
      useTasksStore.getState().addTask(
        {
          name: item,
          description: `From your weekly review — week of ${weekLabel(weekStartKey)}`,
          priority: 'high',
          dueDate: dueDate.toISOString(),
          subtasks: [],
        },
        user?.id,
      );
    }
    setGoalsCreated(true);
  };

  const isCurrentWeek = weekOffset === 0;

  return (
    <Screen bottomInset={24}>
      <TopBar
        title="Weekly review"
        onBack={() => navigation.goBack()}
        variant="center"
        right={
          <PressScale onPress={shareWeek} scale={0.92} style={styles.shareBtn} accessibilityLabel="Share this week">
            <Ionicons name="share-social-outline" size={18} color={mc.text} />
          </PressScale>
        }
      />

      {/* ── Week selector ─────────────────────────────────────────────── */}
      <Rise index={0}>
        <View style={styles.weekSelector}>
          <PressScale
            onPress={() => setWeekOffset((v) => v - 1)}
            scale={0.9}
            style={styles.chevBtn}
            accessibilityLabel="Previous week"
          >
            <Ionicons name="chevron-back" size={20} color={mc.textDim} />
          </PressScale>
          <Text style={styles.weekLabel}>{weekLabel(weekStartKey)}</Text>
          <PressScale
            onPress={() => !isCurrentWeek && setWeekOffset((v) => v + 1)}
            scale={isCurrentWeek ? 1 : 0.9}
            style={[styles.chevBtn, isCurrentWeek && styles.chevDisabled]}
            accessibilityLabel="Next week"
            disabled={isCurrentWeek}
          >
            <Ionicons name="chevron-forward" size={20} color={isCurrentWeek ? mc.textGhost : mc.textDim} />
          </PressScale>
        </View>
      </Rise>

      {/* ── Score ring ─────────────────────────────────────────────────── */}
      <Rise index={1}>
        <Card style={styles.scoreCard}>
          <Ring progress={(review.score ?? 0) / 100} size={96} stroke={9} color={ringColor}>
            <Text style={styles.scoreNumber}>{review.score ?? '—'}</Text>
          </Ring>
          <View style={styles.scoreText}>
            <Label>WEEK SCORE</Label>
            <Text style={styles.scoreLabel}>{descriptor?.label ?? 'Not enough data'}</Text>
            <Text style={[styles.scoreDelta, { color: deltaColor }]}>{deltaText}</Text>
          </View>
        </Card>
      </Rise>

      {/* ── Scorecards ─────────────────────────────────────────────────── */}
      <View style={styles.grid2}>
        <Rise index={2} style={styles.gridCell}>
          <Card pad={12} style={styles.scoreTile}>
            <View style={styles.tileLabel}>
              <Ionicons name="wallet-outline" size={12} color={mc.amber} />
              <Label small>SPEND</Label>
            </View>
            <Text style={styles.tileValue}>{formatRupees(review.spendPaise)}</Text>
            <Text style={[styles.tileCaption, { color: spendCaption.color }]}>{spendCaption.text}</Text>
          </Card>
        </Rise>
        <Rise index={3} style={styles.gridCell}>
          <Card pad={12} style={styles.scoreTile}>
            <View style={styles.tileLabel}>
              <Ionicons name="moon-outline" size={12} color={mc.violet} />
              <Label small>SLEEP</Label>
            </View>
            <Text style={styles.tileValue}>
              {review.sleepAvgMin !== null ? formatSleepDuration(review.sleepAvgMin / 60) : '—'}
            </Text>
            <Text style={[styles.tileCaption, { color: sleepCaption.color }]}>{sleepCaption.text}</Text>
          </Card>
        </Rise>
        <Rise index={4} style={styles.gridCell}>
          <Card pad={12} style={styles.scoreTile}>
            <View style={styles.tileLabel}>
              <Ionicons name="flame-outline" size={12} color={mc.redSoft} />
              <Label small>HABITS</Label>
            </View>
            <Text style={styles.tileValue}>{habitsValue}</Text>
            <Text style={styles.tileCaptionDim}>
              {review.habitBestStreak > 0 ? `Best streak ${review.habitBestStreak} days` : 'No streak yet'}
            </Text>
          </Card>
        </Rise>
        <Rise index={5} style={styles.gridCell}>
          <Card pad={12} style={styles.scoreTile}>
            <View style={styles.tileLabel}>
              <Ionicons name="checkbox-outline" size={12} color={mc.mint} />
              <Label small>TASKS</Label>
            </View>
            <Text style={styles.tileValue}>
              {review.tasksPlanned > 0 ? `${review.tasksDone} of ${review.tasksPlanned}` : '—'}
            </Text>
            <Text style={[styles.tileCaption, { color: tasksCaption.color }]}>{tasksCaption.text}</Text>
          </Card>
        </Rise>
      </View>

      {/* ── Week at a glance ───────────────────────────────────────────── */}
      <Rise index={6}>
        <Card>
          <Label>WEEK AT A GLANCE</Label>
          <View style={styles.hmRow}>
            <View style={styles.hmLabel} />
            {DAY_LABELS.map((d, i) => (
              <Text key={`h${i}`} style={[styles.hmDay, i === 6 && { color: mc.redSoft }]}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.hmRow}>
            <Text style={styles.hmLabel}>Spend</Text>
            {review.days.map((d) => (
              <View key={d.dayKey} style={[styles.hmCell, { backgroundColor: spendCell(d.spendPaise) }]} />
            ))}
          </View>
          <View style={styles.hmRow}>
            <Text style={styles.hmLabel}>Sleep</Text>
            {review.days.map((d) => (
              <View key={d.dayKey} style={[styles.hmCell, { backgroundColor: sleepCell(d.sleepMin) }]} />
            ))}
          </View>
          <View style={styles.hmRow}>
            <Text style={styles.hmLabel}>Habits</Text>
            {review.days.map((d) => (
              <View key={d.dayKey} style={[styles.hmCell, { backgroundColor: habitCell(d.habitProgress) }]} />
            ))}
          </View>
        </Card>
      </Rise>

      {/* ── Wins & watch ───────────────────────────────────────────────── */}
      <View style={styles.grid2}>
        <Rise index={7} style={styles.gridCell}>
          <Card tone="mint" style={styles.insightCard}>
            <Label color={mc.mint}>WINS</Label>
            {review.wins.map((w, i) => (
              <Text key={i} style={[styles.winText, i > 0 && styles.insightLineGap]}>
                {w}
              </Text>
            ))}
          </Card>
        </Rise>
        <Rise index={8} style={styles.gridCell}>
          <Card tone="amber" style={styles.insightCard}>
            <Label color={mc.amber}>WATCH</Label>
            {review.watch.map((w, i) => (
              <Text key={i} style={[styles.watchText, i > 0 && styles.insightLineGap]}>
                {w}
              </Text>
            ))}
          </Card>
        </Rise>
      </View>

      {/* ── Next week focus ─────────────────────────────────────────────── */}
      <Rise index={9}>
        <Card>
          <View style={styles.focusHeader}>
            <Ionicons name="sparkles" size={13} color={mc.redSoft} />
            <Label color={mc.redSoft}>NEXT WEEK FOCUS</Label>
          </View>
          {review.focus.map((item, i) => (
            <View key={i} style={[styles.focusRow, i > 0 && styles.focusRowDivider]}>
              <View style={styles.focusDot} />
              <Text style={styles.focusText}>{item}</Text>
            </View>
          ))}
          <PressScale
            onPress={setAsGoals}
            scale={goalsCreated ? 1 : 0.98}
            style={[styles.goalsBtn, goalsCreated && styles.goalsBtnDone]}
            accessibilityLabel="Add this focus as tasks"
          >
            <Ionicons
              name={goalsCreated ? 'checkmark-circle' : 'flag-outline'}
              size={18}
              color={goalsCreated ? mc.mint : mc.white}
            />
            <Text style={[styles.goalsBtnText, goalsCreated && { color: mc.mint }]}>
              {goalsCreated ? 'Added to your tasks' : 'Set as goals'}
            </Text>
          </PressScale>
        </Card>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shareBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  chevBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevDisabled: {
    opacity: 0.6,
  },
  weekLabel: {
    fontSize: 14,
    color: mc.text,
    fontVariant: ['tabular-nums'],
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  scoreNumber: {
    fontSize: 26,
    fontWeight: '500',
    color: mc.text,
    fontVariant: ['tabular-nums'],
  },
  scoreText: {
    flex: 1,
    gap: 3,
  },
  scoreLabel: {
    fontSize: 21,
    fontWeight: '500',
    color: mc.text,
    marginTop: 2,
  },
  scoreDelta: {
    fontSize: 12,
    marginTop: 2,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCell: {
    width: '48.5%',
    flexGrow: 1,
  },
  scoreTile: {
    gap: 4,
    minHeight: 118,
  },
  tileLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  tileValue: {
    fontSize: 21,
    fontWeight: '500',
    color: mc.text,
    fontVariant: ['tabular-nums'],
  },
  tileCaption: {
    fontSize: 11,
  },
  tileCaptionDim: {
    fontSize: 11,
    color: mc.textDim,
  },
  hmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  hmLabel: {
    width: 46,
    fontSize: 10,
    color: mc.textDim,
  },
  hmDay: {
    flex: 1,
    fontSize: 10,
    color: mc.textDim,
    textAlign: 'center',
  },
  hmCell: {
    flex: 1,
    height: 22,
    borderRadius: 7,
  },
  insightCard: {
    minHeight: 110,
    gap: 2,
  },
  insightLineGap: {
    marginTop: 6,
  },
  winText: {
    fontSize: 13,
    lineHeight: 19,
    color: mc.mintText,
    marginTop: 8,
  },
  watchText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#F0DFB8',
    marginTop: 8,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  focusRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  focusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: mc.checkbox,
  },
  focusText: {
    flex: 1,
    fontSize: 14,
    color: mc.text,
    lineHeight: 20,
  },
  goalsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: mc.red,
    borderRadius: mr.chip,
    paddingVertical: 13,
    marginTop: 10,
  },
  goalsBtnDone: {
    backgroundColor: mc.mintDim,
  },
  goalsBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.white,
  },
});
