/**
 * Pure day-key helpers. Day keys are IST calendar days (YYYY-MM-DD), but the
 * math here uses UTC so a test run in any timezone gets the same answer.
 */

const MS_PER_DAY = 86_400_000;

export function dayToUtc(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

export function utcToDay(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(day: string, count: number): string {
  return utcToDay(dayToUtc(day) + count * MS_PER_DAY);
}

/** 0 = Sunday, 1 = Monday, ... 6 = Saturday. */
export function weekdayOf(day: string): number {
  return new Date(dayToUtc(day)).getUTCDay();
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayToUtc(to) - dayToUtc(from)) / MS_PER_DAY);
}

/** Inclusive: day is within the last `n` days ending at `today`. */
export function withinLastDays(day: string, today: string, n: number): boolean {
  const diff = daysBetween(day, today);
  return diff >= 0 && diff < n;
}
