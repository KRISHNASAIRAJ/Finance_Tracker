/**
 * sleepDetect — JS bridge to the native SleepDetect module (UsageStatsManager).
 * Android only; degrades gracefully (returns null) on iOS / Expo Go / no permission.
 *
 * The module is passive: it queries usage events on demand (when the user
 * opens the Sleep dashboard). No background service, no battery cost.
 */
import { NativeModules, Platform } from 'react-native';

export interface DetectedSleep {
  /** epoch ms */
  bedTime: number;
  /** epoch ms */
  wakeTime: number;
  interruptions: number;
}

const SleepDetect = NativeModules.SleepDetect as
  | {
      hasPermission: () => Promise<boolean>;
      detectLastSleep: (minGapMs: number) => Promise<DetectedSleep>;
      openSettings: () => Promise<boolean>;
    }
  | undefined;

export function isSleepDetectAvailable(): boolean {
  return Platform.OS === 'android' && !!SleepDetect;
}

export async function hasUsageAccess(): Promise<boolean> {
  if (!isSleepDetectAvailable()) return false;
  try {
    return await SleepDetect!.hasPermission();
  } catch {
    return false;
  }
}

/** Open the Android "Usage access" special-settings screen. Never throws. */
export function openUsageAccessSettings(): void {
  try {
    SleepDetect?.openSettings?.().catch(() => {});
  } catch {
    /* best-effort */
  }
}

/**
 * Detect last night's sleep window. Returns null when unavailable
 * (non-Android, no permission, or no qualifying gap — never throws).
 */
export async function detectLastSleep(minGapHours = 3): Promise<DetectedSleep | null> {
  if (!isSleepDetectAvailable()) return null;
  try {
    const granted = await SleepDetect!.hasPermission();
    if (!granted) return null;
    return await SleepDetect!.detectLastSleep(minGapHours * 3600000);
  } catch {
    return null;
  }
}
