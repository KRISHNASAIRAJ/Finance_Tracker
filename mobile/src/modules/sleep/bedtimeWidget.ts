/**
 * bedtimeWidget — JS bridge to the native BedtimeWidget state (Android only).
 * Reads/writes the pending bedtime timestamp in SharedPreferences so the
 * home-screen widget and the in-app Sleep dashboard stay in sync.
 *
 * Degrades gracefully (no-ops) on iOS / Expo Go where the module is absent.
 */
import { NativeModules, Platform } from 'react-native';

const BedtimeWidgetModule = NativeModules.BedtimeWidgetBridge as
  | {
      getPendingStart: () => Promise<number | null>;
      getEndedSession: () => Promise<{ start: number; end: number } | null>;
      setPendingStart: (startMs: number | null) => Promise<void>;
    }
  | undefined;

export function isBedtimeWidgetAvailable(): boolean {
  return Platform.OS === 'android' && !!BedtimeWidgetModule;
}

/** Pending bedtime start (epoch ms), or null when no session is active. */
export async function widgetBedtimeStart(): Promise<number | null> {
  if (!isBedtimeWidgetAvailable()) return null;
  try {
    const v = await BedtimeWidgetModule!.getPendingStart();
    return typeof v === 'number' && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * An ended-but-unlogged widget session (epoch ms), or null. Fallback so a
 * "good morning" widget tap is never lost when the deep link doesn't land.
 */
export async function widgetEndedSession(): Promise<{ start: number; end: number } | null> {
  if (!isBedtimeWidgetAvailable()) return null;
  try {
    const v = await BedtimeWidgetModule!.getEndedSession();
    if (
      v &&
      typeof v.start === 'number' &&
      typeof v.end === 'number' &&
      v.start > 0 &&
      v.end > v.start
    ) {
      return { start: v.start, end: v.end };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set/clear the pending bedtime from JS (keeps the widget in sync when the
 * user taps "Going to bed" inside the app). Never throws.
 */
export async function setWidgetBedtimeStart(startMs: number | null): Promise<void> {
  if (!isBedtimeWidgetAvailable()) return;
  try {
    await BedtimeWidgetModule!.setPendingStart(startMs);
  } catch {
    /* best-effort */
  }
}
