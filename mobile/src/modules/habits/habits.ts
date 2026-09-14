/**
 * habits — canonical habit definitions + date/streak/progress helpers.
 * Pure functions, no imports — safe for Jest and the web mirror.
 */

export interface HabitDef {
  key: string;
  label: string;
  emoji: string;
}

/** The 10 canonical habits (fixed set — matches the Notion tracker). */
export const HABITS: HabitDef[] = [
  { key: 'sleep_6_7', label: 'Sleep 6–7 hours', emoji: '💤' },
  { key: 'cook_meals', label: 'Cook meals for the day', emoji: '🥗' },
  { key: 'eat_fruit', label: 'Eat a fruit', emoji: '🍎' },
  { key: 'no_junk', label: 'No junk food', emoji: '🚫' },
  { key: 'water_3l', label: 'Drink 3L water', emoji: '💧' },
  { key: 'sleep_by_11', label: 'Sleep by 11 PM', emoji: '🌙' },
  { key: 'chia_seeds', label: 'Take chia / tukmaria seeds', emoji: '🌱' },
  { key: 'learn_topic', label: 'Learn 1 topic (skillset)', emoji: '📚' },
  { key: 'read_or_watch', label: 'Read 1 page / watch useful video', emoji: '📖' },
  { key: 'plan_tomorrow', label: "Plan tomorrow's tasks", emoji: '🗒️' },
];

export const HABIT_KEYS: string[] = HABITS.map((h) => h.key);

/**
 * IST calendar day key (YYYY-MM-DD) for a Date or ISO string.
 * Pure UTC math — correct from any runtime timezone (device or CI server).
 */
export function istDayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return istDayKey(new Date());
}

/** Parse a stored habits JSON string safely into a key set. */
export function parseHabits(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((k) => typeof k === 'string');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/** Day completion ratio 0–1 (ticked / total habits). */
export function dayProgress(ticked: string[]): number {
  if (HABITS.length === 0) return 0;
  const valid = ticked.filter((k) => HABIT_KEYS.includes(k));
  return Math.min(1, valid.length / HABITS.length);
}

/** Percent label like "70%" — matches the Notion daily percentage column. */
export function dayPercent(ticked: string[]): string {
  return `${Math.round(dayProgress(ticked) * 100)}%`;
}

/** 10-segment progress bar like the Notion tracker: ⬛⬛⬜⬜… 30% */
export function progressBlocks(ticked: string[]): string {
  const filled = Math.round(dayProgress(ticked) * 10);
  return '⬛'.repeat(filled) + '⬜'.repeat(10 - filled) + ` ${Math.round(dayProgress(ticked) * 100)}%`;
}

/** All day-keys between two day keys inclusive (ISO order). */
export function dayRange(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const start = new Date(`${fromKey}T00:00:00Z`).getTime();
  const end = new Date(`${toKey}T00:00:00Z`).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return out;
  for (let t = start; t <= end; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Number of days in a month key "YYYY-MM". */
export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

/** Month key of a day key. */
export function monthOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

/** Shift a month key by n months. */
export function shiftMonth(monthKey: string, n: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Month display label: "September 2026". */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/**
 * Current streak for a habit: consecutive days (ending today or yesterday)
 * where the habit was ticked. Starts at 0.
 */
export function habitStreak(habitKey: string, logsByDay: (dayKey: string) => string[]): number {
  let streak = 0;
  const today = new Date();
  const day = new Date(today);
  // If today isn't ticked, streak can still be alive counting back from yesterday.
  const todayK = istDayKey(day);
  if (!logsByDay(todayK).includes(habitKey)) {
    day.setDate(day.getDate() - 1);
  }
  for (let guard = 0; guard < 365; guard++) {
    const k = istDayKey(day);
    if (logsByDay(k).includes(habitKey)) {
      streak += 1;
      day.setDate(day.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
