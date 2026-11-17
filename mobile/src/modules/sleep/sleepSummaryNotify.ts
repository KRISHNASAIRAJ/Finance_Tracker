/**
 * sleepSummaryNotify — the automatic "last night" notification.
 *
 * Runs from the hourly background task (and on every app foreground). Once a
 * night has settled, it posts one summary: how long the sleep was, how many
 * wake-ups there were, and — for every interruption over LONG_WAKEUP_MIN — the
 * exact minute count and the time it happened. Short wake-ups are included in
 * the count and listed too, so "remember it" covers every interruption.
 *
 * One notification per night: the night key is persisted in AsyncStorage, so
 * the hourly task can never re-post it, even across restarts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_SLEEP_MOTION_CONFIG,
  getMotionBuckets,
  isSleepMotionAvailable,
} from './sleepMotion';
import {
  inferSleepSession,
  LONG_WAKEUP_MIN,
  motionThreshold,
  movingSecondsThreshold,
  type WakeUp,
} from './sleepInference';
import { formatSleepDuration, useSleepStore } from './store';
import { isSleepNightRangeDeleted } from './deletedNights';
import { localDayKey } from '../finance/financeFormat';
import { scheduleImmediate } from '../../services/notificationService';

const NOTIFIED_KEY = 'meridian_sleep_summary_notified';
const MAX_KEYS = 90;
/** The wake event must be this old before it is reported (same as auto-save). */
const SETTLE_MS = 5 * 60 * 1000;
/** Never report a night older than this — the user already knows about it. */
const MAX_SUMMARY_AGE_MS = 14 * 60 * 60 * 1000;
const MIN_SESSION_MIN = 120;

/** "7h 20m · 3 wake-ups. Long: 22 min at 2:15 am. Others: 8 min at 4:03 am." */
export function formatSleepSummary(durationMin: number, wakeUps: WakeUp[]): string {
  const sorted = [...(wakeUps || [])].sort((a, b) => a.startMs - b.startMs);
  const head = `Slept ${formatSleepDuration(durationMin / 60)}`;
  if (sorted.length === 0) return `${head} · no interruptions`;

  const describe = (w: WakeUp) => {
    const time = new Date(w.startMs).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${w.minutes} min at ${time}`;
  };
  const long = sorted.filter((w) => w.minutes > LONG_WAKEUP_MIN);
  const short = sorted.filter((w) => w.minutes <= LONG_WAKEUP_MIN);
  const count = `${sorted.length} wake-up${sorted.length === 1 ? '' : 's'}`;

  if (long.length === 0) return `${head} · ${count}: ${short.map(describe).join(', ')}`;
  if (short.length === 0) return `${head} · ${count}. Long: ${long.map(describe).join(', ')}`;
  return `${head} · ${count}. Long: ${long.map(describe).join(', ')}. Others: ${short.map(describe).join(', ')}`;
}

async function readNotified(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function markNotified(key: string): Promise<void> {
  try {
    const keys = await readNotified();
    if (keys.includes(key)) return;
    keys.push(key);
    const trimmed = keys.slice(-MAX_KEYS);
    await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(trimmed));
  } catch {
    /* best-effort */
  }
}

/**
 * Post the summary for the latest settled night, if it has not been posted.
 * Returns true only when a notification was actually scheduled.
 */
export async function maybePostSleepSummary(now: number = Date.now()): Promise<boolean> {
  if (!isSleepMotionAvailable()) return false;
  try {
    const cfg = useSleepStore.getState().autoConfig ?? DEFAULT_SLEEP_MOTION_CONFIG;
    if (!cfg.enabled) return false;

    const buckets = await getMotionBuckets();
    if (buckets.length === 0) return false;
    const inferred = inferSleepSession(buckets, {
      threshold: motionThreshold(cfg.sensitivity),
      movingSeconds: movingSecondsThreshold(cfg.sensitivity),
      sleepStartMin: cfg.sleepStartMin,
      sleepEndMin: cfg.sleepEndMin,
      minSessionMin: MIN_SESSION_MIN,
      sensitivity: cfg.sensitivity,
      wakeStartMin: cfg.wakeStartMin,
      wakeEndMin: cfg.wakeEndMin,
      manualBedtimeMs: cfg.manualBedtimeMs,
    });
    if (!inferred) return false;

    const age = now - inferred.wakeTime;
    if (age < SETTLE_MS || age > MAX_SUMMARY_AGE_MS) return false;
    if (await isSleepNightRangeDeleted(inferred.bedTime, inferred.wakeTime)) return false;

    const nightKey = localDayKey(new Date(inferred.bedTime));
    const notified = await readNotified();
    if (notified.includes(nightKey)) return false;

    await scheduleImmediate(
      '😴 Last night\'s sleep',
      formatSleepSummary(inferred.durationMin, inferred.wakeUps),
      'sleep-reminders',
      { type: 'sleep_summary', dedupKey: `sleep-summary-${nightKey}` }
    );
    await markNotified(nightKey);
    return true;
  } catch {
    return false;
  }
}

export default maybePostSleepSummary;
