import {
  computeWeekReview,
  weekLabel,
  weekRangeOf,
  weekStartOf,
  scoreDescriptor,
} from '../weeklyReview';
import { HABITS } from '../../habits/habits';

const week = '2026-11-08'; // Sunday

describe('week navigation helpers', () => {
  it('snaps any day to its Sunday', () => {
    expect(weekStartOf('2026-11-15')).toBe('2026-11-15'); // it IS a Sunday
    expect(weekStartOf('2026-11-11')).toBe('2026-11-08'); // Wednesday
    expect(weekStartOf('2026-11-14')).toBe('2026-11-08'); // Saturday
  });

  it('produces the Saturday end key', () => {
    expect(weekRangeOf('2026-11-08')).toEqual({ startKey: '2026-11-08', endKey: '2026-11-14' });
  });

  it('labels the week compactly', () => {
    expect(weekLabel('2026-11-08')).toBe('8 to 14 Nov 2026');
  });

  it('labels weeks that cross a month boundary', () => {
    expect(weekLabel('2026-11-29')).toBe('29 Nov to 5 Dec 2026');
  });
});

const t = (
  type: string,
  amount: number,
  date: string,
  category = 'Food',
  notes: string | null = null,
) => ({ type, amount, date, category, notes });

const empty = {
  weekStartKey: week,
  transactions: [],
  fixedExpenseNames: [],
  sleepEntries: [],
  habitDays: [],
  habitDefs: HABITS,
  tasks: [],
  lent: [],
  todayKey: '2026-11-15',
};

describe('computeWeekReview — spend', () => {
  const txs = [
    t('expense', 300_00, '2026-11-09T10:00:00', 'Food'),        // Mon, ₹300
    t('expense', 700_00, '2026-11-12T10:00:00', 'Travel'),      // Thu, ₹700
    t('expense', 25000_00, '2026-11-09T10:00:00', 'Rent'),      // excluded
    t('expense', 5000_00, '2026-11-09T10:00:00', 'Investments'), // SIP excluded
    t('expense', 2000_00, '2026-11-09T10:00:00', 'Wallet Loads'), // excluded
    t('expense', 1500_00, '2026-11-09T10:00:00', 'Recharge', 'Payzapp Wallet Load'), // excluded via notes
    t('fuel_purchase', 1000_00, '2026-11-13T10:00:00', 'Fuel'), // ₹1,000
    t('expense', 500_00, '2026-11-02T10:00:00', 'Food'),        // previous week, ₹500
  ];

  const review = computeWeekReview({
    ...empty,
    transactions: txs,
    fixedExpenseNames: ['Mobile'],
  });

  it('sums only true everyday spend for the reviewed week', () => {
    expect(review.spendPaise).toBe(300_00 + 700_00 + 1000_00);
  });

  it('splits per-day spend in the heat cells', () => {
    expect(review.days).toHaveLength(7);
    expect(review.days[1].spendPaise).toBe(300_00); // Monday
    expect(review.days[4].spendPaise).toBe(700_00); // Thursday
  });

  it('measures the delta against the previous week', () => {
    expect(review.prevSpendPaise).toBe(500_00);
    expect(review.spendDeltaPct).toBe(Math.round(((2000_00 - 500_00) / 500_00) * 100)); // +300%
  });

  it('computes food share and the top category from the same exclusions', () => {
    expect(review.foodSharePct).toBe(15); // 300 of 2000
    expect(review.topCategory).toEqual({ name: 'Fuel', amountPaise: 1000_00 });
  });

  it('marks the cap a sensible ₹100 rounding', () => {
    const focus = review.focus.join(' ');
    expect(focus).toContain('Cap Fuel spending at ₹');
  });
});

describe('computeWeekReview — sleep, habits, tasks, score', () => {
  const sleepEntries = [
    { startTime: '2026-11-08T22:30:00', endTime: '2026-11-09T06:00:00', interruptions: 0 }, // 7.5h, ends Monday
    { startTime: '2026-11-09T23:00:00', endTime: '2026-11-10T07:30:00', interruptions: 1 }, // 8.5h, ends Tuesday
  ];
  const habitDays = [
    { day: '2026-11-09', habits: HABITS.slice(0, 10).map((h) => h.key) }, // 10/10 on Monday
    { day: '2026-11-10', habits: [HABITS[0].key] }, // 1/10 Tuesday
  ];
  const tasks = [
    { name: 'Done task', priority: 'medium', dueDate: '2026-11-10', completed: true, completedAt: '2026-11-11T10:00:00.000Z' },
    { name: 'Open urgent', priority: 'urgent', dueDate: '2026-11-12', completed: false, completedAt: null },
    { name: 'Old urgent', priority: 'urgent', dueDate: '2026-10-01', completed: false, completedAt: null }, // overdue — still counts
  ];

  const review = computeWeekReview({
    ...empty,
    sleepEntries,
    habitDays,
    tasks,
  });

  it('averages sleep per logged night and counts nights on target', () => {
    expect(review.sleepNightsLogged).toBe(2);
    expect(review.sleepAvgMin).toBe(Math.round((450 + 510) / 2));
    expect(review.nightsOnTarget).toBe(2);
    expect(review.sleepInterruptions).toBe(1);
  });

  it('averages habit progress across the seven days (missing days count as zero)', () => {
    // (1.0 + 0.1) / 7
    expect(review.habitsPct).toBeCloseTo(1.1 / 7, 5);
    expect(review.days[1].habitProgress).toBe(1);
  });

  it('counts tasks due or completed this week, and urgent open items', () => {
    expect(review.tasksPlanned).toBe(2); // done task (completed in week) + urgent due in week
    expect(review.tasksDone).toBe(1);
    expect(review.urgentOpen).toBe(2); // in-week urgent + overdue urgent
  });

  it('produces an in-range score and a signed delta', () => {
    expect(review.score).not.toBeNull();
    expect(review.score as number).toBeGreaterThanOrEqual(0);
    expect(review.score as number).toBeLessThanOrEqual(100);
    if (review.prevScore !== null) {
      expect(review.scoreDelta).toBe((review.score as number) - review.prevScore);
    }
  });

  it('writes a Collect-by focus for a lent receivable due next fortnight', () => {
    const r = computeWeekReview({
      ...empty,
      lent: [{ personName: 'Sharan', amount: 4462_00, paidAmount: 0, dueDate: '2026-11-25' }],
    });
    expect(r.focus.join(' ')).toContain("Collect Sharan's ₹4,462 by 25 Nov");
  });

  it('falls back gracefully with no data at all', () => {
    const r = computeWeekReview(empty);
    expect(r.score).toBeNull(); // an empty week has no score, not a perfect one
    expect(r.sleepAvgMin).toBeNull();
    expect(r.habitsPct).toBeNull();
    expect(r.focus.length).toBe(3);
    expect(r.wins.length).toBeGreaterThan(0);
    expect(r.watch.length).toBeGreaterThan(0);
  });

  it('score descriptor buckets the bands', () => {
    expect(scoreDescriptor(80).label).toBe('Great week');
    expect(scoreDescriptor(65).label).toBe('Good week');
    expect(scoreDescriptor(50).label).toBe('Fair week');
    expect(scoreDescriptor(20).label).toBe('Rough week');
  });
});
