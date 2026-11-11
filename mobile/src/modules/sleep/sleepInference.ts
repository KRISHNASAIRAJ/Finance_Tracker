/**
 * sleepInference — turns the accelerometer timeline into a sleep session.
 *
 * The native tracker records one bucket per minute with the peak movement it
 * saw (m/s^2) **and** the number of seconds of *sustained* movement inside
 * that minute. A phone lying still on the mattress produces near-zero values,
 * so "still minutes" = sleep and "moving minutes" = awake.
 *
 * The sustained-movement counter is what makes the tracker work with the
 * phone under a pillow: a single bump (the mattress settling) is a short
 * spike, while a real wake-up keeps moving for several seconds.
 *
 * Interruption rules:
 *  - an awake gap of up to 5 minutes is a normal interruption (a quick phone
 *    check) — the night continues and the gap is counted
 *  - an awake gap of 5–10 minutes is ambiguous: in the morning the user is
 *    asked whether it was a long interruption or the end of the sleep
 *  - an awake gap of more than 10 minutes means the sleep ended there
 *
 * Everything in this file is pure so it can be unit tested without a phone.
 */
import type { MotionBucket, SleepSensitivity } from './sleepMotion';

/**
 * Awake gaps shorter than this (turning over, a trip to the bathroom) keep the
 * night in one sleep block.
 */
const MERGE_GAP_MIN = 30;

/**
 * An awake gap of up to this many minutes is a normal interruption — the
 * night continues and the gap is counted as a wake-up.
 */
export const INTERRUPTION_MAX_MIN = 5;

/**
 * A gap longer than {@link INTERRUPTION_MAX_MIN} but not longer than this one
 * needs the user's answer in the morning.
 */
export const AMBIGUOUS_GAP_MAX_MIN = 10;

/**
 * A minute only counts as awake when the movement was sustained for at least
 * this many seconds (pillow friendly).
 */
export const MOVING_SECONDS_AWAKE = 20;

/** Longer than this and the block did not start with the user going to bed. */
const MAX_PLAUSIBLE_MIN = 12 * 60;

export interface SleepInferenceOptions {
  /** Movement (m/s^2) above which a minute counts as "awake" (legacy buckets). */
  threshold: number;
  /** Night window start, minutes from local midnight. */
  sleepStartMin: number;
  /** Night window end, minutes from local midnight (may wrap midnight). */
  sleepEndMin: number;
  /** Shortest session that is accepted as sleep (minutes). */
  minSessionMin: number;
  /**
   * Sustained movement (seconds per minute) needed to call a minute awake.
   * Defaults to {@link MOVING_SECONDS_AWAKE}.
   */
  movingSeconds?: number;
  /**
   * Wake window start (minutes from local midnight). A movement from this
   * minute on means "the user got up for good" — an earlier movement is a
   * short interruption (the phone was checked and put back).
   */
  wakeStartMin?: number;
  /** Wake window end (minutes from local midnight). */
  wakeEndMin?: number;
}

/** A wake gap the user still has to classify in the morning. */
export interface PendingGap {
  /** Epoch ms — the user fell asleep again. */
  startMs: number;
  /** Epoch ms — the user got up. */
  endMs: number;
  /** Length of the gap in minutes. */
  minutes: number;
}

export interface InferredSleep {
  /** Bedtime (epoch ms). */
  bedTime: number;
  /** Wake time (epoch ms). */
  wakeTime: number;
  /** Night wake-ups (a movement burst inside the session). */
  interruptions: number;
  /** Sleep length in minutes. */
  durationMin: number;
  /** 0..1 — how sure we are about this session. */
  confidence: number;
  /**
   * A gap of 5–10 minutes inside the night: the user has to say whether it
   * was a long interruption or the end of the sleep. `null` when there is
   * nothing to answer.
   */
  pendingGap?: PendingGap | null;
}

/** How the user answered the pending-gap question. */
export type PendingGapResolution = 'interruption' | 'ended';

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

/**
 * Sustained movement (seconds per minute) needed to call a minute awake, per
 * sensitivity. A phone under a pillow shakes the whole mattress, so the
 * tracker needs *sustained* movement instead of a single spike.
 */
export function movingSecondsThreshold(sensitivity: SleepSensitivity): number {
  switch (sensitivity) {
    case 'low':
      return 30;
    case 'high':
      return 12;
    default:
      return MOVING_SECONDS_AWAKE;
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

/** One minute of motion: the peak value plus the sustained-movement seconds. */
interface MinuteSample {
  peak: number;
  /** Seconds of sustained movement; undefined = legacy bucket (no counter). */
  moving?: number;
}

/** bucket minute → sample. */
function toSampleMap(buckets: MotionBucket[]): Map<number, MinuteSample> {
  const map = new Map<number, MinuteSample>();
  for (const b of buckets || []) {
    const minute = Math.floor(Number(b?.m));
    const peak = Number(b?.v);
    if (!Number.isFinite(minute) || !Number.isFinite(peak) || minute <= 0) continue;
    const moving =
      typeof b?.s === 'number' && Number.isFinite(b.s) ? b.s : undefined;
    const prev = map.get(minute);
    if (!prev) {
      map.set(minute, { peak, moving });
    } else {
      const mergedMoving =
        prev.moving === undefined
          ? moving
          : moving === undefined
            ? prev.moving
            : Math.max(prev.moving, moving);
      map.set(minute, { peak: Math.max(prev.peak, peak), moving: mergedMoving });
    }
  }
  return map;
}

/** An awake stretch inside the night. */
interface Gap {
  start: number;
  end: number;
  minutes: number;
}

/**
 * Is this minute-of-day at or after the wake window? A movement inside (or
 * after) the wake window means the user got up for good; an earlier movement
 * is a short interruption.
 */
export function inOrAfterWakeStart(minute: number, wakeStartMin: number, wakeEndMin: number): boolean {
  const m = ((minute % 1440) + 1440) % 1440;
  const s = ((wakeStartMin % 1440) + 1440) % 1440;
  const e = ((wakeEndMin % 1440) + 1440) % 1440;
  if (s <= e) return m >= s;
  // The wake window wraps midnight.
  return m >= s || m <= e;
}

/**
 * The absolute minute inside [blockStart, blockEnd] whose minute-of-day is
 * closest to the target (the end of the wake window).
 */
function absoluteMinuteFor(blockStart: number, blockEnd: number, targetMin: number): number {
  let best = blockStart;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let m = blockStart; m <= blockEnd; m++) {
    const d = minuteOfDay(m * 60000);
    const diff = Math.min(Math.abs(d - targetMin), 1440 - Math.abs(d - targetMin));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = m;
    }
  }
  return best;
}

/**
 * Infer the last sleep session from the motion timeline.
 *
 * Model:
 *  - every minute is "still" (phone on the mattress) or "awake" (it moved for
 *    long enough)
 *  - still stretches separated by a short awake gap belong to the same sleep
 *    block
 *  - the sleep block with the most still minutes inside the night window wins
 *  - the bedtime is the moment the phone was put down (the last movement
 *    right before the block), the wake time the moment it was picked up
 *  - awake gaps inside the session are interruptions (up to 5 min), ambiguous
 *    (5–10 min — the user is asked in the morning) or the end of the sleep
 *    (more than 10 min)
 *
 * Returns null when there is no long enough stillness inside the night window.
 */
export function inferSleepSession(
  buckets: MotionBucket[],
  options: SleepInferenceOptions
): InferredSleep | null {
  const samples = toSampleMap(buckets);
  if (samples.size === 0) return null;

  const minutes = Array.from(samples.keys()).sort((a, b) => a - b);
  const first = minutes[0];
  const last = minutes[minutes.length - 1];
  if (last - first < options.minSessionMin) return null;

  const threshold = options.threshold;
  const movingLimit = options.movingSeconds ?? MOVING_SECONDS_AWAKE;

  const isStill = (minute: number): boolean => {
    const s = samples.get(minute);
    // A minute without samples means the tracker was off — treat it as still
    // so a restart does not cut the night in half.
    if (!s) return true;
    // A bucket with the sustained-movement counter decides on that counter:
    // a single bump under a pillow is not a wake-up.
    if (s.moving !== undefined) return s.moving < movingLimit;
    return s.peak < threshold;
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

  // --- the awake gaps inside the winning block ----------------------------
  const gaps: Gap[] = [];
  let g = best.start;
  while (g <= best.end) {
    if (isStill(g)) {
      g++;
      continue;
    }
    let e = g;
    while (e + 1 <= best.end && !isStill(e + 1)) e++;
    gaps.push({ start: g, end: e, minutes: e - g + 1 });
    g = e + 1;
  }

  // A gap of more than 10 minutes means the sleep ended there.
  const endingGap = gaps.find((x) => x.minutes > AMBIGUOUS_GAP_MAX_MIN) || null;
  // A gap of 5–10 minutes is ambiguous — the user answers in the morning.
  const ambiguousGap =
    gaps.find(
      (x) => x.minutes > INTERRUPTION_MAX_MIN && x.minutes <= AMBIGUOUS_GAP_MAX_MIN
    ) || null;

  // --- clip the block to the night window ---------------------------------
  let bedMin = best.start;
  while (
    bedMin <= best.end &&
    !inNightWindow(minuteOfDay(bedMin * 60000), options.sleepStartMin, options.sleepEndMin)
  ) {
    bedMin++;
  }

  // The wake window — a movement from this minute on is "the user got up for
  // good", an earlier movement is a short interruption (the phone was checked).
  const wakeStartMin = options.wakeStartMin ?? ((options.sleepEndMin - 60 + 1440) % 1440);
  const wakeEndMin = options.wakeEndMin ?? (options.sleepEndMin % 1440);

  // --- bedtime: the moment the phone was put down -----------------------
  const bedtimeCandidate = (from: number): number => {
    for (let m = from - 1; m >= Math.max(first, from - 20); m--) {
      const s = samples.get(m);
      if (s && !isStill(m)) return m;
    }
    return from;
  };

  let bedEvent = bedtimeCandidate(bedMin);

  // --- wake time: the moment the user picked the phone up for good ---------
  const lastGap = gaps.length > 0 ? gaps[gaps.length - 1] : null;
  let wakeEvent: number;
  if (endingGap && endingGap.start > bedEvent) {
    // A long awake gap (> 10 min) — the sleep ended right there.
    wakeEvent = endingGap.start;
  } else if (
    lastGap &&
    inOrAfterWakeStart(minuteOfDay(lastGap.start * 60000), wakeStartMin, wakeEndMin)
  ) {
    // The last movement is in the wake window — that is the wake-up.
    wakeEvent = lastGap.start;
  } else {
    // The night went on after the last movement (the phone was checked in the
    // middle of the night and stayed under the pillow). The sleep lasts at
    // least until the end of the wake window.
    const windowEnd = absoluteMinuteFor(best.start, best.end, wakeEndMin);
    wakeEvent = Math.min(best.end + 1, windowEnd);
  }
  if (wakeEvent <= bedEvent) {
    // Fall back to the end of the main sleep stretch.
    wakeEvent = best.core.end + 1;
  }

  // A session longer than any human sleep means the block did not start with
  // the user going to bed — fall back to the main sleep stretch.
  if (wakeEvent - bedEvent > MAX_PLAUSIBLE_MIN) {
    const coreEvent = bedtimeCandidate(best.core.start);
    if (wakeEvent - coreEvent < wakeEvent - bedEvent) bedEvent = coreEvent;
  }

  const wakeMin = wakeEvent - 1;
  if (wakeMin < bedMin) return null;

  const bedTime = bedEvent * 60000;
  const wakeTime = wakeEvent * 60000;
  const durationMin = Math.round((wakeTime - bedTime) / 60000);
  if (durationMin < options.minSessionMin) return null;

  // --- interruptions: the awake gaps of up to 5 minutes inside the night --
  let interruptions = 0;
  for (const gap of gaps) {
    if (gap.start < bedMin || gap.end > wakeMin) continue;
    if (gap.minutes <= INTERRUPTION_MAX_MIN) interruptions++;
  }

  const pendingGap: PendingGap | null =
    ambiguousGap && ambiguousGap.start >= bedMin && ambiguousGap.start <= wakeMin
      ? {
          startMs: ambiguousGap.start * 60000,
          endMs: (ambiguousGap.end + 1) * 60000,
          minutes: ambiguousGap.minutes,
        }
      : null;

  const stillRatio = bestInWindow / Math.max(1, wakeMin - bedMin + 1);
  const lengthScore = Math.min(1, durationMin / 420);
  const confidence = Math.max(
    0,
    Math.min(1, 0.35 * stillRatio + 0.65 * lengthScore)
  );

  return { bedTime, wakeTime, interruptions, durationMin, confidence, pendingGap };
}

/**
 * Apply the user's answer to the pending gap.
 *
 *  - `ended` — the sleep ended when the user got up: the night stops there.
 *  - `interruption` — the user was up for a while and then went back to bed:
 *    the awake minutes are taken out of the sleep (the night ends that much
 *    earlier) and the gap is counted as one more interruption.
 */
export function resolvePendingGap(
  session: InferredSleep,
  resolution: PendingGapResolution,
  awakeMinutes?: number
): InferredSleep {
  const gap = session.pendingGap;
  if (!gap) return session;

  if (resolution === 'ended') {
    const wakeTime = Math.max(session.bedTime, gap.startMs);
    return {
      ...session,
      wakeTime,
      durationMin: Math.max(0, Math.round((wakeTime - session.bedTime) / 60000)),
      pendingGap: null,
    };
  }

  const minutes = Math.max(0, Math.round(awakeMinutes ?? gap.minutes));
  const wakeTime = Math.max(session.bedTime, session.wakeTime - minutes * 60000);
  return {
    ...session,
    wakeTime,
    durationMin: Math.max(0, Math.round((wakeTime - session.bedTime) / 60000)),
    interruptions: session.interruptions + 1,
    pendingGap: null,
  };
}

/**
 * The current stillness streak (how long the phone has not moved).
 * Returns null when the phone is moving or there is no data.
 */
export function currentStillness(
  buckets: MotionBucket[],
  threshold: number,
  movingSeconds?: number
): { sinceMs: number; minutes: number } | null {
  const samples = toSampleMap(buckets);
  if (samples.size === 0) return null;
  const movingLimit = movingSeconds ?? MOVING_SECONDS_AWAKE;
  const isStill = (minute: number): boolean => {
    const s = samples.get(minute);
    if (!s) return true;
    if (s.moving !== undefined) return s.moving < movingLimit;
    return s.peak < threshold;
  };
  const minutes = Array.from(samples.keys()).sort((a, b) => a - b);
  const last = minutes[minutes.length - 1];
  if (!isStill(last)) return null;

  let start = last;
  while (start - 1 >= minutes[0]) {
    if (!isStill(start - 1)) break;
    start--;
  }
  return { sinceMs: start * 60000, minutes: last - start + 1 };
}
