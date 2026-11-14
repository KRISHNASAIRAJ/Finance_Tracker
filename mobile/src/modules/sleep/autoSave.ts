/**
 * autoSave — the "did last night's sleep get logged?" check.
 *
 * The motion tracker records all night, but until now the inferred session
 * was only offered to the user when the Sleep screen opened — so a night
 * almost never landed in the log unless the user remembered to open it.
 *
 * This helper runs on app boot and on foreground: it infers the session from
 * the recorded timeline and saves it once the wake-up has happened (a few
 * minutes ago), when the night has no open question and auto-save is on.
 * Short nights and pending gaps are skipped.
 *
 * Pure logic lives in sleepInference — this is only the plumbing.
 */
import {
  DEFAULT_SLEEP_MOTION_CONFIG,
  getMotionBuckets,
  isSleepMotionAvailable,
} from './sleepMotion';
import { inferSleepSession, motionThreshold, movingSecondsThreshold } from './sleepInference';
import { isSameNight } from './sleepNights';
import { useSleepStore } from './store';

/** A sleep session shorter than this is never accepted as sleep. */
export const MIN_SESSION_MIN = 120;

/**
 * The wake event must be at least this many minutes in the past before the
 * session is auto-saved — an in-progress night is never written.
 */
export const SETTLE_MS = 5 * 60 * 1000;

export async function autoSaveLastNight(
  now: number = Date.now(),
  userId?: string
): Promise<string | null> {
  if (!isSleepMotionAvailable()) return null;
  try {
    const state = useSleepStore.getState();
    const cfg = state.autoConfig ?? DEFAULT_SLEEP_MOTION_CONFIG;
    if (!cfg.enabled || !cfg.autoSave) return null;

    const buckets = await getMotionBuckets();
    const inferred = inferSleepSession(buckets, {
      threshold: motionThreshold(cfg.sensitivity),
      movingSeconds: movingSecondsThreshold(cfg.sensitivity),
      sleepStartMin: cfg.sleepStartMin,
      sleepEndMin: cfg.sleepEndMin,
      minSessionMin: MIN_SESSION_MIN,
      wakeStartMin: cfg.wakeStartMin,
      wakeEndMin: cfg.wakeEndMin,
    });
    if (!inferred) return null;
    // The night may still be running — never auto-save before it settled.
    if (now - inferred.wakeTime < SETTLE_MS) return null;
    // A 5–10 minute gap needs the user's answer first.
    if (inferred.pendingGap) return null;

    const candidate = {
      startTime: new Date(inferred.bedTime).toISOString(),
      endTime: new Date(inferred.wakeTime).toISOString(),
    };
    const existing = state.entries.find((e) => isSameNight(e, candidate));
    if (existing) return existing.id;

    return state.addEntry(
      {
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        quality: null,
        mood: null,
        interruptions: inferred.interruptions,
        notes: 'Detected automatically (motion sensor)',
        source: 'auto-motion',
      },
      userId
    );
  } catch {
    return null;
  }
}
