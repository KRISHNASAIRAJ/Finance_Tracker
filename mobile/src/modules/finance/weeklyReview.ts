/**
 * weeklyReview â€” the pure math behind the Weekly review screen (s36).
 *
 * Sunday â†’ Saturday weeks. Everything derives from what the app already
 * stores; nothing is persisted on its own. No imports from UI.
 */

import { DEFAULT_TARGET_MIN } from '../sleep/sleepScore';
import { dayProgress, habitBestStreak, type HabitDef } from '../habits/habits';
import { asDayKey, dayKeyRange, localDayKey, shiftLocalDayKey, shortDayKey } from './financeFormat';
import { formatRupees } from './financeFormat';

export interface WeekTransaction {
  type: string;
  amount: number;
  date: string;
  category: string;
  notes?: string | null;
}

export interface WeekSleepEntry {
  startTime: string;
  endTime: string;
  interruptions: number;
}

export interface WeekHabitDay {
  day: string;
  habits: string[];
}

export interface WeekTask {
  name: string;
  priority: string;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
}

export interface WeekLent {
  personName: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
}

export interface WeekReviewInput {
  /** Sunday of the reviewed week, local day key. */
  weekStartKey: string;
  transactions: ReadonlyArray<WeekTransaction>;
  /** Fixed-expense names to exclude from spend (they're shown as events elsewhere). */
  fixedExpenseNames: ReadonlyArray<string>;
  sleepEntries: ReadonlyArray<WeekSleepEntry>;
  habitDays: ReadonlyArray<WeekHabitDay>;
  habitDefs: ReadonlyArray<HabitDef>;
  tasks: ReadonlyArray<WeekTask>;
  lent: ReadonlyArray<WeekLent>;
  /** Today â€” so future days in the current week render as "no data". */
  todayKey: string;
}

export interface DayCell {
  dayKey: string;
  spendPaise: number;
  /** Sum of the longest sleep ending that day; null when nothing was logged. */
  sleepMin: number | null;
  /** 0..1, null when the habit tracker had no row for that day. */
  habitProgress: number | null;
}

export interface WeekReview {
  weekStartKey: string;
  weekEndKey: string;
  prevStartKey: string;
  prevEndKey: string;
  days: DayCell[];
  spendPaise: number;
  prevSpendPaise: number;
  /** Signed % change vs last week; null when last week had no spend. */
  spendDeltaPct: number | null;
  avgDailySpendPaise: number;
  sleepAvgMin: number | null;
  prevSleepAvgMin: number | null;
  nightsOnTarget: number;
  sleepNightsLogged: number;
  /** Total wake-ups across the week's nights. */
  sleepInterruptions: number;
  habitsPct: number | null;
  habitBestStreak: number;
  tasksDone: number;
  tasksPlanned: number;
  urgentOpen: number;
  /** 0â€“100, null when no domain has any data this week. */
  score: number | null;
  prevScore: number | null;
  scoreDelta: number | null;
  foodSharePct: number | null;
  topCategory: { name: string; amountPaise: number } | null;
  wins: string[];
  watch: string[];
  focus: string[];
}

const spendExclude = (names: ReadonlyArray<string>): Set<string> =>
  new Set([
    'rent',
    'sip',
    'investments',
    'housing',
    'wallet loads',
    'wallet load',
    ...names.map((n) => n.toLowerCase()),
  ]);

const isSpend = (tx: WeekTransaction, excluded: Set<string>): boolean => {
  if (tx.type !== 'expense' && tx.type !== 'fuel_purchase' && tx.type !== 'vehicle_service') return false;
  const category = (tx.category || '').toLowerCase();
  if (excluded.has(category)) return false;
  const notes = (tx.notes || '').toLowerCase();
  if (notes.includes('wallet load') || notes.includes('payzapp')) return false;
  return true;
};

function spendBetween(
  transactions: ReadonlyArray<WeekTransaction>,
  excluded: Set<string>,
  fromKey: string,
  toKey: string,
): { totalPaise: number; byDay: Map<string, number>; byCategory: Map<string, number> } {
  const byDay = new Map<string, number>();
  const byCategory = new Map<string, number>();
  let totalPaise = 0;
  for (const tx of transactions) {
    if (!isSpend(tx, excluded)) continue;
    const dayKey = asDayKey(tx.date);
    if (!dayKey || dayKey < fromKey || dayKey > toKey) continue;
    totalPaise += tx.amount;
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + tx.amount);
    const cat = tx.category || 'Uncategorised';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + tx.amount);
  }
  return { totalPaise, byDay, byCategory };
}

function sleepBetween(
  entries: ReadonlyArray<WeekSleepEntry>,
  fromKey: string,
  toKey: string,
): Map<string, { minutes: number; interruptions: number }> {
  const byDay = new Map<string, { minutes: number; interruptions: number }>();
  for (const e of entries) {
    const end = new Date(e.endTime);
    if (isNaN(end.getTime())) continue;
    const dayKey = localDayKey(end);
    if (dayKey < fromKey || dayKey > toKey) continue;
    const start = new Date(e.startTime);
    if (isNaN(start.getTime())) continue;
    const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const prev = byDay.get(dayKey);
    if (prev && prev.minutes >= minutes) continue; // longest night wins the cell
    byDay.set(dayKey, { minutes, interruptions: e.interruptions || 0 });
  }
  return byDay;
}

/** The week score, 0â€“100. Each domain earns up to 25; domains with no data
 * drop out and the rest are re-weighted. */
function weekScore(parts: Array<{ points: number; weight: number } | null>): number | null {
  let earned = 0;
  let total = 0;
  for (const p of parts) {
    if (!p) continue;
    earned += p.points;
    total += p.weight;
  }
  return total > 0 ? Math.round((earned / total) * 100) : null;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function weekStartOf(anyDayKey: string): string {
  const [y, m, d] = anyDayKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - dt.getDay()); // getDay(): 0 = Sunday
  return localDayKey(dt);
}

export function weekRangeOf(weekStartKey: string): { startKey: string; endKey: string } {
  return { startKey: weekStartKey, endKey: shiftLocalDayKey(weekStartKey, 6) };
}

/** "8 to 14 Nov 2026" (or "28 Dec 2026 to 3 Jan 2027" across months). */
export function weekLabel(weekStartKey: string): string {
  const { endKey } = weekRangeOf(weekStartKey);
  const parse = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const start = parse(weekStartKey);
  const end = parse(endKey);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} to ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} to ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function computeWeekReview(input: WeekReviewInput): WeekReview {
  const { weekStartKey, todayKey } = input;
  const weekEndKey = shiftLocalDayKey(weekStartKey, 6);
  const prevStartKey = shiftLocalDayKey(weekStartKey, -7);
  const prevEndKey = shiftLocalDayKey(weekStartKey, -1);
  const days = dayKeyRange(weekStartKey, weekEndKey);
  const excluded = spendExclude(input.fixedExpenseNames);

  // â”€â”€ rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cur = spendBetween(input.transactions, excluded, weekStartKey, weekEndKey);
  const prev = spendBetween(input.transactions, excluded, prevStartKey, prevEndKey);
  const sleep = sleepBetween(input.sleepEntries, weekStartKey, weekEndKey);
  const prevSleep = sleepBetween(input.sleepEntries, prevStartKey, prevEndKey);
  const habitMap = daysInWindow(days, input.habitDays, input.habitDefs);
  const habitByDay: Map<string, number | null> =
    habitMap ?? new Map<string, number | null>(days.map((k) => [k, null]));

  const dayCells: DayCell[] = days.map((dayKey) => {
    const s = sleep.get(dayKey);
    return {
      dayKey,
      spendPaise: cur.byDay.get(dayKey) ?? 0,
      sleepMin: s ? s.minutes : null,
      habitProgress: habitByDay.get(dayKey) ?? null,
    };
  });

  const spendPaise = cur.totalPaise;
  const prevSpendPaise = prev.totalPaise;
  const spendDeltaPct = prevSpendPaise > 0 ? Math.round(((spendPaise - prevSpendPaise) / prevSpendPaise) * 100) : null;
  const avgDailySpendPaise = Math.round(spendPaise / 7);

  const sleepRows = [...sleep.values()];
  const sleepNightsLogged = sleepRows.length;
  const sleepAvgMin = sleepNightsLogged
    ? Math.round(sleepRows.reduce((s, n) => s + n.minutes, 0) / sleepNightsLogged)
    : null;
  const prevSleepRows = [...prevSleep.values()];
  const prevSleepAvgMin = prevSleepRows.length
    ? Math.round(prevSleepRows.reduce((s, n) => s + n.minutes, 0) / prevSleepRows.length)
    : null;
  const nightsOnTarget = sleepRows.filter((n) => n.minutes >= 420).length; // 7h, matching the reference
  const sleepInterruptions = sleepRows.reduce((s, n) => s + n.interruptions, 0);

  const loggedHabitDays = days.filter((k) => habitByDay.get(k) !== null && habitByDay.get(k) !== undefined);
  const habitsPct =
    days.some((k) => habitByDay.get(k) != null)
      ? days.reduce((sum, k) => sum + (habitByDay.get(k) ?? 0), 0) / 7
      : null;
  const loggedDaysForStreak = input.habitDays.filter((d) => d.habits.length > 0).map((d) => d.day);
  const bestHabitStreak = input.habitDefs.reduce(
    (best, def) => Math.max(best, habitBestStreak(def.key, loggedDaysForStreak)),
    0,
  );

  const plannedTasks = input.tasks.filter((t) => {
    const dueKey = asDayKey(t.dueDate);
    const doneKey = t.completedAt ? asDayKey(t.completedAt) : null;
    const dueInWeek = dueKey !== null && dueKey >= weekStartKey && dueKey <= weekEndKey;
    const doneInWeek = doneKey !== null && doneKey >= weekStartKey && doneKey <= weekEndKey;
    return dueInWeek || doneInWeek;
  });
  const tasksPlanned = plannedTasks.length;
  const tasksDone = plannedTasks.filter((t) => t.completed).length;
  const urgentOpen = input.tasks.filter((t) => {
    if (t.completed || t.priority !== 'urgent') return false;
    const dueKey = asDayKey(t.dueDate);
    return dueKey === null || dueKey <= weekEndKey;
  }).length;

  // â”€â”€ score (computed symmetrically for this week and last) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const priorWeekStart = shiftLocalDayKey(prevStartKey, -7);
  const priorWeekEnd = shiftLocalDayKey(prevStartKey, -1);
  const priorSpend = spendBetween(input.transactions, excluded, priorWeekStart, priorWeekEnd).totalPaise;

  const scoreFor = (fromKey: string, toKey: string, ownSpend: number, baselineSpend: number): number | null => {
    const windowDays = dayKeyRange(fromKey, toKey);
    const ownSleep = [...sleepBetween(input.sleepEntries, fromKey, toKey).values()];
    const ownSleepAvg = ownSleep.length
      ? ownSleep.reduce((s, n) => s + n.minutes, 0) / ownSleep.length
      : null;
    const ownHabitProgress = daysInWindow(windowDays, input.habitDays, input.habitDefs);
    const ownHabitsPct =
      ownHabitProgress === null
        ? null
        : windowDays.reduce((sum, k) => sum + (ownHabitProgress.get(k) ?? 0), 0) / windowDays.length;
    const ownPlanned = input.tasks.filter((t) => taskInWindow(t, fromKey, toKey));
    const ownDone = ownPlanned.filter((t) => t.completed).length;
    const anyData =
      ownSpend > 0 ||
      ownSleep.length > 0 ||
      ownHabitProgress !== null ||
      ownPlanned.length > 0;
    if (!anyData) return null;
    const spendTs =
      baselineSpend > 0
        ? ownSpend <= baselineSpend
          ? 25
          : 25 * clamp01(1 - (ownSpend - baselineSpend) / baselineSpend)
        : ownSpend === 0
          ? 25
          : 12;
    return weekScore([
      { points: spendTs, weight: 25 },
      ownSleepAvg !== null ? { points: 25 * clamp01(ownSleepAvg / DEFAULT_TARGET_MIN), weight: 25 } : null,
      ownHabitsPct !== null ? { points: 25 * clamp01(ownHabitsPct), weight: 25 } : null,
      ownPlanned.length > 0 ? { points: 25 * clamp01(ownDone / ownPlanned.length), weight: 25 } : null,
    ]);
  };

  const score = scoreFor(weekStartKey, weekEndKey, spendPaise, prevSpendPaise);
  const prevScore = scoreFor(prevStartKey, prevEndKey, prevSpendPaise, priorSpend);
  const scoreDelta = score !== null && prevScore !== null ? score - prevScore : null;

  // â”€â”€ insights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const foodRe = /food|dining|restaurant|swiggy|zomato|eat|cafe|snack|mess|tiffin/i;
  let foodPaise = 0;
  for (const [cat, amt] of cur.byCategory) {
    if (foodRe.test(cat)) foodPaise += amt;
  }
  const foodSharePct = spendPaise > 0 && foodPaise > 0 ? Math.round((foodPaise / spendPaise) * 100) : null;
  const topCategoryEntry = [...cur.byCategory.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const topCategory = topCategoryEntry
    ? { name: topCategoryEntry[0], amountPaise: topCategoryEntry[1] }
    : null;

  const wins: string[] = [];
  if (sleepNightsLogged > 0 && nightsOnTarget >= Math.max(3, Math.ceil(sleepNightsLogged / 2))) {
    wins.push(`Slept 7h+ on ${nightsOnTarget} of ${sleepNightsLogged} nights`);
  }
  if (spendDeltaPct !== null && spendDeltaPct < 0) {
    wins.push(`Spending down ${Math.abs(spendDeltaPct)}% vs last week`);
  }
  if (tasksDone > 0) {
    wins.push(`${tasksDone} task${tasksDone === 1 ? '' : 's'} closed this week`);
  }
  if (bestHabitStreak >= 7) {
    wins.push(`Best habit streak: ${bestHabitStreak} days`);
  }
  if (wins.length === 0) wins.push('A quiet week â€” log a few nights or tasks and the wins write themselves.');

  const watch: string[] = [];
  if (foodSharePct !== null && foodSharePct >= 20) {
    watch.push(`Food is ${foodSharePct}% of spend`);
  }
  if (spendDeltaPct !== null && spendDeltaPct > 0) {
    watch.push(`Spending up ${spendDeltaPct}% vs last week`);
  }
  if (sleepAvgMin !== null && sleepAvgMin < DEFAULT_TARGET_MIN) {
    const under = DEFAULT_TARGET_MIN - sleepAvgMin;
    watch.push(`Averaged ${fmtMinutes(sleepAvgMin)} â€” ${under} min under target`);
  }
  if (urgentOpen > 0) {
    watch.push(`${urgentOpen} urgent task${urgentOpen === 1 ? '' : 's'} still open`);
  }
  if (habitsPct !== null && habitsPct < 0.5 && loggedHabitDays.length >= 2) {
    watch.push(`Habits done ${Math.round(habitsPct * 100)}% this week`);
  }
  if (watch.length === 0) watch.push('Nothing to flag this week.');

  const focus: string[] = [];
  if (topCategory) {
    const cap = Math.max(10000, Math.floor((topCategory.amountPaise * 0.9) / 10000) * 10000);
    focus.push(`Cap ${topCategory.name} spending at ${formatRupees(cap)}`);
  }
  const nextFortnightEnd = shiftLocalDayKey(weekEndKey, 14);
  const nextLend = [...input.lent]
    .map((l) => ({ l, key: asDayKey(l.dueDate) }))
    .filter((x) => x.key && x.key >= todayKey && x.key <= nextFortnightEnd && x.l.amount - (x.l.paidAmount ?? 0) > 0)
    .sort((a, b) => ((a.key ?? '') < (b.key ?? '') ? -1 : 1))[0];
  if (nextLend && nextLend.key) {
    const remaining = formatRupees(nextLend.l.amount - (nextLend.l.paidAmount ?? 0));
    focus.push(`Collect ${nextLend.l.personName}'s ${remaining} by ${shortDayKey(nextLend.key)}`);
  }
  const elevenPmDef = input.habitDefs.find((d) => d.key === 'sleep_by_11');
  if (elevenPmDef && (habitsPct === null || habitsPct < 1)) {
    focus.push('In bed by 11 PM on 5 nights');
  } else if (sleepAvgMin !== null && sleepAvgMin < DEFAULT_TARGET_MIN) {
    focus.push('Sleep 7h 30m+ on 5 nights');
  }
  if (urgentOpen > 0) {
    focus.push(`Close out ${urgentOpen} urgent task${urgentOpen === 1 ? '' : 's'}`);
  }
  if (focus.length < 3 && spendPaise > prevSpendPaise && avgDailySpendPaise > 0) {
    focus.push(`Keep daily spend under ${formatRupees(avgDailySpendPaise)}`);
  }
  if (focus.length < 3) {
    focus.push('Open the cash-flow forecast and trim one bill');
  }
  if (focus.length < 3) {
    focus.push('Review your budgets on Sunday');
  }

  return {
    weekStartKey,
    weekEndKey,
    prevStartKey,
    prevEndKey,
    days: dayCells,
    spendPaise,
    prevSpendPaise,
    spendDeltaPct,
    avgDailySpendPaise,
    sleepAvgMin,
    prevSleepAvgMin,
    nightsOnTarget,
    sleepNightsLogged,
    sleepInterruptions,
    habitsPct,
    habitBestStreak: bestHabitStreak,
    tasksDone,
    tasksPlanned,
    urgentOpen,
    score,
    prevScore,
    scoreDelta,
    foodSharePct,
    topCategory,
    wins,
    watch,
    focus: focus.slice(0, 3),
  };
}

/** "Great week" / "Good week" / "Fair week" / "Rough week" from the score. */
export function scoreDescriptor(score: number): { label: string; tone: 'mint' | 'amber' | 'red' } {
  if (score >= 75) return { label: 'Great week', tone: 'mint' };
  if (score >= 60) return { label: 'Good week', tone: 'mint' };
  if (score >= 40) return { label: 'Fair week', tone: 'amber' };
  return { label: 'Rough week', tone: 'red' };
}

function taskInWindow(t: WeekTask, fromKey: string, toKey: string): boolean {
  const dueKey = asDayKey(t.dueDate);
  const doneKey = t.completedAt ? asDayKey(t.completedAt) : null;
  const dueInWeek = dueKey !== null && dueKey >= fromKey && dueKey <= toKey;
  const doneInWeek = doneKey !== null && doneKey >= fromKey && doneKey <= toKey;
  return dueInWeek || doneInWeek;
}

function daysInWindow(
  keys: string[],
  habitDays: ReadonlyArray<WeekHabitDay>,
  defs: ReadonlyArray<HabitDef>,
): Map<string, number | null> | null {
  const byKey = new Map(habitDays.map((d) => [d.day, d]));
  const out = new Map<string, number | null>();
  let any = false;
  for (const key of keys) {
    const row = byKey.get(key);
    if (row) {
      out.set(key, dayProgress(row.habits, [...defs]));
      any = true;
    } else {
      out.set(key, null);
    }
  }
  return any ? out : null;
}
