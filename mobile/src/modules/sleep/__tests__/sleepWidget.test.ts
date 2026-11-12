/**
 * Clock + Sleep + Sleep-only home-screen widgets — the payload pushed to the
 * native widgets.
 */
import {
  computeSleepWidgetPayload,
  latestSleepEntry,
  DEFAULT_WEATHER_TEXT,
} from '../../../services/sleepWidget';
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
  it('falls back to the placeholder weather without sleep data', () => {
    const payload = computeSleepWidgetPayload([], new Date('2026-11-11T12:00:00.000Z'));
    expect(payload.hasSleep).toBe(false);
    expect(payload.durationMin).toBe(0);
    expect(payload.weatherText).toBe(DEFAULT_WEATHER_TEXT);
  });

  it('carries the live weather into the payload', () => {
    const now = new Date('2026-11-11T12:00:00.000Z');
    const entries = [entry('2026-11-10T16:00:00.000Z', '2026-11-11T00:20:00.000Z')];
    const payload = computeSleepWidgetPayload(entries, now, {
      tempC: 28.4,
      feelsLikeC: 30,
      humidity: 60,
      condition: 'Partly cloudy',
      icon: 'cloud',
      isDay: true,
      minC: 21,
      maxC: 31,
      precipChance: 20,
      lat: 12.97,
      lon: 77.59,
      placeName: 'Bengaluru',
      fetchedAt: now.getTime(),
    });
    expect(payload.weatherText).toBe('28°');
    expect(payload.weatherIcon).toBe('cloud');
    expect(payload.weatherCondition).toBe('Partly cloudy');
    expect(payload.weatherMaxC).toBe(31);
    expect(payload.weatherPlace).toBe('Bengaluru');
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
