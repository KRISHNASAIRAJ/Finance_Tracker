/**
 * Unit tests for the motion-tracker auto-save — the morning check that logs
 * last night's sleep without the user doing anything.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
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

const MINUTE = 60000;
const BED = new Date(2026, 10, 14, 23, 0, 0, 0); // Nov 14, 11 PM local
const BED_MIN = Math.floor(BED.getTime() / MINUTE);
const WAKE_MIN = BED_MIN + 480; // 8h night

function buildNight(overrides?: { awakeFrom?: number; awakeTo?: number }) {
  mockBuckets.length = 0;
  for (let i = 0; i < 480; i++) {
    const awake = overrides && i >= (overrides.awakeFrom ?? -1) && i <= (overrides.awakeTo ?? -1);
    mockBuckets.push({ m: BED_MIN + i, v: awake ? 1.5 : 0.05, s: awake ? 25 : 0 });
  }
}

function freshModules() {
  jest.resetModules();
  const mod = require('../autoSave');
  const store = require('../store');
  return {
    autoSaveLastNight: mod.autoSaveLastNight as (now?: number) => Promise<string | null>,
    useSleepStore: store.useSleepStore as typeof import('../store').useSleepStore,
  };
}

function enableTracker(store: typeof import('../store').useSleepStore) {
  store.setState({ autoConfig: { ...DEFAULT_SLEEP_MOTION_CONFIG, enabled: true, autoSave: true } });
}

describe('autoSaveLastNight', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    buildNight();
  });

  it('logs the night once it has settled and does not double-log', async () => {
    const { autoSaveLastNight, useSleepStore } = freshModules();
    enableTracker(useSleepStore);
    const now = WAKE_MIN * MINUTE + 10 * MINUTE; // 10 min after wake

    const id = await autoSaveLastNight(now);
    expect(id).not.toBeNull();
    expect(useSleepStore.getState().entries).toHaveLength(1);
    expect(useSleepStore.getState().entries[0].source).toBe('auto-motion');

    const again = await autoSaveLastNight(now);
    expect(again).toBe(id);
    expect(useSleepStore.getState().entries).toHaveLength(1);
  });

  it('does not log while the night is still running', async () => {
    const { autoSaveLastNight, useSleepStore } = freshModules();
    enableTracker(useSleepStore);
    const id = await autoSaveLastNight(WAKE_MIN * MINUTE - MINUTE); // 1 min before wake
    expect(id).toBeNull();
    expect(useSleepStore.getState().entries).toHaveLength(0);
  });

  it('waits for the user when the night has a 5–10 minute ambiguous gap', async () => {
    buildNight({ awakeFrom: 200, awakeTo: 206 }); // 7 consecutive awake minutes
    const { autoSaveLastNight, useSleepStore } = freshModules();
    enableTracker(useSleepStore);
    const id = await autoSaveLastNight(WAKE_MIN * MINUTE + 10 * MINUTE);
    expect(id).toBeNull();
    expect(useSleepStore.getState().entries).toHaveLength(0);
  });

  it('does nothing when auto-tracking is disabled', async () => {
    const { autoSaveLastNight, useSleepStore } = freshModules();
    useSleepStore.setState({ autoConfig: { ...DEFAULT_SLEEP_MOTION_CONFIG, enabled: false, autoSave: true } });
    const id = await autoSaveLastNight(WAKE_MIN * MINUTE + 10 * MINUTE);
    expect(id).toBeNull();
    expect(useSleepStore.getState().entries).toHaveLength(0);
  });
});
