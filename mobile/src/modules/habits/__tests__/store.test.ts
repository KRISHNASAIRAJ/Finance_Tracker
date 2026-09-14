/**
 * Unit tests for the habit store — toggle semantics, per-day rows,
 * and habitsForDay lookup.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import { useHabitStore, habitsForDay } from '../store';
import { HABIT_KEYS, todayKey } from '../habits';

describe('Habit Store', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function freshStore() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../store');
    return mod.useHabitStore as typeof import('../store').useHabitStore;
  }

  it('toggleHabit adds the habit then removes it on second toggle', () => {
    const store = freshStore();
    const day = todayKey();
    const r1 = store.getState().toggleHabit(day, 'water_3l');
    expect(r1).toBe(true); // now ticked
    expect(habitsForDay(store.getState().days, day)).toContain('water_3l');

    const r2 = store.getState().toggleHabit(day, 'water_3l');
    expect(r2).toBe(false); // now unticked
    expect(habitsForDay(store.getState().days, day)).not.toContain('water_3l');
  });

  it('keeps multiple habits on the same day and reuses the row', () => {
    const store = freshStore();
    const day = todayKey();
    store.getState().toggleHabit(day, 'water_3l');
    store.getState().toggleHabit(day, 'cook_meals');
    store.getState().toggleHabit(day, 'no_junk');

    const days = store.getState().days.filter((d) => d.day === day);
    expect(days).toHaveLength(1); // single row per day
    const ticked = habitsForDay(store.getState().days, day);
    expect(ticked.sort()).toEqual(['cook_meals', 'no_junk', 'water_3l'].sort());
  });

  it('separates days correctly', () => {
    const store = freshStore();
    store.getState().toggleHabit('2026-01-01', 'water_3l');
    store.getState().toggleHabit('2026-01-02', 'cook_meals');
    expect(habitsForDay(store.getState().days, '2026-01-01')).toEqual(['water_3l']);
    expect(habitsForDay(store.getState().days, '2026-01-02')).toEqual(['cook_meals']);
  });

  it('generates deterministic row ids for the same day', () => {
    const store = freshStore();
    const day = '2026-01-01';
    store.getState().toggleHabit(day, 'water_3l');
    const id1 = store.getState().days.find((d) => d.day === day)?.id;
    expect(id1).toBe('hb_20260101');
  });

  it('setNotes only updates an existing day row', () => {
    const store = freshStore();
    const day = todayKey();
    store.getState().toggleHabit(day, 'water_3l');
    store.getState().setNotes(day, 'felt great');
    expect(store.getState().days.find((d) => d.day === day)?.notes).toBe('felt great');
    // absent day — no crash, no row created
    store.getState().setNotes('2030-01-01', 'nope');
    expect(store.getState().days.find((d) => d.day === '2030-01-01')).toBeUndefined();
  });

  it('full day of all 10 habits reaches 100%', () => {
    const store = freshStore();
    const day = todayKey();
    for (const k of HABIT_KEYS) store.getState().toggleHabit(day, k);
    const ticked = habitsForDay(store.getState().days, day);
    expect(ticked).toHaveLength(10);
  });
});
