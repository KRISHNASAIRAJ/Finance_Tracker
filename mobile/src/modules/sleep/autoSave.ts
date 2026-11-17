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
import { isSleepNightRangeDeleted } from './deletedNights';
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
      sensitivity: cfg.sensitivity,
      wakeStartMin: cfg.wakeStartMin,
      wakeEndMin: cfg.wakeEndMin,
      // A "Going to bed" tap is the exact bedtime — use it instead of the
      // first motion sample so an early night is logged from the tap time.
      manualBedtimeMs: cfg.manualBedtimeMs,
    });
    if (!inferred) return null;
    // The user deleted this night — nothing automatic may bring it back.
    if (await isSleepNightRangeDeleted(inferred.bedTime, inferred.wakeTime)) return null;
    // The night may still be running — never auto-save before it settled.
    if (now - inferred.wakeTime < SETTLE_MS) return null;

    const candidate = {
      startTime: new Date(inferred.bedTime).toISOString(),
      endTime: new Date(inferred.wakeTime).toISOString(),
    };
    const existing = state.entries.find((e) => isSameNight(e, candidate));
    if (existing) {
      // A row that started as the hourly live backup becomes the final record
      // — same id, full times, one row per night, no duplicate.
      if (String(existing.id).startsWith('live_')) {
        state.editEntry(
          existing.id,
          {
            startTime: candidate.startTime,
            endTime: candidate.endTime,
            interruptions: inferred.interruptions,
            wakeUps: inferred.wakeUps,
            microArousals: inferred.microArousals,
            sleepMinutes: inferred.sleepMinutes,
            unknownMinutes: inferred.unknownMinutes,
            cutoffUsed: inferred.cutoffUsed,
            notes: 'Detected automatically (motion sensor)',
            source: 'auto-motion',
          },
          userId,
        );
      }
      return existing.id;
    }

    return state.addEntry(
      {
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        quality: null,
        mood: null,
        interruptions: inferred.interruptions,
        wakeUps: inferred.wakeUps,
        microArousals: inferred.microArousals,
        sleepMinutes: inferred.sleepMinutes,
        unknownMinutes: inferred.unknownMinutes,
        cutoffUsed: inferred.cutoffUsed,
        notes: 'Detected automatically (motion sensor)',
        source: 'auto-motion',
      },
      userId
    );
  } catch {
    return null;
  }
}
