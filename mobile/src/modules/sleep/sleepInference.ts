/**
 * sleepInference — turns the accelerometer timeline into a sleep session.
 *
 * The native tracker records one bucket per minute with the peak movement it
 * saw (m/s^2), the number of seconds of *sustained* movement inside that
 * minute and the number of seconds the screen was interactive. A phone lying
 * still on the mattress produces near-zero values, so "still minutes" = sleep
 * and "moving minutes" = awake. A minute with the screen on is awake no
 * matter what — a phone can sit perfectly still while the user scrolls.
 *
 * The sustained-movement counter is what makes the tracker work with the
 * phone under a pillow: a single bump (the mattress settling) is a short
 * spike, while a real wake-up keeps moving for several seconds.
 *
 * Bedtime: the start of the FIRST still run of at least {@link MIN_SLEEP_RUN_MIN}
 * minutes — a short stretch of stillness before the real sleep (the user
 * resting with the phone at their side, the screen off) is never counted as
 * sleep.
 *
 * Wake time: the last awake gap that starts at or after the wake window.
 * Any gap BEFORE the wake window keeps the night going — a 10-minute phone
 * check at 2 AM is one interruption, not the end of sleep. A gap longer than
 * {@link MAX_MIDNIGHT_INTERRUPTION_MIN} anywhere in the night is a real get-up
 * and splits it — the longer half is reported as the sleep.
 *
 * Interruption rules:
 *  - EVERY awake gap before the wake window is remembered as a wake-up with
 *    its exact length. No gap is ever treated as "the end of sleep" while the
 *    night is still running, and the user is never asked to guess.
 *  - a gap longer than {@link LONG_WAKEUP_MIN} is a LONG wake-up — it is
 *    highlighted in the morning summary notification.
 *  - a gap longer than {@link MAX_MIDNIGHT_INTERRUPTION_MIN} (2 h) is a real
 *    get-up: the night splits there and the longer half is reported.
 *  - an awake gap starting at or after the wake window is the wake-up — the
 *    night ends there.
 *
 * Everything in this file is pure so it can be unit tested without a phone.
 */
import type { MotionBucket, SleepSensitivity } from './sleepMotion';
import { analyzeNight, personalCutoff, type WakeUp } from './sleepScoring';

export { LONG_WAKEUP_MIN } from './sleepScoring';
export type { WakeUp } from './sleepScoring';

/**
 * A still run shorter than this is a rest, not sleep — the phone lying still
 * while the user watches TV, reads or sits up awake. Only runs of at least
 * this length count as sleep when the bedtime is chosen.
 */
export const MIN_SLEEP_RUN_MIN = 20;

/**
 * An awake gap that starts BEFORE the wake window is at most this many
 * minutes and still counts as a long interruption — the night continues and
 * the gap is counted. A gap longer than this is a real get-up: the sleep
 * ends there. (A gap at or after the wake window always ends the night.)
 */
export const MAX_MIDNIGHT_INTERRUPTION_MIN = 120;

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
  /** Sensitivity of the tracker — selects the scoring base cutoff. */
  sensitivity?: SleepSensitivity;
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
  /**
   * Minimum length of a still run to count as sleep when the bedtime is
   * chosen. Defaults to {@link MIN_SLEEP_RUN_MIN}.
   */
  minRunMin?: number;
  /**
   * Longest awake gap that starts BEFORE the wake window and still counts as
   * a long interruption. Defaults to {@link MAX_MIDNIGHT_INTERRUPTION_MIN}.
   */
  maxMidnightInterruptionMin?: number;
  /**
   * Bedtime the user confirmed with "Going to bed" (epoch ms). When present,
   * it anchors the session's start (so an early bedtime is logged exactly) and
   * lets buckets from that moment join the night even when they fall outside
   * the configured window. 0 / absent = infer bedtime from motion only.
   */
  manualBedtimeMs?: number;
}

export interface InferredSleep {
  /** Bedtime (epoch ms). */
  bedTime: number;
  /** Wake time (epoch ms). */
  wakeTime: number;
  /** Number of wake-ups inside the session. */
  interruptions: number;
  /** Every wake-up (5+ min) with its time and length — the "remember it" data. */
  wakeUps: WakeUp[];
  /** Short blips absorbed into sleep by the Webster-style rescoring. */
  microArousals: number;
  /** Minutes scored as sleep inside the session (excludes unknowns). */
  sleepMinutes: number;
  /** Minutes with no bucket at all — never counted as sleep. */
  unknownMinutes: number;
  /** The cutoff actually used, for tuning against real nights. */
  cutoffUsed: number;
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
 * Which NIGHT does this bucket belong to? Identified by the local calendar date
 * of that night's `sleepStart` (the evening it began). Minutes in the daytime
 * gap between windows belong to no night and return null.
 *
 * A window that wraps midnight (21:30 → 09:30) means:
 *   - 22:00 on 16 Nov → night of 16 Nov
 *   - 02:00 on 17 Nov → night of 16 Nov (the same night)
 *   - 14:00 on 17 Nov → daytime → no night
 */
export function nightKeyForMinute(
  minute: number,
  sleepStartMin: number,
  sleepEndMin: number
): number | null {
  const ts = minute * 60000;
  const d = new Date(ts);
  const mod = ((minuteOfDay(ts) % 1440) + 1440) % 1440;
  const start = ((sleepStartMin % 1440) + 1440) % 1440;
  const end = ((sleepEndMin % 1440) + 1440) % 1440;
  const dayIndex = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
  if (start === end) return dayIndex; // "always" window — fall back to calendar day
  if (mod >= start) return dayIndex;
  if (mod <= end) return dayIndex - 1;
  return null; // daytime — never sleep
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

/** One minute of motion: peak + sustained-movement seconds + screen-on seconds. */
export interface SleepMinuteSample {
  peak: number;
  /** Seconds of sustained movement; undefined = legacy bucket (no counter). */
  moving?: number;
  /** Seconds the screen was interactive; undefined = legacy bucket (no counter). */
  screen?: number;
}

/**
 * Is this minute awake? The screen signal is absolute — a minute with the
 * screen interactive is a wake-up no matter what the accelerometer said (the
 * phone can lie perfectly still while the user scrolls).
 */
export function isAwakeSample(
  sample: SleepMinuteSample | undefined,
  threshold: number,
  movingLimit: number
): boolean {
  if (!sample) return false;
  if (typeof sample.screen === 'number' && Number.isFinite(sample.screen)) {
    if (sample.screen > 0) return true;
  }
  if (sample.moving !== undefined) return sample.moving >= movingLimit;
  return sample.peak >= threshold;
}

/** Is this minute still (asleep or at least not moving / not using the phone)? */
export function isStillSample(
  sample: SleepMinuteSample | undefined,
  threshold: number,
  movingLimit: number
): boolean {
  return !isAwakeSample(sample, threshold, movingLimit);
}

/** bucket minute → sample. */
function toSampleMap(buckets: MotionBucket[]): Map<number, SleepMinuteSample> {
  const map = new Map<number, SleepMinuteSample>();
  for (const b of buckets || []) {
    const minute = Math.floor(Number(b?.m));
    const peak = Number(b?.v);
    if (!Number.isFinite(minute) || !Number.isFinite(peak) || minute <= 0) continue;
    const moving =
      typeof b?.s === 'number' && Number.isFinite(b.s) ? b.s : undefined;
    const screen =
      typeof b?.o === 'number' && Number.isFinite(b.o) ? b.o : undefined;
    const prev = map.get(minute);
    if (!prev) {
      map.set(minute, { peak, moving, screen });
    } else {
      const mergedMoving =
        prev.moving === undefined
          ? moving
          : moving === undefined
            ? prev.moving
            : Math.max(prev.moving, moving);
      const mergedScreen =
        prev.screen === undefined
          ? screen
          : screen === undefined
            ? prev.screen
            : Math.max(prev.screen, screen);
      map.set(minute, { peak: Math.max(prev.peak, peak), moving: mergedMoving, screen: mergedScreen });
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

/** Normalize a minute-of-day into 0..1439. */
function modDay(minute: number): number {
  return ((minute % 1440) + 1440) % 1440;
}

/**
 * Project a minute-of-day onto the NIGHT's absolute timeline.
 *
 * A night window that wraps midnight (the default 21:30 → 09:30) starts in the
 * evening and finishes the NEXT calendar day. Comparing minute-of-day values
 * directly is therefore wrong: 22:39 (1359) is numerically greater than the
 * 06:30 wake start (390), but it is the BEGINNING of the night, not after the
 * morning. This was the bug that turned a short evening break into a fake
 * "9:39 pm → 10:39 pm" night.
 *
 * For a wrapping window, evening minutes (>= nightStart) keep their value and
 * morning minutes (< nightStart, i.e. after midnight) get +1440, so the whole
 * night is one increasing line: 21:30 … 23:59 … 00:00 … 09:30.
 */
export function nightAbsoluteMinute(
  minute: number,
  nightStartMin: number,
  nightEndMin: number
): number {
  const m = modDay(minute);
  const start = modDay(nightStartMin);
  const end = modDay(nightEndMin);
  // Only a wrapping night has a "morning belongs to tomorrow" offset. A window
  // that does not cross midnight (start <= end) is a single calendar day.
  return start > end && m < start ? m + 1440 : m;
}

/**
 * Is this minute at or after the wake window, ON THE NIGHT'S TIMELINE?
 *
 * A movement at/after the morning wake window means "the user got up for
 * good"; an earlier movement (including any evening break before midnight) is
 * a short interruption and must never end the night.
 *
 * `nightStartMin` / `nightEndMin` are required so a caller can never forget
 * the wrapping window and reintroduce the evening-is-morning bug.
 */
export function inOrAfterWakeStart(
  minute: number,
  wakeStartMin: number,
  wakeEndMin: number,
  nightStartMin: number,
  nightEndMin: number
): boolean {
  const abs = nightAbsoluteMinute(minute, nightStartMin, nightEndMin);
  const absStart = nightAbsoluteMinute(wakeStartMin, nightStartMin, nightEndMin);
  const absEnd = nightAbsoluteMinute(wakeEndMin, nightStartMin, nightEndMin);
  // The wake window itself may wrap midnight; the small hours before `absStart`
  // are then also "in" it (same rule as the old function, now in night space).
  return absStart <= absEnd ? abs >= absStart : abs >= absStart || abs <= absEnd;
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
 * Infer one session from a timeline that is already confined to a SINGLE night
 * window. Public callers use {@link inferSleepSession}, which groups the raw
 * buckets into nights first — otherwise a still afternoon plus the next
 * evening can be merged into one fictitious 14-hour "night".
 *
 * Model:
 *  - every minute is "still" (phone on the mattress) or "awake" (it moved for
 *    long enough, or the screen was on)
 *  - still stretches separated by a gap of at most MAX_MIDNIGHT_INTERRUPTION_MIN
 *    minutes belong to the same sleep block
 *  - the sleep block with the most still minutes inside the night window wins
 *  - the bedtime is the start of the FIRST still run of at least
 *    MIN_SLEEP_RUN_MIN minutes (the moment the phone was really put down)
 *  - the wake time is the last awake gap at or after the wake window, or the
 *    end of the block when the phone never moved again
 *  - every awake gap inside the session is remembered as a wake-up with its
 *    length; a gap starting at the wake window is the final wake-up instead
 *
 * Returns null when there is no long enough stillness inside the night window.
 */
function inferSingleNight(
  buckets: MotionBucket[],
  options: SleepInferenceOptions,
  /** Latest plausible bedtime (epoch minute) — two thirds into the window. */
  maxBedMin: number = Number.POSITIVE_INFINITY,
  /** The last 7 nights' raw buckets, used to personalise the scoring cutoff. */
  recentNights: MotionBucket[][] = []
): InferredSleep | null {
  const samples = toSampleMap(buckets);
  if (samples.size === 0) return null;

  const minutes = Array.from(samples.keys()).sort((a, b) => a - b);
  const first = minutes[0];
  const last = minutes[minutes.length - 1];
  if (last - first < options.minSessionMin) return null;

  const threshold = options.threshold;
  const movingLimit = options.movingSeconds ?? MOVING_SECONDS_AWAKE;
  const minRunMin = options.minRunMin ?? MIN_SLEEP_RUN_MIN;
  const maxInterruption = options.maxMidnightInterruptionMin ?? MAX_MIDNIGHT_INTERRUPTION_MIN;

  const isStill = (minute: number): boolean => {
    const s = samples.get(minute);
    // A minute without samples means the tracker was off — treat it as still
    // so a restart does not cut the night in half.
    if (!s) return true;
    return isStillSample(s, threshold, movingLimit);
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

  // --- merge runs separated by an interruption that fits the night --------
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
      // Any gap of up to `maxInterruption` (default 120 minutes) — a phone
      // check, a bathroom trip, a long scroll — keeps the night in one block.
      // A longer gap is a real get-up: the night splits there and the longer
      // half is reported as the sleep.
      if (gap <= maxInterruption) {
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

  // The wake window — a movement from this minute on is "the user got up for
  // good", an earlier movement is a short interruption (the phone was checked).
  const wakeStartMin = options.wakeStartMin ?? ((options.sleepEndMin - 60 + 1440) % 1440);
  const wakeEndMin = options.wakeEndMin ?? (options.sleepEndMin % 1440);

  // --- clip the block to the night window ---------------------------------
  // The bedtime is the start of the FIRST still run of at least
  // MIN_SLEEP_RUN_MIN minutes — a short stretch of stillness before the real
  // sleep (the user resting with the phone at their side, screen off) is a
  // rest, not sleep, and never shifts the bedtime earlier.
  const firstSubstantial = best.runs.find((r) => r.end - r.start + 1 >= minRunMin);
  let bedMin = (firstSubstantial ?? best.runs[0]).start;
  while (
    bedMin <= best.end &&
    !inNightWindow(minuteOfDay(bedMin * 60000), options.sleepStartMin, options.sleepEndMin)
  ) {
    bedMin++;
  }

  // --- bedtime: the moment the phone was put down -----------------------
  const bedtimeCandidate = (from: number): number => {
    for (let m = from - 1; m >= Math.max(first, from - 20); m--) {
      const s = samples.get(m);
      if (s && !isStill(m)) return m;
    }
    return from;
  };

  let bedEvent = bedtimeCandidate(bedMin);

  // --- wake time: the last movement at or after the wake window start -----
  const lastGap = gaps.length > 0 ? gaps[gaps.length - 1] : null;
  let wakeEvent: number;
  if (
    lastGap &&
    inOrAfterWakeStart(
      minuteOfDay(lastGap.start * 60000),
      wakeStartMin,
      wakeEndMin,
      options.sleepStartMin,
      options.sleepEndMin
    )
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
  // Still implausible after the fallback: reject rather than report a fake
  // 12+ hour "night" with a high confidence score.
  if (wakeEvent - bedEvent > MAX_PLAUSIBLE_MIN) return null;

  const wakeMin = wakeEvent - 1;
  if (wakeMin < bedMin) return null;

  // A "bedtime" in the morning tail of the window is a still desk/sofa
  // stretch, not sleep onset. Bedtime must fall in the first two thirds of
  // the night window (by 05:30 for the default 21:30–09:30 window).
  if (bedEvent > maxBedMin) return null;

  const bedTime = bedEvent * 60000;
  const wakeTime = wakeEvent * 60000;
  const durationMin = Math.round((wakeTime - bedTime) / 60000);
  if (durationMin < options.minSessionMin) return null;

  // --- wake-ups: windowed, Webster-style scoring ----------------------------
  // Bedtime and wake time above stay on the proven motion-run logic. Inside
  // that range the fine classification comes from sleepScoring: a weighted
  // -4..+2 minute window per minute, a cutoff personalised from the last 7
  // nights, and rescoring that absorbs sub-5-minute blips as micro-arousals.
  // Only 5+ minute awake runs become wakeUps — a brief phone check is no
  // longer reported as an interruption.
  const sensitivity = options.sensitivity ?? 'medium';
  const cutoff = personalCutoff(recentNights, sensitivity);
  const res = analyzeNight(buckets, bedMin, wakeMin, sensitivity, cutoff);
  const wakeUps = res.wakeUps;
  const interruptions = wakeUps.length;

  const stillRatio = bestInWindow / Math.max(1, wakeMin - bedMin + 1);
  const lengthScore = Math.min(1, durationMin / 420);
  const confidence = Math.max(
    0,
    Math.min(1, 0.35 * stillRatio + 0.65 * lengthScore)
  );

  return {
    bedTime,
    wakeTime,
    interruptions,
    wakeUps,
    microArousals: res.microArousals,
    sleepMinutes: res.sleepMinutes,
    unknownMinutes: res.unknownMinutes,
    cutoffUsed: res.cutoffUsed,
    durationMin,
    confidence,
  };
}

/**
 * Infer the most recent real night from the raw (up to 36 h) motion timeline.
 *
 * The tracker deliberately keeps more than one night of buckets so a restart
 * cannot lose data. Inferring over that whole buffer was the bug that produced
 * "8:32 am → 10:31 pm (13h 59m)": a still daytime stretch and the following
 * evening were merged into one block because both touch the night window.
 *
 * Here each bucket is assigned to exactly one night (daytime buckets to none)
 * and inference runs on one night at a time, newest first. The first night
 * that yields a valid session is returned; a short still streak in the current
 * night simply falls through to the previous one instead of becoming a fake
 * 14-hour session.
 */
export function inferSleepSession(
  buckets: MotionBucket[],
  options: SleepInferenceOptions
): InferredSleep | null {
  // A confirmed "Going to bed" time is the single source of truth for the
  // bedtime. It also lets minutes that fell outside the configured window
  // (e.g. a 20:00 bedtime with a 21:30 window) join that night instead of being
  // discarded as "daytime".
  const manualMs =
    options.manualBedtimeMs && options.manualBedtimeMs > 0 ? options.manualBedtimeMs : 0;
  const manualBedMin = manualMs ? Math.floor(manualMs / 60000) : 0;
  const manualMaxMin = manualBedMin + 16 * 60; // bound the override to one night
  let manualKey: number | null = null;
  if (manualBedMin) {
    const d = new Date(manualMs);
    const dayIndex =
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
    manualKey =
      nightKeyForMinute(manualBedMin, options.sleepStartMin, options.sleepEndMin) ??
      // An early bedtime (before the window opens) still belongs to that
      // calendar evening; a post-midnight one belongs to the previous evening.
      (minuteOfDay(manualMs) >= 12 * 60 ? dayIndex : dayIndex - 1);
  }

  const byNight = new Map<number, MotionBucket[]>();
  for (const b of buckets || []) {
    const minute = Math.floor(Number(b?.m));
    if (!Number.isFinite(minute) || minute <= 0) continue;
    const key =
      manualKey !== null && minute >= manualBedMin && minute <= manualMaxMin
        ? manualKey
        : nightKeyForMinute(minute, options.sleepStartMin, options.sleepEndMin);
    if (key === null) continue; // daytime — never part of a sleep session
    const list = byNight.get(key);
    if (list) list.push(b);
    else byNight.set(key, [b]);
  }
  const keys = Array.from(byNight.keys()).sort((a, b) => b - a); // newest night first
  // The personal cutoff is derived from up to 7 recent nights already present
  // in the buffer — no extra storage or native change needed.
  const recentNights = keys.slice(0, 7).map((k) => byNight.get(k)!);
  const lenMin =
    (((options.sleepEndMin - options.sleepStartMin) % 1440) + 1440) % 1440 || 1440;
  for (const key of keys) {
    // The night key is the local calendar date of its evening start.
    const d = new Date(key * 86400000);
    const start = new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      Math.floor(options.sleepStartMin / 60),
      options.sleepStartMin % 60,
      0,
      0
    ).getTime();
    const maxBedMin = Math.floor((start + (lenMin * 60000 * 2) / 3) / 60000);
    let result = inferSingleNight(byNight.get(key)!, options, maxBedMin, recentNights);
    // Motion only sees the phone being put down; the user's tap is earlier and
    // exact. Anchor to it when it precedes the inferred bedtime, provided the
    // resulting night is still a plausible length.
    if (result && manualMs && key === manualKey && manualMs < result.bedTime) {
      const span = result.wakeTime - manualMs;
      if (span > 0 && span <= 16 * 3600_000) {
        result = { ...result, bedTime: manualMs, durationMin: Math.round(span / 60000) };
      }
    }
    if (result) return result;
  }
  return null;
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
    return isStillSample(s, threshold, movingLimit);
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
