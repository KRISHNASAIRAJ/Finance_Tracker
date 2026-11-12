/**
 * peopleCadence — the "keep in touch" interval maths.
 *
 * Every person has their own cadence:
 *   weekly   → every 7 days
 *   monthly  → every calendar month (31 Jan → 28/29 Feb)
 *   days_45  → every 45 days
 *   custom   → every N days
 *
 * The next due date is the last contact + the interval. A person who has
 * never been contacted becomes due after ONE FULL INTERVAL (not today) —
 * the list should not start with a wall of overdue names.
 *
 * Pure functions, so they can be unit tested without a phone.
 */

export type PeopleCadence = 'weekly' | 'monthly' | 'days_45' | 'custom';

/** The cadence options, in the order they are shown. */
export const CADENCE_OPTIONS: { id: PeopleCadence; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'days_45', label: 'Every 45 days' },
  { id: 'custom', label: 'Every N days' },
];

/** The default cadence for a new person. */
export const DEFAULT_CADENCE: PeopleCadence = 'monthly';

/** The minimum number of days for a custom cadence. */
export const MIN_CUSTOM_DAYS = 1;

/**
 * The length of one interval in days. "monthly" is reported as 30 here — the
 * real calculation uses the calendar (see nextDueFrom).
 */
export function intervalDays(cadence: PeopleCadence, customDays?: number): number {
  switch (cadence) {
    case 'weekly':
      return 7;
    case 'days_45':
      return 45;
    case 'custom':
      return Math.max(MIN_CUSTOM_DAYS, Math.round(Number(customDays) || 0) || MIN_CUSTOM_DAYS);
    case 'monthly':
    default:
      return 30;
  }
}

/** The label the UI shows for a cadence. */
export function cadenceLabel(cadence: PeopleCadence, customDays?: number): string {
  if (cadence === 'custom') {
    return `Every ${intervalDays('custom', customDays)} days`;
  }
  return CADENCE_OPTIONS.find((c) => c.id === cadence)?.label ?? 'Monthly';
}

/**
 * Add one calendar month, clamped to the last day of the month
 * (31 Jan + 1 month → 28/29 Feb, never 3 March).
 */
export function addMonth(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  // The target month (with the year rollover).
  const targetYear = month === 11 ? year + 1 : year;
  const targetMonth = (month + 1) % 12;
  // The last day of the TARGET month — 31 Jan → 28/29 Feb, never 3 March.
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const next = new Date(targetYear, targetMonth, Math.min(day, lastDay));
  next.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
  return next;
}

/** Add a number of days. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * The next due date.
 *
 * @param lastContactedAt when the person was last contacted (null = never)
 * @param cadence the interval
 * @param customDays the length of a custom interval
 * @param now the reference point (the interval starts from now for a person
 *        who was never contacted)
 */
export function nextDueFrom(
  lastContactedAt: Date | null | undefined,
  cadence: PeopleCadence,
  customDays?: number,
  now: Date = new Date()
): Date {
  // Never contacted → due after one full interval.
  if (!lastContactedAt || !Number.isFinite(new Date(lastContactedAt).getTime())) {
    return addInterval(now, cadence, customDays);
  }
  return addInterval(new Date(lastContactedAt), cadence, customDays);
}

/** Add one interval to a date. */
export function addInterval(from: Date, cadence: PeopleCadence, customDays?: number): Date {
  if (cadence === 'monthly') return addMonth(from);
  return addDays(from, intervalDays(cadence, customDays));
}

/**
 * Whole days until the due date (negative = overdue).
 *
 * Calendar days, not 24-hour chunks: something due later today is "due
 * today", not "due tomorrow".
 */
export function daysUntilDue(dueAt: Date | string, now: Date = new Date()): number {
  const due = new Date(dueAt);
  if (!Number.isFinite(due.getTime())) return 0;
  const MS_PER_DAY = 86400000;
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((dueDay - today) / MS_PER_DAY);
}

/** Is the person due (today or earlier)? */
export function isDue(dueAt: Date | string, now: Date = new Date()): boolean {
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return false;
  return due <= now.getTime() + 86400000 - 1;
}

/** Is the person overdue (the due date is in the past)? */
export function isOverdue(dueAt: Date | string, now: Date = new Date()): boolean {
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return due < today;
}

/** "Due today" / "3 days ago" / "in 12 days". */
export function dueLabel(dueAt: Date | string, now: Date = new Date()): string {
  const days = daysUntilDue(dueAt, now);
  if (days < 0) {
    const n = Math.abs(days);
    return n === 1 ? '1 day ago' : `${n} days ago`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `in ${days} days`;
}
