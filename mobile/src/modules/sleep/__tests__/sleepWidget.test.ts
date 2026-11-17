/**
 * Clock + Sleep + Sleep-only home-screen widgets — the payload pushed to the
 * native widgets.
 */
import {
  computeSleepWidgetPayload,
  lastNightBuckets,
  latestSleepEntry,
} from '../../../services/sleepWidget';
import type { MotionBucket } from '../sleepMotion';

const START = 21 * 60 + 30; // 21:30
const END = 9 * 60 + 30; // 09:30

/** Epoch minute for a local wall-clock time. */
function minute(y: number, m: number, d: number, h: number, min: number): number {
  return Math.floor(new Date(y, m - 1, d, h, min).getTime() / 60000);
}

describe('lastNightBuckets', () => {
  it('keeps the sleep night and drops post-wake daytime motion', () => {
    const evening = minute(2026, 11, 16, 22, 0);
    const afterMidnight = minute(2026, 11, 17, 2, 0);
    const noon = minute(2026, 11, 17, 14, 0);
    const b = (m: number): MotionBucket => ({ m, v: 0.1, s: 0 });
    const all = [b(noon), b(afterMidnight), b(evening)];

    // With the window, only the real night survives — a stray noon bucket must
    // never become the "last night" and blank the widget's DEEP / LIGHT bars.
    const night = lastNightBuckets(all, START, END);
    expect(night.map((x) => x.m)).toEqual([evening, afterMidnight]);
  });

  it('still splits by a plain gap when no window is given', () => {
    const b = (m: number): MotionBucket => ({ m, v: 0.1, s: 0 });
    const all = [b(1000), b(1010), b(2000)];
    expect(lastNightBuckets(all).map((x) => x.m)).toEqual([2000]);
  });
});
import type { SleepEntry } from '../store';

function entry(start: string, end: string, id = 'e1'): SleepEntry {
  return {
    id,
    startTime: start,
    endTime: end,
    quality: null,
    mood: null,
    interruptions: 0,
    notes: '',
    source: 'manual',
  };
}

describe('latestSleepEntry', () => {
  it('picks the most recent night', () => {
    const now = new Date('2026-11-11T12:00:00.000Z');
    const entries = [
      entry('2026-11-08T14:00:00.000Z', '2026-11-09T06:00:00.000Z', 'old'),
      entry('2026-11-09T14:00:00.000Z', '2026-11-10T06:00:00.000Z', 'new'),
    ];
    expect(latestSleepEntry(entries, now)?.id).toBe('new');
  });

  it('returns null without entries', () => {
    expect(latestSleepEntry([], new Date())).toBeNull();
    expect(latestSleepEntry(undefined, new Date())).toBeNull();
  });
});

describe('computeSleepWidgetPayload', () => {
  it('is empty without sleep data', () => {
    const payload = computeSleepWidgetPayload([], new Date('2026-11-11T12:00:00.000Z'));
    expect(payload.hasSleep).toBe(false);
    expect(payload.durationMin).toBe(0);
    expect(payload.interruptions).toBe(0);
    expect(payload.quality).toBe(0);
  });

  it('passes the realtime-weather extras through to the widget', () => {
    const payload = computeSleepWidgetPayload([], new Date('2026-11-11T12:00:00.000Z'), {
      tempC: 31,
      weatherLat: 12.97,
      weatherLon: 77.59,
      weatherFetchedAt: 1730000000000,
    });
    expect(payload.tempC).toBe(31);
    expect(payload.weatherLat).toBe(12.97);
    expect(payload.weatherLon).toBe(77.59);
    expect(payload.weatherFetchedAt).toBe(1730000000000);
  });

  it('builds the duration and the two REM windows', () => {
    const now = new Date('2026-11-11T12:00:00.000Z');
    const entries = [entry('2026-11-10T16:00:00.000Z', '2026-11-11T00:20:00.000Z')];
    const payload = computeSleepWidgetPayload(entries, now);

    expect(payload.hasSleep).toBe(true);
    expect(payload.durationMin).toBe(8 * 60 + 20);
    expect(payload.bedTime).toBe(new Date(entries[0].startTime).getTime());
    expect(payload.wakeTime).toBe(new Date(entries[0].endTime).getTime());

    // Both REM windows sit inside the night, in order.
    expect(payload.rem1Start).toBeGreaterThanOrEqual(payload.bedTime);
    expect(payload.rem1End).toBeLessThanOrEqual(payload.wakeTime);
    expect(payload.rem2Start).toBeGreaterThan(payload.rem1End);
    expect(payload.rem2End).toBeLessThanOrEqual(payload.wakeTime);
    expect(payload.rem2Start).toBeGreaterThanOrEqual(payload.bedTime);
  });

  it('carries the wake-ups and the rating of the night', () => {
    const now = new Date('2026-11-11T12:00:00.000Z');
    const night = {
      ...entry('2026-11-10T16:00:00.000Z', '2026-11-11T00:20:00.000Z'),
      interruptions: 2,
      quality: 4,
    };
    const payload = computeSleepWidgetPayload([night], now);
    expect(payload.interruptions).toBe(2);
    expect(payload.quality).toBe(4);
  });

  it('never reports a rating outside 1–5', () => {
    const now = new Date('2026-11-11T12:00:00.000Z');
    const night = {
      ...entry('2026-11-10T16:00:00.000Z', '2026-11-11T00:20:00.000Z'),
      quality: 9,
    };
    const payload = computeSleepWidgetPayload([night], now);
    expect(payload.quality).toBe(5);
  });
});
