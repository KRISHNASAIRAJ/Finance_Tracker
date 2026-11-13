/**
 * sleepStages — turns the motion timeline into the DEEP / LIGHT / AWAKE lanes
 * the home-screen widget draws.
 *
 * The tracker records one bucket per minute with the peak movement it saw and
 * the number of seconds of *sustained* movement inside that minute (the
 * pillow-friendly rule: one bump is not a wake-up, a few seconds of movement
 * is).
 *
 * The rules:
 *   - a minute with sustained movement is **AWAKE**
 *   - a run of still minutes of at least {@link DEEP_RUN_MIN} is **DEEP**
 *   - any other still run is **LIGHT**
 *
 * Pure functions, so they can be unit tested without a phone.
 */
import type { MotionBucket, SleepSensitivity } from './sleepMotion';
import { motionThreshold, movingSecondsThreshold } from './sleepInference';

export type SleepStage = 'deep' | 'light' | 'awake';

/** A still run of at least this many minutes counts as deep sleep. */
export const DEEP_RUN_MIN = 20;

/** One stage segment on the chart: a start and a length, as a fraction of the night. */
export interface StageSegment {
  stage: SleepStage;
  /** Where the segment starts, 0…1 of the night. */
  start: number;
  /** How long it lasts, 0…1 of the night. */
  len: number;
}

export interface StageOptions {
  /** The movement threshold (the legacy rule, for the buckets without a counter). */
  threshold: number;
  /** The sustained seconds that count as awake. */
  movingSeconds: number;
}

/** Is this minute awake? */
export function isAwakeMinute(bucket: MotionBucket, options: StageOptions): boolean {
  // The sustained counter is the reliable rule; the old buckets (s = -1) fall
  // back to the peak movement.
  if (typeof bucket.s === 'number' && bucket.s >= 0) {
    return bucket.s >= options.movingSeconds;
  }
  return bucket.v > options.threshold;
}

/**
 * The stage of every minute of the night, from the bedtime to the wake time.
 * Returns one entry per minute: 'deep' | 'light' | 'awake'.
 */
export function stagePerMinute(
  buckets: MotionBucket[],
  bedMinute: number,
  wakeMinute: number,
  options: StageOptions
): SleepStage[] {
  const total = Math.max(0, wakeMinute - bedMinute);
  const out: SleepStage[] = [];
  const byMinute = new Map<number, MotionBucket>();
  for (const b of buckets) byMinute.set(b.m, b);

  // A first pass: awake or still.
  const still: boolean[] = [];
  for (let i = 0; i < total; i++) {
    const bucket = byMinute.get(bedMinute + i);
    still.push(bucket ? !isAwakeMinute(bucket, options) : true);
  }

  // A second pass: a long still run is deep sleep.
  let runStart = 0;
  while (runStart < total) {
    if (!still[runStart]) {
      out.push('awake');
      runStart += 1;
      continue;
    }
    let runEnd = runStart;
    while (runEnd < total && still[runEnd]) runEnd += 1;
    const stage: SleepStage = runEnd - runStart >= DEEP_RUN_MIN ? 'deep' : 'light';
    for (let i = runStart; i < runEnd; i++) out.push(stage);
    runStart = runEnd;
  }
  return out;
}

/**
 * The stage segments (the bars the widget draws), merged so that each
 * continuous stretch is one bar.
 */
export function stageSegments(
  buckets: MotionBucket[],
  bedMinute: number,
  wakeMinute: number,
  options: StageOptions
): StageSegment[] {
  const perMinute = stagePerMinute(buckets, bedMinute, wakeMinute, options);
  const total = Math.max(1, wakeMinute - bedMinute);
  const segments: StageSegment[] = [];
  perMinute.forEach((stage, index) => {
    const start = index / total;
    const len = 1 / total;
    const last = segments[segments.length - 1];
    if (last && last.stage === stage) {
      last.len += len;
    } else {
      segments.push({ stage, start, len });
    }
  });
  return segments;
}

/** The options for the given sensitivity. */
export function stageOptionsFor(
  sensitivity: SleepSensitivity
): StageOptions {
  return {
    threshold: motionThreshold(sensitivity),
    movingSeconds: movingSecondsThreshold(sensitivity),
  };
}
