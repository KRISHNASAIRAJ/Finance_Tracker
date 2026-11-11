/**
 * Market sync watchdog — weekend skip, freshness rules and the
 * once-per-day notification contract.
 */
jest.mock('../notificationService', () => ({
  scheduleImmediate: jest.fn(async () => {}),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  istDayKey,
  isWeekendDayKey,
  previousTradingDayKey,
  evaluateMarketSyncFreshness,
  runMarketSyncWatchdog,
} from '../marketSyncWatchdog';
import { useInvestmentsStore } from '../../modules/equity/store';
import { scheduleImmediate } from '../notificationService';

const mockSchedule = scheduleImmediate as jest.Mock;

const holding = (over: any = {}) => ({
  id: 'h1',
  symbol: 'TEST',
  name: 'Test',
  type: 'mf',
  quantity: 1,
  avgPrice: 100,
  currentPrice: 100,
  source: 'manual',
  ...over,
});

describe('market sync watchdog — calendar helpers', () => {
  it('detects Saturday and Sunday', () => {
    expect(isWeekendDayKey('2026-11-14')).toBe(true); // Saturday
    expect(isWeekendDayKey('2026-11-15')).toBe(true); // Sunday
    expect(isWeekendDayKey('2026-11-11')).toBe(false); // Wednesday
  });

  it('walks back to the previous trading day', () => {
    expect(previousTradingDayKey('2026-11-11')).toBe('2026-11-10'); // Wed → Tue
    expect(previousTradingDayKey('2026-11-16')).toBe('2026-11-13'); // Mon → Fri
    expect(previousTradingDayKey('2026-11-14')).toBe('2026-11-13'); // Sat → Fri
  });

  it('derives the IST day key', () => {
    // 2026-11-11T20:00:00Z is already 2026-11-12 in IST
    expect(istDayKey(new Date('2026-11-11T20:00:00.000Z'))).toBe('2026-11-12');
  });
});

describe('market sync watchdog — freshness', () => {
  const todayKey = '2026-11-11'; // Wednesday

  it('flags Kite holdings synced before the previous trading day', () => {
    const state = evaluateMarketSyncFreshness({
      todayKey,
      holdings: [
        holding({ type: 'equity', source: 'kite_sync', lastSyncedAt: '2026-11-09T10:00:00.000Z' }),
      ],
    });
    expect(state.kiteStale).toBe(true);
  });

  it('accepts a Kite sync from the previous trading day or today', () => {
    const state = evaluateMarketSyncFreshness({
      todayKey,
      holdings: [
        holding({ type: 'equity', source: 'kite_sync', lastSyncedAt: '2026-11-10T10:00:00.000Z' }),
      ],
    });
    expect(state.kiteStale).toBe(false);
  });

  it('does not complain when there are no Kite-linked holdings', () => {
    const state = evaluateMarketSyncFreshness({
      todayKey,
      holdings: [holding({ type: 'mf', updatedAt: '2026-11-01T10:00:00.000Z' })],
    });
    expect(state.kiteStale).toBe(false);
  });

  it('flags MF NAV that has not refreshed since the previous trading day', () => {
    const state = evaluateMarketSyncFreshness({
      todayKey,
      holdings: [holding({ type: 'mf', updatedAt: '2026-11-09T10:00:00.000Z' })],
    });
    expect(state.mfStale).toBe(true);
  });

  it('accepts MF NAV refreshed today (NAV for the previous day lands in the morning)', () => {
    const state = evaluateMarketSyncFreshness({
      todayKey,
      holdings: [holding({ type: 'mf', updatedAt: '2026-11-11T02:00:00.000Z' })],
    });
    expect(state.mfStale).toBe(false);
  });
});

describe('market sync watchdog — one notification per day', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockSchedule.mockClear();
    useInvestmentsStore.setState({
      holdings: [
        holding({ type: 'equity', source: 'kite_sync', lastSyncedAt: '2026-11-01T10:00:00.000Z' }),
      ],
    } as any);
  });

  it('sends nothing on Saturday or Sunday', async () => {
    await runMarketSyncWatchdog(new Date('2026-11-14T10:00:00.000Z'));
    await runMarketSyncWatchdog(new Date('2026-11-15T10:00:00.000Z'));
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('sends one notification on a weekday and never repeats it that day', async () => {
    await runMarketSyncWatchdog(new Date('2026-11-11T04:00:00.000Z')); // 9:30 IST Wed
    expect(mockSchedule).toHaveBeenCalledTimes(1);

    // Later the same day — must not fire again
    await runMarketSyncWatchdog(new Date('2026-11-11T09:00:00.000Z'));
    await runMarketSyncWatchdog(new Date('2026-11-11T12:00:00.000Z'));
    expect(mockSchedule).toHaveBeenCalledTimes(1);

    // Next day it may fire again
    await runMarketSyncWatchdog(new Date('2026-11-12T04:00:00.000Z'));
    expect(mockSchedule).toHaveBeenCalledTimes(2);
  });

  it('stays silent when the data is fresh', async () => {
    useInvestmentsStore.setState({
      holdings: [
        holding({ type: 'equity', source: 'kite_sync', lastSyncedAt: '2026-11-11T04:00:00.000Z' }),
      ],
    } as any);
    await runMarketSyncWatchdog(new Date('2026-11-11T06:00:00.000Z'));
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
