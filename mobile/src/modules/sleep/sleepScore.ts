/**
 * sleepScore — the 0–100 score the widget shows next to the duration.
 *
 * It is a weighted read of the night:
 *   - how long you slept (vs. the target)          → 50 points
 *   - how much of it was deep sleep (vs. ~20 %)     → 30 points
 *   - how many times you woke up                    → 20 points
 *
 * Pure, so it can be unit tested without a phone.
 */

/** The default sleep target: 7 h 30 min. */
export const DEFAULT_TARGET_MIN = 450;

/** The share of the night that should be deep sleep for full marks. */
export const IDEAL_DEEP_SHARE = 0.2;

/** Above this many wake-ups the wake-up points are zero. */
export const WAKE_UPS_FOR_ZERO = 4;

export interface SleepScoreInput {
  /** The length of the night, in minutes. */
  durationMin: number;
  /** The minutes of deep sleep. */
  deepMin: number;
  /** The number of wake-ups. */
  interruptions: number;
  /** The target length, in minutes (7 h 30 min by default). */
  targetMin?: number;
}

/** The score, 0–100. */
export function sleepScore(input: SleepScoreInput): number {
  const target = input.targetMin && input.targetMin > 0 ? input.targetMin : DEFAULT_TARGET_MIN;
  const duration = Math.max(0, input.durationMin || 0);
  if (duration <= 0) return 0;

  // How long you slept — 50 points.
  const lengthPoints = Math.min(1, duration / target) * 50;

  // The deep sleep — 30 points.
  const deepShare = duration > 0 ? input.deepMin / duration : 0;
  const deepPoints = Math.min(1, deepShare / IDEAL_DEEP_SHARE) * 30;

  // The wake-ups — 20 points.
  const wakePoints = Math.max(0, 1 - (input.interruptions || 0) / WAKE_UPS_FOR_ZERO) * 20;

  return Math.max(0, Math.min(100, Math.round(lengthPoints + deepPoints + wakePoints)));
}
