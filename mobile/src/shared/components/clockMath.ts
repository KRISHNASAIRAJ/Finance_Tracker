/**
 * clockFace — the maths of the round clock.
 *
 * The dial is a circle: 12 o'clock is straight up and the values run
 * clockwise. A value is an angle from the top:
 *   - the hours are 30° apart (12 steps)
 *   - the minutes are 6° apart (60 steps)
 *
 * Pure functions, so they can be unit tested without a phone.
 */

export type ClockMode = 'hours' | 'minutes';
export type ClockPeriod = 'AM' | 'PM';

/** Normalise an angle to [0, 360). */
export function normalizeAngle(deg: number): number {
  const a = deg % 360;
  return a < 0 ? a + 360 : a;
}

/** The angle of a minute value (0–59) on the dial. */
export function angleForMinutes(minute: number): number {
  return normalizeAngle(minute * 6);
}

/** The angle of an hour value (0–11) on the dial. */
export function angleForHours(hour12: number): number {
  return normalizeAngle(hour12 * 30);
}

/**
 * The angle of the hour hand — it creeps forward with the minutes, like a
 * real clock.
 */
export function angleForHourHand(hour12: number, minute: number): number {
  return normalizeAngle((hour12 + minute / 60) * 30);
}

/** The minute value under an angle (0–59). */
export function minutesFromAngle(deg: number): number {
  return Math.round(normalizeAngle(deg) / 6) % 60;
}

/** The hour value under an angle (0–11, 0 = 12 o'clock). */
export function hoursFromAngle(deg: number): number {
  return Math.round(normalizeAngle(deg) / 30) % 12;
}

/**
 * The angle closest to `angle` that is equivalent to it — so a hand never
 * spins all the way round when the value moves from 59 to 0.
 */
export function nearestEquivalent(angle: number, reference: number): number {
  const diff = ((angle - reference + 540) % 360) - 180;
  return reference + diff;
}

/** 24h → the 12-hour value (0–11). */
export function hour12From24(hours24: number): number {
  return ((Math.round(hours24) % 12) + 12) % 12;
}

/** 24h → AM / PM. */
export function periodFrom24(hours24: number): ClockPeriod {
  return hours24 >= 12 ? 'PM' : 'AM';
}

/** The 12-hour value + the period → 24h. */
export function hours24From(hour12: number, period: ClockPeriod): number {
  const h = ((Math.round(hour12) % 12) + 12) % 12;
  return period === 'PM' ? h + 12 : h;
}

/** "09:30" (24h, minutes) → "9:30 AM". */
export function formatClock(hours24: number, minute: number): string {
  const h = hour12From24(hours24);
  const period = periodFrom24(hours24);
  return `${h === 0 ? 12 : h}:${String(minute).padStart(2, '0')} ${period}`;
}
