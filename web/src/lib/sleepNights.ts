/**
 * sleepNights — "are these two records the same night?".
 *
 * Mirrors mobile/src/modules/sleep/sleepNights.ts (the web app does not
 * share a package with the mobile app).
 *
 * A night can end up in the log more than once — the motion tracker detects
 * it, the user logs it by hand, the quick log adds it. Two records that belong
 * to the SAME night must never sit next to each other.
 *
 * The rule: two sessions are the same night when
 *   - their time ranges overlap (an auto-detected night and a manual log of
 *     the same hours), or
 *   - they start less than 60 minutes apart (the same bedtime, logged twice
 *     with a different wake time).
 */

/** Two sessions that start less than this many minutes apart are one night. */
export const SAME_NIGHT_START_GAP_MIN = 60

export interface SleepRange {
  startTime: string
  endTime: string
}

/** Do the two sessions describe the same night? */
export function isSameNight(a: SleepRange, b: SleepRange): boolean {
  const aStart = new Date(a.startTime).getTime()
  const aEnd = new Date(a.endTime).getTime()
  const bStart = new Date(b.startTime).getTime()
  const bEnd = new Date(b.endTime).getTime()
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return false
  // They overlap — the same hours logged twice.
  if (aStart < bEnd && bStart < aEnd) return true
  // They start close together — the same bedtime logged twice.
  return Math.abs(aStart - bStart) <= SAME_NIGHT_START_GAP_MIN * 60000
}

/** The first entry that belongs to the same night as the candidate. */
export function findSameNight<T extends SleepRange>(
  entries: T[],
  candidate: SleepRange
): T | null {
  return entries.find((e) => isSameNight(e, candidate)) ?? null
}
