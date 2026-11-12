/**
 * sleepMotion — the night window helpers.
 */
import {
  DEFAULT_SLEEP_MOTION_CONFIG,
  isInNightWindow,
  isTrackingTime,
  minutesOfDay,
  nextWindowStart,
} from '../sleepMotion';

const NIGHT = { sleepStartMin: 21 * 60 + 30, sleepEndMin: 9 * 60 + 30 };

describe('minutesOfDay', () => {
  it('returns the local minute of the day', () => {
    expect(minutesOfDay(new Date(2026, 10, 12, 21, 30))).toBe(21 * 60 + 30);
    expect(minutesOfDay(new Date(2026, 10, 12, 0, 5))).toBe(5);
  });
});

describe('isInNightWindow', () => {
  it('covers the evening and the early morning', () => {
    expect(isInNightWindow(NIGHT, 21 * 60 + 29)).toBe(false);
    expect(isInNightWindow(NIGHT, 21 * 60 + 30)).toBe(true);
    expect(isInNightWindow(NIGHT, 23 * 60)).toBe(true);
    expect(isInNightWindow(NIGHT, 0)).toBe(true);
    expect(isInNightWindow(NIGHT, 9 * 60 + 30)).toBe(true);
    expect(isInNightWindow(NIGHT, 9 * 60 + 31)).toBe(false);
    expect(isInNightWindow(NIGHT, 12 * 60)).toBe(false);
    expect(isInNightWindow(NIGHT, 18 * 60)).toBe(false);
  });

  it('treats a window that does not wrap midnight as a plain range', () => {
    const day = { sleepStartMin: 8 * 60, sleepEndMin: 17 * 60 };
    expect(isInNightWindow(day, 7 * 60)).toBe(false);
    expect(isInNightWindow(day, 8 * 60)).toBe(true);
    expect(isInNightWindow(day, 17 * 60)).toBe(true);
    expect(isInNightWindow(day, 20 * 60)).toBe(false);
  });

  it('treats a zero-length window as "always"', () => {
    const always = { sleepStartMin: 0, sleepEndMin: 0 };
    expect(isInNightWindow(always, 0)).toBe(true);
    expect(isInNightWindow(always, 13 * 60)).toBe(true);
  });
});

describe('isTrackingTime', () => {
  it('is false during the day and true at night', () => {
    expect(isTrackingTime(NIGHT, new Date(2026, 10, 12, 14, 0))).toBe(false);
    expect(isTrackingTime(NIGHT, new Date(2026, 10, 12, 22, 0))).toBe(true);
    expect(isTrackingTime(NIGHT, new Date(2026, 10, 12, 3, 0))).toBe(true);
  });

  it('uses the default window (21:30 → 09:30)', () => {
    expect(DEFAULT_SLEEP_MOTION_CONFIG.sleepStartMin).toBe(21 * 60 + 30);
    expect(DEFAULT_SLEEP_MOTION_CONFIG.sleepEndMin).toBe(9 * 60 + 30);
  });
});

describe('nextWindowStart', () => {
  it('is tonight when it is still to come', () => {
    const now = new Date(2026, 10, 12, 14, 0);
    const next = nextWindowStart(NIGHT, now);
    expect(next.getDate()).toBe(12);
    expect(next.getHours()).toBe(21);
    expect(next.getMinutes()).toBe(30);
  });

  it('is tomorrow night when tonight has started', () => {
    const now = new Date(2026, 10, 12, 22, 0);
    const next = nextWindowStart(NIGHT, now);
    expect(next.getDate()).toBe(13);
    expect(next.getHours()).toBe(21);
  });
});
