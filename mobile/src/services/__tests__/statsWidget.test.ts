/**
 * Stats widget — pure stats-core tests. computeDailyStats must be resilient:
 * only outflow types count as spend, tasks are filtered by IST day, the
 * latest sleep entry wins, and malformed rows never poison the numbers.
 */
import { computeDailyStats } from '../statsWidget';

const day = '2026-11-11';

const tx = (date: string, amount: number, type: string = 'expense') =>
  ({ id: `t_${date}_${type}`, type, amount, date } as any);

const task = (dueDate: string | null, completed = false) =>
  ({
    id: `task_${dueDate}`,
    name: 't',
    description: null,
    priority: 'medium',
    dueDate,
    completed,
    completedAt: null,
    subtasks: [],
    recurrence: 'none',
  } as any);

const sleep = (start: string, end: string) =>
  ({ id: `s_${start}`, startTime: start, endTime: end, quality: 'ok' } as any);

const base = {
  dayKey: day,
  transactions: [],
  tasks: [],
  habitDays: [],
  habitsTotal: 7,
  sleepEntries: [],
};

describe('computeDailyStats — spend', () => {
  it('sums only today outflow types in paise', () => {
    const stats = computeDailyStats({
      ...base,
      transactions: [
        tx('2026-11-11T04:00:00.000Z', 25000), // 9:30 IST today → ₹250
        tx('2026-11-11T08:00:00.000Z', 40000, 'fuel_purchase'),
        tx('2026-11-11T09:00:00.000Z', 99999, 'portfolio_buy'), // excluded
        tx('2026-11-11T09:00:00.000Z', 12345, 'lent'), // excluded
        tx('2026-11-10T05:00:00.000Z', 500000), // yesterday IST
      ],
    });
    expect(stats.spendPaise).toBe(65000);
  });

  it('ignores malformed dates and non-finite amounts', () => {
    const stats = computeDailyStats({
      ...base,
      transactions: [
        { id: 'a', type: 'expense', amount: NaN, date: '2026-11-11T04:00:00.000Z' } as any,
        tx('not-a-date', 1000),
        tx('2026-11-11T04:00:00.000Z', 1000),
      ],
    });
    expect(stats.spendPaise).toBe(1000);
  });
});

describe('computeDailyStats — tasks', () => {
  it('counts open tasks due today or overdue', () => {
    const stats = computeDailyStats({
      ...base,
      tasks: [
        task('2026-11-11T10:00:00.000Z'),
        task('2026-11-09T10:00:00.000Z'),
        task('2026-11-11T10:00:00.000Z', true), // completed → out
        task('2026-11-12T10:00:00.000Z'), // future → out
        task(null), // no due date → out
      ],
    });
    expect(stats.tasksLeft).toBe(2);
  });
});

describe('computeDailyStats — habits and sleep', () => {
  it('uses today habit row and the latest sleep entry', () => {
    const stats = computeDailyStats({
      ...base,
      habitDays: [{ id: 'h1', day, habits: ['water', 'read', 'walk'], notes: '' }],
      habitsTotal: 7,
      sleepEntries: [
        sleep('2026-11-08T20:00:00.000Z', '2026-11-09T10:00:00.000Z'), // older, longer → ignored
        sleep('2026-11-10T19:30:00.000Z', '2026-11-11T03:00:00.000Z'), // 7.5h → wins
      ],
    });
    expect(stats.habitsDone).toBe(3);
    expect(stats.habitsTotal).toBe(7);
    expect(stats.sleepHours).toBeCloseTo(7.5);
  });

  it('returns zeros and null sleep when everything is empty', () => {
    const stats = computeDailyStats(base);
    expect(stats.spendPaise).toBe(0);
    expect(stats.tasksLeft).toBe(0);
    expect(stats.habitsDone).toBe(0);
    expect(stats.sleepHours).toBeNull();
  });
});
