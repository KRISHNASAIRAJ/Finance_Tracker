/**
 * sleepInference — turns the accelerometer timeline into a sleep session.
 *
 * The native tracker records one bucket per minute with the peak movement it
 * saw (m/s^2). A phone lying still on the mattress produces near-zero values,
 * so "still minutes" = sleep and "moving minutes" = awake.
 *
 * Everything in this file is pure so it can be unit tested without a phone.
 */
import type { MotionBucket, SleepSensitivity } from './sleepMotion';

/**
 * Awake gaps shorter than this (turning over, a trip to the bathroom) keep the
 * night in one sleep block.
 */
const MERGE_GAP_MIN = 30;

/** Longer than this and the block did not start with the user going to bed. */
const MAX_PLAUSIBLE_MIN = 12 * 60;

export interface SleepInferenceOptions {
  /** Movement (m/s^2) above which a minute counts as "awake". */
  threshold: number;
  /** Night window start, minutes from local midnight. */
  sleepStartMin: number;
  /** Night window end, minutes from local midnight (may wrap midnight). */
  sleepEndMin: number;
  /** Shortest session that is accepted as sleep (minutes). */
  minSessionMin: number;
}

export interface InferredSleep {
  /** Bedtime (epoch ms). */
  bedTime: number;
  /** Wake time (epoch ms). */
  wakeTime: number;
  /** Night wake-ups (a movement burst of 2+ minutes inside the session). */
  interruptions: number;
  /** Sleep length in minutes. */
  durationMin: number;
  /** 0..1 — how sure we are about this session. */
  confidence: number;
}

/** Movement threshold per sensitivity (mirrors SleepMotionConfig.threshold). */
export function motionThreshold(sensitivity: SleepSensitivity): number {
  switch (sensitivity) {
    case 'low':
      return 0.6;
    case 'high':
      return 0.2;
    default:
      return 0.35;
  }
}

/** Minutes from local midnight for an epoch timestamp. */
export function minuteOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Is this minute-of-day inside the night window? The window may wrap midnight
 * (e.g. 21:00 → 12:00).
 */
export function inNightWindow(minute: number, startMin: number, endMin: number): boolean {
  const m = ((minute % 1440) + 1440) % 1440;
  const s = ((startMin % 1440) + 1440) % 1440;
  const e = ((endMin % 1440) + 1440) % 1440;
  if (s === e) return true;
  if (s < e) return m >= s && m <= e;
  return m >= s || m <= e;
}

/** bucket minute → peak movement. */
function toValueMap(buckets: MotionBucket[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const b of buckets || []) {
    const minute = Math.floor(Number(b?.m));
    const value = Number(b?.v);
    if (!Number.isFinite(minute) || !Number.isFinite(value) || minute <= 0) continue;
    const prev = map.get(minute);
    map.set(minute, prev === undefined ? value : Math.max(prev, value));
  }
  return map;
}

/**
 * Infer the last sleep session from the motion timeline.
 *
 * Model:
 *  - every minute is "still" (phone on the mattress) or "awake" (it moved)
 *  - still stretches separated by a short awake gap (< 30 min — turning over,
 *    a trip to the bathroom) belong to the same sleep block
 *  - the sleep block with the most still minutes inside the night window wins
 *  - the bedtime is the moment the phone was put down (the last movement
 *    right before the block), the wake time the moment it was picked up
 *
 * Returns null when there is no long enough stillness inside the night window.
 */
export function inferSleepSession(
  buckets: MotionBucket[],
  options: SleepInferenceOptions
): InferredSleep | null {
  const values = toValueMap(buckets);
  if (values.size === 0) return null;

  const minutes = Array.from(values.keys()).sort((a, b) => a - b);
  const first = minutes[0];
  const last = minutes[minutes.length - 1];
  if (last - first < options.minSessionMin) return null;

  const threshold = options.threshold;
  const isStill = (minute: number): boolean => {
    const v = values.get(minute);
    // A minute without samples means the tracker was off — treat it as still
    // so a restart does not cut the night in half.
    return v === undefined ? true : v < threshold;
  };

  // --- split the timeline into still runs --------------------------------
  interface Run {
    start: number;
    end: number;
  }
  const runs: Run[] = [];
  let cursor = first;
  while (cursor <= last) {
    if (!isStill(cursor)) {
      cursor++;
      continue;
    }
    const start = cursor;
    while (cursor + 1 <= last && isStill(cursor + 1)) cursor++;
    runs.push({ start, end: cursor });
    cursor++;
  }
  if (runs.length === 0) return null;

  // --- merge runs separated by a short awake gap --------------------------
  interface Block {
    start: number;
    end: number;
    /** All still runs of the block. */
    runs: Run[];
    /** The longest run — the main sleep stretch (used for the wake time). */
    core: Run;
  }
  const blocks: Block[] = [];
  for (const run of runs) {
    const prev = blocks[blocks.length - 1];
    if (prev) {
      const gap = run.start - prev.end - 1;
      if (gap < MERGE_GAP_MIN) {
        prev.end = run.end;
        prev.runs.push(run);
        if (run.end - run.start > prev.core.end - prev.core.start) prev.core = run;
        continue;
      }
    }
    blocks.push({
      start: run.start,
      end: run.end,
      runs: [run],
      core: run,
    });
  }

  // --- pick the block with the most still minutes inside the night window -
  let best: Block | null = null;
  let bestInWindow = 0;
  for (const block of blocks) {
    let inWindow = 0;
    for (let m = block.start; m <= block.end; m++) {
      if (isStill(m) && inNightWindow(minuteOfDay(m * 60000), options.sleepStartMin, options.sleepEndMin)) {
        inWindow++;
      }
    }
    if (inWindow > bestInWindow) {
      bestInWindow = inWindow;
      best = block;
    }
  }
  if (!best || bestInWindow <= 0) return null;

  // --- clip the block to the night window ---------------------------------
  let bedMin = best.start;
  while (
    bedMin <= best.end &&
    !inNightWindow(minuteOfDay(bedMin * 60000), options.sleepStartMin, options.sleepEndMin)
  ) {
    bedMin++;
  }
  // The wake time comes from the main sleep stretch — the phone may well lie
  // still on the bed for a while after the user got up.
  let wakeMin = best.core.end;
  while (
    wakeMin >= bedMin &&
    !inNightWindow(minuteOfDay(wakeMin * 60000), options.sleepStartMin, options.sleepEndMin)
  ) {
    wakeMin--;
  }
  if (wakeMin < bedMin) return null;

  // --- bedtime: the moment the phone was put down -----------------------
  const bedtimeCandidate = (from: number): number => {
    for (let m = from - 1; m >= Math.max(first, from - 20); m--) {
      const v = values.get(m);
      if (v !== undefined && v >= threshold) return m;
    }
    return from;
  };

  let bedEvent = bedtimeCandidate(bedMin);
  let wakeEvent = wakeMin + 1;
  for (let m = wakeMin + 1; m <= Math.min(last, wakeMin + 20); m++) {
    const v = values.get(m);
    if (v !== undefined && v >= threshold) {
      wakeEvent = m;
      break;
    }
  }

  // A session longer than any human sleep means the block did not start with
  // the user going to bed — fall back to the main sleep stretch.
  if (wakeEvent - bedEvent > MAX_PLAUSIBLE_MIN) {
    const coreEvent = bedtimeCandidate(best.core.start);
    if (wakeEvent - coreEvent < wakeEvent - bedEvent) bedEvent = coreEvent;
  }

  const bedTime = bedEvent * 60000;
  const wakeTime = wakeEvent * 60000;
  const durationMin = Math.round((wakeTime - bedTime) / 60000);
  if (durationMin < options.minSessionMin) return null;

  // --- interruptions: awake gaps of 2+ minutes inside the session --------
  let interruptions = 0;
  let k = bedMin;
  while (k <= wakeMin) {
    const v = values.get(k);
    const awake = v !== undefined && v >= threshold;
    if (!awake) {
      k++;
      continue;
    }
    let e = k;
    while (e + 1 <= wakeMin) {
      const vv = values.get(e + 1);
      if (vv !== undefined && vv >= threshold) e++;
      else break;
    }
    if (e - k + 1 >= 2) interruptions++;
    k = e + 1;
  }

  const stillRatio = bestInWindow / Math.max(1, wakeMin - bedMin + 1);
  const lengthScore = Math.min(1, durationMin / 420);
  const confidence = Math.max(
    0,
    Math.min(1, 0.35 * stillRatio + 0.65 * lengthScore)
  );

  return { bedTime, wakeTime, interruptions, durationMin, confidence };
}

/**
 * The current stillness streak (how long the phone has not moved).
 * Returns null when the phone is moving or there is no data.
 */
export function currentStillness(
  buckets: MotionBucket[],
  threshold: number
): { sinceMs: number; minutes: number } | null {
  const values = toValueMap(buckets);
  if (values.size === 0) return null;
  const minutes = Array.from(values.keys()).sort((a, b) => a - b);
  const last = minutes[minutes.length - 1];
  const v = values.get(last);
  if (v !== undefined && v >= threshold) return null;

  let start = last;
  while (start - 1 >= minutes[0]) {
    const prev = values.get(start - 1);
    if (prev !== undefined && prev >= threshold) break;
    start--;
  }
  return { sinceMs: start * 60000, minutes: last - start + 1 };
}
