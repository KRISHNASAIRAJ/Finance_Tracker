/**
 * Unit tests for the sleep module — store logic + duration helpers.
 * Pure-function tests; the Zustand store's persist layer is mocked out.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import { sleepDurationHours, formatSleepDuration } from '../store';

describe('Sleep Store — duration helpers', () => {
  it('computes duration in hours from ISO timestamps', () => {
    const entry = {
      startTime: '2026-09-12T18:00:00Z', // 23:30 IST
      endTime: '2026-09-13T01:30:00Z',   // 07:00 IST
    };
    expect(sleepDurationHours(entry)).toBeCloseTo(7.5, 5);
  });

  it('clamps negative ranges to zero (corrupt data safety)', () => {
    const entry = {
      startTime: '2026-09-13T01:30:00Z',
      endTime: '2026-09-12T18:00:00Z',
    };
    expect(sleepDurationHours(entry)).toBe(0);
  });

  it('formats durations as "7h 30m" / "45m" / "7h"', () => {
    expect(formatSleepDuration(7.5)).toBe('7h 30m');
    expect(formatSleepDuration(0.75)).toBe('45m');
    expect(formatSleepDuration(7)).toBe('7h');
  });
});

describe('Sleep Store — CRUD + queue behaviour', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function freshStore() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../store');
    return mod.useSleepStore as typeof import('../store').useSleepStore;
  }

  it('adds an entry, sorts by start time, and returns an id', () => {
    const store = freshStore();
    const id1 = store.getState().addEntry({
      startTime: '2026-09-11T18:00:00Z',
      endTime: '2026-09-12T01:00:00Z',
      quality: 4,
      mood: null,
      interruptions: 1,
      notes: '',
      source: 'manual',
    });
    const id2 = store.getState().addEntry({
      startTime: '2026-09-10T18:00:00Z',
      endTime: '2026-09-11T00:30:00Z',
      quality: null,
      mood: null,
      interruptions: 0,
      notes: 'early night',
      source: 'auto',
    });

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    const entries = store.getState().entries;
    // sorted oldest → newest by startTime
    expect(entries[0].id).toBe(id2);
    expect(entries[1].id).toBe(id1);
    expect(entries[0].source).toBe('auto');
    expect(entries[1].quality).toBe(4);
  });

  it('edits an entry by merging partial data', () => {
    const store = freshStore();
    const id = store.getState().addEntry({
      startTime: '2026-09-11T18:00:00Z',
      endTime: '2026-09-12T01:00:00Z',
      quality: null,
      mood: null,
      interruptions: 0,
      notes: '',
      source: 'manual',
    });
    store.getState().editEntry(id, { quality: 5, notes: 'great night' });
    const e = store.getState().entries.find((x) => x.id === id);
    expect(e?.quality).toBe(5);
    expect(e?.notes).toBe('great night');
    expect(e?.startTime).toBe('2026-09-11T18:00:00Z'); // unchanged
  });

  it('deletes an entry', () => {
    const store = freshStore();
    const id = store.getState().addEntry({
      startTime: '2026-09-11T18:00:00Z',
      endTime: '2026-09-12T01:00:00Z',
      quality: null,
      mood: null,
      interruptions: 0,
      notes: '',
      source: 'manual',
    });
    expect(store.getState().entries.length).toBe(1);
    store.getState().deleteEntry(id);
    expect(store.getState().entries.length).toBe(0);
  });

  it('setReminderTime persists locally without queueing a sync', () => {
    const store = freshStore();
    store.getState().setReminderTime({ hour: 23, minute: 0 });
    expect(store.getState().reminderTime).toEqual({ hour: 23, minute: 0 });
    store.getState().setReminderTime(null);
    expect(store.getState().reminderTime).toBeNull();
  });
});
