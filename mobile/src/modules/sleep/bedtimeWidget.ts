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
