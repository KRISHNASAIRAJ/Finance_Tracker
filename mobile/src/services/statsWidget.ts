/**
 * statsWidget — computes the compact daily stats shown on the Android
 * home-screen "Stats" widget (formerly the Report quick-action tile) and
 * pushes them to the native StatsWidgetBridge (SharedPreferences-backed,
 * same pattern as bedtimeWidget).
 *
 * Degrades gracefully (no-ops) on iOS / Expo Go where the module is absent.
 */
import { NativeModules, Platform } from 'react-native';
import { useFinanceStore, istDateKey, type Transaction } from '../modules/finance/store';
import { useTasksStore, type Task } from '../modules/tasks/store';
import { useHabitStore } from '../modules/habits/store';
import { effectiveHabits } from '../modules/habits/habits';
import { useSleepStore, sleepDurationHours, type SleepEntry } from '../modules/sleep/store';

const StatsWidgetModule = NativeModules.StatsWidgetBridge as
  | { setStats: (json: string) => Promise<void> }
  | undefined;

export interface DailyStats {
  /** IST day key the stats are for, YYYY-MM-DD */
  dayKey: string;
  /** Money spent today across outflow types, in paise */
  spendPaise: number;
  /** Incomplete tasks due today or overdue */
  tasksLeft: number;
  /** Ticked habits today vs total habit definitions */
  habitsDone: number;
  habitsTotal: number;
  /** Last logged sleep session duration in hours, null when none */
  sleepHours: number | null;
}

/** Transaction types that count as money out the door for "spend today". */
const OUTFLOW_TYPES = new Set(['expense', 'fixed_expense', 'fuel_purchase', 'vehicle_service']);

export function computeDailyStats(input: {
  dayKey: string;
  transactions: Transaction[];
  tasks: Task[];
  habitDays: { day: string; habits: string[] }[];
  habitsTotal: number;
  sleepEntries: SleepEntry[];
}): DailyStats {
  const { dayKey, transactions, tasks, habitDays, habitsTotal, sleepEntries } = input;

  const spendPaise = transactions.reduce((sum, t) => {
    if (!OUTFLOW_TYPES.has(t.type)) return sum;
    const d = t.date ? new Date(t.date) : null;
    if (!d || Number.isNaN(d.getTime())) return sum;
    return istDateKey(d) === dayKey ? sum + (Number.isFinite(t.amount) ? t.amount : 0) : sum;
  }, 0);

  const tasksLeft = tasks.filter((t) => {
    if (t.completed) return false;
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    if (Number.isNaN(d.getTime())) return false;
    return istDateKey(d) <= dayKey;
  }).length;

  const habitsDone = habitDays.find((d) => d.day === dayKey)?.habits.length ?? 0;

  let sleepHours: number | null = null;
  let latest = -1;
  for (const e of sleepEntries) {
    const start = new Date(e.startTime).getTime();
    if (!Number.isFinite(start) || start <= latest) continue;
    latest = start;
    const h = sleepDurationHours(e);
    sleepHours = Number.isFinite(h) && h > 0 ? h : null;
  }

  return { dayKey, spendPaise, tasksLeft, habitsDone, habitsTotal, sleepHours };
}

/** Read the live stores and compute today's stats snapshot. */
export function readDailyStats(): DailyStats {
  const f = useFinanceStore.getState();
  const t = useTasksStore.getState();
  const hb = useHabitStore.getState();
  const sl = useSleepStore.getState();
  return computeDailyStats({
    dayKey: istDateKey(),
    transactions: f.transactions,
    tasks: t.tasks,
    habitDays: hb.days,
    habitsTotal: effectiveHabits(hb.habitOverrides).length,
    sleepEntries: sl.entries,
  });
}

export function isStatsWidgetAvailable(): boolean {
  return Platform.OS === 'android' && !!StatsWidgetModule;
}

/** Push the snapshot to the native widget. Never throws. */
export async function pushStatsWidget(stats?: DailyStats): Promise<void> {
  if (!isStatsWidgetAvailable()) return;
  try {
    await StatsWidgetModule!.setStats(JSON.stringify(stats ?? readDailyStats()));
  } catch {
    /* best-effort */
  }
}
