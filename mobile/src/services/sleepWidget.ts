/**
 * sleepWidget — pushes the last night of sleep to the Android home-screen
 * widgets (native ClockSleepWidget 2x2 and SleepStatsWidget 2x2).
 *
 * The clock part of the Clock & Sleep widget ticks on its own (TextClock keeps
 * itself up to date); the sleep part is data — the duration, the sleep score,
 * the DEEP / LIGHT / AWAKE stage chart (derived from the motion timeline) and
 * the bed / wake times.
 *
 * Degrades gracefully (no-ops) on iOS / Expo Go where the module is absent.
 */
import { NativeModules, Platform } from 'react-native';
import { useSleepStore, type SleepEntry } from '../modules/sleep/store';
import {
  getMotionBuckets,
  type MotionBucket,
  type SleepSensitivity,
} from '../modules/sleep/sleepMotion';
import {
  stageOptionsFor,
  stageSegments,
  type StageSegment,
} from '../modules/sleep/sleepStages';
import { sleepScore } from '../modules/sleep/sleepScore';

const SleepWidgetModule = NativeModules.ClockSleepWidgetBridge as
  | { setSleep: (json: string) => Promise<void> }
  | undefined;

const SleepStatsWidgetModule = NativeModules.SleepStatsWidgetBridge as
  | { setSleep: (json: string) => Promise<void> }
  | undefined;

/** The bars of the DEEP / LIGHT / AWAKE lanes: [start, length] of the night. */
export interface SleepStageSegments {
  deep: number[][];
  light: number[][];
  awake: number[][];
}

export interface SleepWidgetPayload {
  /** There is a sleep session to show. */
  hasSleep: boolean;
  /** Sleep length in minutes. */
  durationMin: number;
  /** The sleep score (0–100). */
  score: number;
  /** Bedtime (epoch ms). */
  bedTime: number;
  /** Wake time (epoch ms). */
  wakeTime: number;
  /** The bed time, as "11:40p". */
  bedLabel: string;
  /** The wake time, as "5:30a". */
  wakeLabel: string;
  /** Night wake-ups. */
  interruptions: number;
  /** The stage bars of the chart. */
  stages: SleepStageSegments;
  /** The temperature in °C (0 when unknown). */
  tempC: number;
  /** The GPS coordinates the temperature was read for (rounded ~1 km). */
  weatherLat?: number;
  /** The GPS longitude (rounded ~1 km). */
  weatherLon?: number;
  /** When the cached reading was fetched (epoch ms) — the widget prefers the fresher of its two weather sources. */
  weatherFetchedAt?: number;
  /** The next alarm time, as "6:30 am" (empty when no alarm is set). */
  alarmLabel: string;
  /** The first REM window (epoch ms) — the sleep-only widget draws it. */
  rem1Start: number;
  /** The first REM window's end (epoch ms). */
  rem1End: number;
  /** The last REM window (epoch ms). */
  rem2Start: number;
  /** The last REM window's end (epoch ms). */
  rem2End: number;
  /** Sleep rating (1–5), 0 when it was not rated yet. */
  quality: number;
}

/**
 * REM windows are approximated from the sleep cycle: the first one starts a
 * quarter into the night, the last one ends a quarter before the morning.
 */
const REM_OFFSET_RATIO = 0.22;
const REM_LENGTH_MIN = 25;
/**
 * Shown until the first realtime reading lands. The weather is realtime in
 * normal use — the cached Open-Meteo reading (fresh from GPS) is pushed on
 * every app open, and the widget re-reads Open-Meteo itself every ~10 minutes
 * while the app is closed — see ClockSleepWidget / SleepWidgetAlarmReceiver.
 */
const DEFAULT_TEMP_C = 24;

/** "11:40 PM" — the bed / wake time, the way the widget shows it. */
/** "11:40p" / "5:30a" — the compact style used inside the red block. */
export function formatShortClockLabel(epochMs: number): string {
  const d = new Date(epochMs);
  const h = d.getHours();
  const suffix = h >= 12 ? 'p' : 'a';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${h12}:${mm}${suffix}`;
}

export function formatClockLabel(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return '';
  const d = new Date(epochMs);
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "6:30 AM" — the wake window start, the way the widget shows it. */
export function formatAlarmLabel(minutesFromMidnight: number): string {
  if (!Number.isFinite(minutesFromMidnight)) return '';
  const h24 = Math.floor(minutesFromMidnight / 60) % 24;
  const m = Math.round(minutesFromMidnight % 60);
  const suffix = h24 >= 12 ? 'pm' : 'am';
  let h = h24 % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

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

/** A gap of more than this many minutes between two buckets ends a night. */
const NIGHT_GAP_MIN = 120;

/**
 * The buckets of the LAST night — the tracker keeps 36 h of history, so the
 * night before it has to be cut off.
 */
export function lastNightBuckets(buckets: MotionBucket[]): MotionBucket[] {
  if (!buckets || buckets.length === 0) return [];
  const sorted = [...buckets].sort((a, b) => a.m - b.m);
  let start = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].m - sorted[i - 1].m > NIGHT_GAP_MIN) start = i;
  }
  return sorted.slice(start);
}

/** The stage bars of the last night, split by lane. */
export function computeStageSegments(
  buckets: MotionBucket[],
  sensitivity: SleepSensitivity
): SleepStageSegments {
  const empty: SleepStageSegments = { deep: [], light: [], awake: [] };
  const night = lastNightBuckets(buckets);
  if (night.length < 2) return empty;
  const bed = night[0].m;
  const wake = night[night.length - 1].m + 1;
  const segments: StageSegment[] = stageSegments(
    night,
    bed,
    wake,
    stageOptionsFor(sensitivity)
  );
  const out: SleepStageSegments = { deep: [], light: [], awake: [] };
  for (const s of segments) out[s.stage].push([s.start, s.len]);
  return out;
}

/** The minutes of deep sleep in the last night. */
export function deepMinutes(
  buckets: MotionBucket[],
  sensitivity: SleepSensitivity = 'medium'
): number {
  const night = lastNightBuckets(buckets);
  if (night.length < 2) return 0;
  const bed = night[0].m;
  const wake = night[night.length - 1].m + 1;
  const segments = stageSegments(night, bed, wake, stageOptionsFor(sensitivity));
  return segments
    .filter((s) => s.stage === 'deep')
    .reduce((sum, s) => sum + s.len * (wake - bed), 0);
}

/**
 * Build the widget payload from the sleep log.
 *
 * The stages come from the motion timeline (the tracker), the score from the
 * night itself and the temperature from the latest Open-Meteo reading
 * (GPS-based, refreshed on every app open — and by the widget itself every
 * ~10 minutes while the app is closed).
 */
export function computeSleepWidgetPayload(
  entries: SleepEntry[] | undefined,
  now: Date = new Date(),
  extra?: {
    buckets?: MotionBucket[];
    sensitivity?: SleepSensitivity;
    tempC?: number;
    weatherLat?: number;
    weatherLon?: number;
    weatherFetchedAt?: number;
    /** The smart alarm: the wake window start, or null when there is no alarm. */
    alarmMin?: number | null;
  }
): SleepWidgetPayload {
  const buckets = extra?.buckets ?? [];
  const sensitivity = extra?.sensitivity ?? 'medium';
  const entry = latestSleepEntry(entries, now);
  if (!entry) {
    return {
      hasSleep: false,
      durationMin: 0,
      score: 0,
      bedTime: 0,
      wakeTime: 0,
      bedLabel: '',
      wakeLabel: '',
      interruptions: 0,
      stages: { deep: [], light: [], awake: [] },
      tempC: extra?.tempC ?? DEFAULT_TEMP_C,
      weatherLat: extra?.weatherLat,
      weatherLon: extra?.weatherLon,
      weatherFetchedAt: extra?.weatherFetchedAt,
      alarmLabel:
        extra?.alarmMin === null || extra?.alarmMin === undefined
          ? ''
          : formatAlarmLabel(extra.alarmMin),
      rem1Start: 0,
      rem1End: 0,
      rem2Start: 0,
      rem2End: 0,
      quality: 0,
    };
  }

  const bedTime = new Date(entry.startTime).getTime();
  const wakeTime = new Date(entry.endTime).getTime();
  const durationMin = Math.max(0, Math.round((wakeTime - bedTime) / 60000));
  const interruptions = Math.max(0, Number(entry.interruptions) || 0);
  const offsetMs = Math.round(durationMin * REM_OFFSET_RATIO) * 60000;
  const lengthMs = REM_LENGTH_MIN * 60000;

  return {
    hasSleep: true,
    durationMin,
    score: sleepScore({
      durationMin,
      deepMin: deepMinutes(buckets, sensitivity),
      interruptions,
    }),
    bedTime,
    wakeTime,
    bedLabel: formatShortClockLabel(bedTime),
    wakeLabel: formatShortClockLabel(wakeTime),
    interruptions,
    stages: computeStageSegments(buckets, sensitivity),
    tempC: extra?.tempC ?? DEFAULT_TEMP_C,
    weatherLat: extra?.weatherLat,
    weatherLon: extra?.weatherLon,
    weatherFetchedAt: extra?.weatherFetchedAt,
    alarmLabel:
      extra?.alarmMin === null || extra?.alarmMin === undefined
        ? ''
        : formatAlarmLabel(extra.alarmMin),
    rem1Start: bedTime + offsetMs,
    rem1End: bedTime + offsetMs + lengthMs,
    rem2Start: Math.max(bedTime, wakeTime - offsetMs - lengthMs),
    rem2End: Math.max(bedTime, wakeTime - offsetMs),
    quality: Math.max(0, Math.min(5, Number(entry.quality) || 0)),
  };
}

export function isSleepWidgetAvailable(): boolean {
  return Platform.OS === 'android' && !!SleepWidgetModule;
}

/** True when the sleep-only 2x2 widget is available. */
export function isSleepStatsWidgetAvailable(): boolean {
  return Platform.OS === 'android' && !!SleepStatsWidgetModule;
}

/** The cached reading (fresh from GPS on every app open / foreground). */
async function cachedWeather(): Promise<{
  tempC: number;
  /** GPS latitude (rounded ~1 km) — present when a reading was fetched. */
  lat?: number;
  /** GPS longitude (rounded ~1 km). */
  lon?: number;
  /** When the reading was fetched (epoch ms). */
  fetchedAt?: number;
}> {
  try {
    const { getCachedWeather } = require('./weather');
    const reading = await getCachedWeather();
    if (!reading) return { tempC: DEFAULT_TEMP_C };
    return {
      tempC: Math.round(reading.tempC),
      lat: reading.lat,
      lon: reading.lon,
      fetchedAt: reading.fetchedAt,
    };
  } catch {
    return { tempC: DEFAULT_TEMP_C };
  }
}

/**
 * Push the current sleep data to the widgets. Never throws.
 */
export async function pushSleepWidget(payload?: SleepWidgetPayload): Promise<void> {
  let data = payload;
  if (!data) {
    const sleep = useSleepStore.getState();
    const buckets = await getMotionBuckets().catch(() => [] as MotionBucket[]);
    const weather = await cachedWeather();
    data = computeSleepWidgetPayload(sleep.entries, new Date(), {
      buckets,
      sensitivity: sleep.autoConfig.sensitivity,
      tempC: weather.tempC,
      weatherLat: weather.lat,
      weatherLon: weather.lon,
      weatherFetchedAt: weather.fetchedAt,
      alarmMin: sleep.autoConfig.alarmEnabled ? sleep.autoConfig.wakeStartMin : null,
    });
  }
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
  // The same payload goes to KWGT, so a KWGT preset can show the same night.
  try {
    const { sendSleepDataToKwgt } = require('./kwgtBridge');
    await sendSleepDataToKwgt(data);
  } catch {
    /* KWGT is optional */
  }
}
