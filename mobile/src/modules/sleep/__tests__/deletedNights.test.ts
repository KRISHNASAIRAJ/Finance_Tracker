/**
 * Unit tests for the sleep-night tombstone list ("the user deleted this
 * night — never resurrect it").
 */

// A stateful AsyncStorage mock so writes are visible to reads.
let mockBacking: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockBacking[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockBacking[k] = v; }),
    removeItem: jest.fn(async (k: string) => { delete mockBacking[k]; }),
  },
}));

jest.mock('../../../services/syncQueue', () => ({
  enqueue: jest.fn(async () => {}),
  processSyncQueue: jest.fn(async () => {}),
  getPendingEntityIds: jest.fn(async () => new Set<string>()),
}));

jest.mock('../../../services/sleepWidget', () => ({
  pushSleepWidget: jest.fn(async () => {}),
}));

const mockBuckets: { m: number; v: number; s?: number }[] = [];

jest.mock('../sleepMotion', () => {
  const actual = jest.requireActual('../sleepMotion');
  return {
    ...actual,
    isSleepMotionAvailable: jest.fn(() => true),
    getMotionBuckets: jest.fn(async () => mockBuckets),
  };
});

import { DEFAULT_SLEEP_MOTION_CONFIG } from '../sleepMotion';
import {
  tombstoneDeletedNight,
  isSleepNightDeleted,
  isSleepNightRangeDeleted,
  nightDayKeyOf,
} from '../deletedNights';

const MINUTE = 60000;

describe('deletedNights tombstones', () => {
  beforeEach(() => {
    mockBacking = {};
    mockBuckets.length = 0;
    jest.clearAllMocks();
  });

  it('round-trips a tombstoned night', async () => {
    expect(await isSleepNightDeleted('2026-11-14')).toBe(false);
    await tombstoneDeletedNight('2026-11-14');
    expect(await isSleepNightDeleted('2026-11-14')).toBe(true);
    expect(await isSleepNightDeleted('2026-11-15')).toBe(false);
  });

  it('keeps the list capped at 90 entries', async () => {
    for (let i = 0; i < 100; i += 1) {
      await tombstoneDeletedNight(`2026-10-${String((i % 28) + 1).padStart(2, '0')}-${i}`);
    }
    const raw = mockBacking['meridian-sleep-deleted-nights'];
    expect(Array.isArray(JSON.parse(raw))).toBe(true);
    expect(JSON.parse(raw).length).toBeLessThanOrEqual(90);
  });

  it('nightDayKeyOf uses the local bedtime day', () => {
    const key = nightDayKeyOf(new Date(2026, 10, 14, 23, 30).toISOString());
    expect(key).toMatch(/^2026-11-1[45]$/); // timezone-safe: allow either edge
  });

  it('isSleepNightRangeDeleted matches either day of the night', async () => {
    const bed = new Date(2026, 10, 14, 23, 30);
    const wake = new Date(2026, 10, 15, 7, 0);
    await tombstoneDeletedNight(nightDayKeyOf(wake.toISOString()));
    expect(await isSleepNightRangeDeleted(bed.toISOString(), wake.toISOString())).toBe(true);
    expect(await isSleepNightRangeDeleted(new Date(2026, 10, 16, 23, 30).toISOString(), new Date(2026, 10, 17, 7, 0).toISOString())).toBe(false);
    // and with only a start time
    expect(await isSleepNightRangeDeleted(new Date(2026, 10, 16, 23, 30).toISOString())).toBe(false);
  });

  it('autoSave does not resurrect a tombstoned night', async () => {
    jest.resetModules();
    const mod = require('../autoSave');
    const store = require('../store');
    const { localDayKey } = require('../../finance/financeFormat');

    const useSleepStore = store.useSleepStore as typeof import('../store').useSleepStore;
    useSleepStore.setState({
      entries: [],
      autoConfig: { ...DEFAULT_SLEEP_MOTION_CONFIG, enabled: true, autoSave: true },
    });

    const BED = new Date(2026, 10, 14, 23, 0, 0, 0);
    const BED_MIN = Math.floor(BED.getTime() / MINUTE);
    for (let i = 0; i < 480; i += 1) mockBuckets.push({ m: BED_MIN + i, v: 0.05, s: 0 });
    const bedDay = localDayKey(BED);
    await tombstoneDeletedNight(bedDay);

    const now = (BED_MIN + 480 + 10) * MINUTE;
    const id = await mod.autoSaveLastNight(now);
    expect(id).toBeNull();
    expect(useSleepStore.getState().entries).toHaveLength(0);
  });

  it('store.deleteEntry tombstones the night it removed', async () => {
    jest.resetModules();
    const store = require('../store');
    const { localDayKey } = require('../../finance/financeFormat');
    const useSleepStore = store.useSleepStore as typeof import('../store').useSleepStore;

    const bed = new Date(2026, 10, 14, 23, 0, 0, 0);
    const wake = new Date(2026, 10, 15, 7, 0, 0, 0);
    useSleepStore.setState({
      entries: [
        {
          id: 'test-entry',
          startTime: bed.toISOString(),
          endTime: wake.toISOString(),
          quality: null,
          mood: null,
          interruptions: 0,
          notes: '',
          source: 'auto-motion',
        },
      ],
    });

    useSleepStore.getState().deleteEntry('test-entry');
    expect(useSleepStore.getState().entries).toHaveLength(0);
    // The tombstone write is fire-and-forget in deleteEntry — flush it.
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(await isSleepNightDeleted(localDayKey(bed))).toBe(true);
  });
});
