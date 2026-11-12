/**
 * sleepMotion — JS bridge to the native automatic sleep tracker (Android).
 *
 * The native side (SleepMotionService) runs a foreground service that samples
 * the accelerometer all night and stores one bucket per minute with the peak
 * movement. This module starts/stops that service and hands the timeline to
 * JS, where the sleep session is inferred.
 *
 * Degrades gracefully: on iOS / Expo Go (module missing) every call is a no-op
 * and `isSleepMotionAvailable()` returns false.
 */
import { NativeModules, Platform } from 'react-native';

export type SleepSensitivity = 'low' | 'medium' | 'high';
export type SleepAlarmMode = 'smart' | 'fixed';

export interface SleepMotionConfig {
  /** Tracking on/off. */
  enabled: boolean;
  /** How small a movement counts as "awake" (higher = more sensitive). */
  sensitivity: SleepSensitivity;
  /** Night window start, minutes from local midnight. */
  sleepStartMin: number;
  /** Night window end, minutes from local midnight (may wrap midnight). */
  sleepEndMin: number;
  /** Smart alarm on/off. */
  alarmEnabled: boolean;
  /** smart = ring on the first movement inside the window, fixed = ring at wakeStart. */
  alarmMode: SleepAlarmMode;
  /** Alarm window start, minutes from local midnight. */
  wakeStartMin: number;
  /** Alarm window end, minutes from local midnight. */
  wakeEndMin: number;
  /** How long the alarm rings (minutes). */
  alarmDurationMin: number;
  /** Snooze length (minutes). */
  snoozeMin: number;
  /** Save a detected session into the sleep log without asking. */
  autoSave: boolean;
}

export interface SleepMotionStatus {
  /** The tracker service is running. */
  running: boolean;
  /** When tracking started (epoch ms), 0 when never. */
  startedAt: number;
  /** Last sensor sample (epoch ms). */
  lastSampleAt: number;
  /** Last detected movement (epoch ms). */
  lastMovementAt: number;
  /** Start of the current stillness streak (epoch ms), 0 when moving. */
  stillSince: number;
  /** The alarm is ringing right now. */
  alarmActive: boolean;
  /** The settings the native side is using. */
  config: SleepMotionConfig;
}

/** One minute of motion: epoch minute + peak movement (m/s^2). */
export interface MotionBucket {
  m: number;
  v: number;
  /**
   * Seconds of *sustained* movement inside that minute. The native tracker
   * counts them (5 s per sample above the threshold) — this is what makes
   * the tracker usable with the phone under a pillow. `undefined` = an old
   * bucket recorded before the counter existed.
   */
  s?: number;
}

export const DEFAULT_SLEEP_MOTION_CONFIG: SleepMotionConfig = {
  enabled: false,
  sensitivity: 'medium',
  sleepStartMin: 21 * 60 + 30, // 21:30
  sleepEndMin: 9 * 60 + 30, // 09:30 (next day)
  alarmEnabled: false,
  alarmMode: 'smart',
  wakeStartMin: 6 * 60 + 30, // 06:30
  wakeEndMin: 7 * 60, // 07:00
  alarmDurationMin: 2,
  snoozeMin: 9,
  autoSave: true,
};

const SleepMotionModule = NativeModules.SleepMotion as
  | {
      isAvailable: () => Promise<boolean>;
      start: (config: SleepMotionConfig) => Promise<boolean>;
      stop: () => Promise<boolean>;
      setConfig: (config: SleepMotionConfig) => Promise<boolean>;
      getStatus: () => Promise<SleepMotionStatus>;
      getBuckets: () => Promise<MotionBucket[]>;
      clearBuckets: () => Promise<boolean>;
      stopAlarm: () => Promise<boolean>;
    }
  | undefined;

/** True when the native tracker exists (Android with the native module). */
export function isSleepMotionAvailable(): boolean {
  return Platform.OS === 'android' && !!SleepMotionModule;
}

/** Fill in any missing fields so the native side never gets undefined. */
export function withDefaults(config?: Partial<SleepMotionConfig> | null): SleepMotionConfig {
  return { ...DEFAULT_SLEEP_MOTION_CONFIG, ...(config || {}) };
}

/** Start (or re-arm) the tracker. */
export async function startMotionTracking(
  config?: Partial<SleepMotionConfig> | null
): Promise<boolean> {
  if (!SleepMotionModule) return false;
  try {
    await SleepMotionModule.start(withDefaults(config));
    return true;
  } catch {
    return false;
  }
}

/** Stop the tracker (settings are kept). */
export async function stopMotionTracking(): Promise<boolean> {
  if (!SleepMotionModule) return false;
  try {
    await SleepMotionModule.stop();
    return true;
  } catch {
    return false;
  }
}

/** Push new settings to the native tracker. */
export async function setMotionConfig(
  config?: Partial<SleepMotionConfig> | null
): Promise<boolean> {
  if (!SleepMotionModule) return false;
  try {
    await SleepMotionModule.setConfig(withDefaults(config));
    return true;
  } catch {
    return false;
  }
}

/** Current tracker status (null when unavailable). */
export async function getMotionStatus(): Promise<SleepMotionStatus | null> {
  if (!SleepMotionModule) return null;
  try {
    const raw = await SleepMotionModule.getStatus();
    if (!raw) return null;
    return {
      running: !!raw.running,
      startedAt: Number(raw.startedAt) || 0,
      lastSampleAt: Number(raw.lastSampleAt) || 0,
      lastMovementAt: Number(raw.lastMovementAt) || 0,
      stillSince: Number(raw.stillSince) || 0,
      alarmActive: !!raw.alarmActive,
      config: withDefaults(raw.config),
    };
  } catch {
    return null;
  }
}

/** The recorded motion timeline (one bucket per minute). */
export async function getMotionBuckets(): Promise<MotionBucket[]> {
  if (!SleepMotionModule) return [];
  try {
    const raw = await SleepMotionModule.getBuckets();
    if (!Array.isArray(raw)) return [];
    return raw
      .map((b) => ({
        m: Number(b?.m) || 0,
        v: Number(b?.v) || 0,
        s: typeof b?.s === 'number' && Number.isFinite(b.s) ? b.s : undefined,
      }))
      .filter((b) => b.m > 0);
  } catch {
    return [];
  }
}

/** Wipe the recorded timeline. */
export async function clearMotionBuckets(): Promise<boolean> {
  if (!SleepMotionModule) return false;
  try {
    await SleepMotionModule.clearBuckets();
    return true;
  } catch {
    return false;
  }
}

/** Silence a ringing alarm. */
export async function stopMotionAlarm(): Promise<boolean> {
  if (!SleepMotionModule) return false;
  try {
    await SleepMotionModule.stopAlarm();
    return true;
  } catch {
    return false;
  }
}
