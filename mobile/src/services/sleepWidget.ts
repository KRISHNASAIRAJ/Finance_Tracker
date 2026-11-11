/**
 * sleepWidget — pushes the last night of sleep to the Android home-screen
 * widgets (native ClockSleepWidget 2x2 and SleepStatsWidget 2x2).
 *
 * The clock part of the Clock & Sleep widget ticks on its own (TextClock keeps
 * itself up to date); only the sleep part is data — the duration, the two REM
 * windows on the timeline and the weather line (a placeholder until an API is
 * wired up).
 *
 * Degrades gracefully (no-ops) on iOS / Expo Go where the module is absent.
 */
import { NativeModules, Platform } from 'react-native';
import { useSleepStore, type SleepEntry } from '../modules/sleep/store';

const SleepWidgetModule = NativeModules.ClockSleepWidgetBridge as
  | { setSleep: (json: string) => Promise<void> }
  | undefined;

const SleepStatsWidgetModule = NativeModules.SleepStatsWidgetBridge as
  | { setSleep: (json: string) => Promise<void> }
  | undefined;

export interface SleepWidgetPayload {
  /** There is a sleep session to show. */
  hasSleep: boolean;
  /** Sleep length in minutes. */
  durationMin: number;
  /** Bedtime (epoch ms). */
  bedTime: number;
  /** Wake time (epoch ms). */
  wakeTime: number;
  /** First REM window (epoch ms). */
  rem1Start: number;
  rem1End: number;
  /** Last REM window (epoch ms). */
  rem2Start: number;
  rem2End: number;
  /** Night wake-ups. */
  interruptions: number;
  /** Sleep rating (1–5), 0 when it was not rated yet. */
  quality: number;
  /** Weather label, e.g. "19 °C" — a placeholder until an API is connected. */
  weatherText: string;
}

/** Placeholder weather — replaced by a real API later. */
export const DEFAULT_WEATHER_TEXT = '19 °C';

/**
 * REM windows are approximated from the sleep cycle: the first one starts a
 * quarter into the night, the last one ends a quarter before the morning.
 */
const REM_OFFSET_RATIO = 0.22;
const REM_LENGTH_MIN = 25;

/** The most recent sleep entry (by wake time). */
export function latestSleepEntry(
  entries: SleepEntry[] | undefined,
  now: Date = new Date()
): SleepEntry | null {
  if (!entries || entries.length === 0) return null;
  const sorted = [...entries].sort(
    (a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
  );
  const latest = sorted[0];
  if (!latest) return null;
  const end = new Date(latest.endTime).getTime();
  if (!Number.isFinite(end) || end > now.getTime() + 6 * 3600000) return null;
  return latest;
}

/**
 * Build the widget payload from the sleep log. The REM windows are derived
 * from the sleep cycle, not from measured sleep stages.
 */
export function computeSleepWidgetPayload(
  entries: SleepEntry[] | undefined,
  now: Date = new Date()
): SleepWidgetPayload {
  const entry = latestSleepEntry(entries, now);
  if (!entry) {
    return {
      hasSleep: false,
      durationMin: 0,
      bedTime: 0,
      wakeTime: 0,
      rem1Start: 0,
      rem1End: 0,
      rem2Start: 0,
      rem2End: 0,
      interruptions: 0,
      quality: 0,
      weatherText: DEFAULT_WEATHER_TEXT,
    };
  }

  const bedTime = new Date(entry.startTime).getTime();
  const wakeTime = new Date(entry.endTime).getTime();
  const durationMin = Math.max(0, Math.round((wakeTime - bedTime) / 60000));
  const offsetMs = Math.round(durationMin * REM_OFFSET_RATIO) * 60000;
  const lengthMs = REM_LENGTH_MIN * 60000;

  return {
    hasSleep: true,
    durationMin,
    bedTime,
    wakeTime,
    rem1Start: bedTime + offsetMs,
    rem1End: bedTime + offsetMs + lengthMs,
    rem2Start: Math.max(bedTime, wakeTime - offsetMs - lengthMs),
    rem2End: Math.max(bedTime, wakeTime - offsetMs),
    interruptions: Math.max(0, Number(entry.interruptions) || 0),
    quality: Math.max(0, Math.min(5, Number(entry.quality) || 0)),
    weatherText: DEFAULT_WEATHER_TEXT,
  };
}

export function isSleepWidgetAvailable(): boolean {
  return Platform.OS === 'android' && !!SleepWidgetModule;
}

/** True when the sleep-only 2x2 widget is available. */
export function isSleepStatsWidgetAvailable(): boolean {
  return Platform.OS === 'android' && !!SleepStatsWidgetModule;
}

/** Push the current sleep data to the widgets. Never throws. */
export async function pushSleepWidget(payload?: SleepWidgetPayload): Promise<void> {
  const data =
    payload ?? computeSleepWidgetPayload(useSleepStore.getState().entries);
  const json = JSON.stringify(data);
  if (SleepWidgetModule) {
    try {
      await SleepWidgetModule.setSleep(json);
    } catch {
      /* best-effort */
    }
  }
  if (SleepStatsWidgetModule) {
    try {
      await SleepStatsWidgetModule.setSleep(json);
    } catch {
      /* best-effort */
    }
  }
}
