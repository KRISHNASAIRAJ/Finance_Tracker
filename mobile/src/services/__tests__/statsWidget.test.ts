/**
 * Stats widget — pure stats-core tests. computeWidgetStats must be
 * resilient: only outflow types count as spend, monthly roll-up is
 * IST-scoped, card bills fall back to outstanding, net lent flips sign
 * for borrowings, and malformed rows never poison the numbers.
 */
import { computeWidgetStats } from '../statsWidget';

const dayKey = '2026-11-11';
const monthKey = '2026-11';

const tx = (date: string, amount: number, type: string = 'expense', category = 'Food') =>
  ({ id: `t_${date}_${type}`, type, amount, date, category } as any);

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

const base = {
  dayKey,
  monthKey,
  transactions: [],
  cards: [],
  accounts: [],
  receivables: [],
  tasks: [],
  netWorthPaise: 0,
  // 2026-11-15 local — deterministic month window for the spend rules
  now: new Date('2026-11-15T12:00:00+05:30'),
};

describe('computeWidgetStats — monthly spend', () => {
  it('counts expense + vehicle_service in the current month', () => {
    const stats = computeWidgetStats({
      ...base,
      transactions: [
        tx('2026-11-11T04:00:00.000Z', 25000), // ₹250
        tx('2026-11-02T08:00:00.000Z', 40000, 'vehicle_service'),
        tx('2026-10-30T05:00:00.000Z', 500000), // last month → out
      ],
    });
    expect(stats.monthlySpendPaise).toBe(65000);
  });

  it('excludes fixed expenses, SIP/investment categories and fuel transactions', () => {
    const stats = computeWidgetStats({
      ...base,
      fixedExpenseNames: ['Flat Rent'],
      transactions: [
        tx('2026-11-11T04:00:00.000Z', 25000, 'expense', 'Food'),
        tx('2026-11-11T04:00:00.000Z', 500000, 'fixed_expense', 'Rent'),
        tx('2026-11-11T04:00:00.000Z', 90000, 'expense', 'Rent'),
        tx('2026-11-11T04:00:00.000Z', 90000, 'expense', 'SIP'),
        tx('2026-11-11T04:00:00.000Z', 90000, 'expense', 'Investments'),
        tx('2026-11-11T04:00:00.000Z', 90000, 'fuel_purchase', 'Fuel'),
      ],
    });
    expect(stats.monthlySpendPaise).toBe(25000);
  });

  it('adds this month garage fuel fills', () => {
    const stats = computeWidgetStats({
      ...base,
      transactions: [tx('2026-11-11T04:00:00.000Z', 25000)],
      garageFills: [
        { date: '2026-11-05T04:00:00.000Z', amount: 300000 },
        { date: '2026-10-05T04:00:00.000Z', amount: 200000 }, // last month → out
      ],
    });
    expect(stats.monthlySpendPaise).toBe(325000);
  });

  it('ignores malformed dates and non-finite amounts', () => {
    const stats = computeWidgetStats({
      ...base,
      transactions: [
        { id: 'a', type: 'expense', amount: NaN, date: '2026-11-11T04:00:00.000Z' } as any,
        tx('not-a-date', 1000),
        tx('2026-11-11T04:00:00.000Z', 1000),
      ],
    });
    expect(stats.monthlySpendPaise).toBe(1000);
  });
});

describe('computeWidgetStats — cards, accounts, lent', () => {
  it('sums card balances (the app\'s card-outstanding rule)', () => {
    const stats = computeWidgetStats({
      ...base,
      cards: [
        { balance: 120000, billAmount: 50000 } as any,
        { balance: 30000, billAmount: 0 } as any,
        { balance: 20000 } as any,
      ],
    });
    expect(stats.ccBillsPaise).toBe(170000);
  });

  it('ignores a partly-paid gross statement and prefers balance over a stale outstanding', () => {
    const stats = computeWidgetStats({
      ...base,
      cards: [
        // balance is what the app shows; billAmount (gross) and a stale
        // currentOutstanding must not change the total
        { balance: 150000, billAmount: 200000, paidAmount: 50000, currentOutstanding: 999999 } as any,
      ],
    });
    expect(stats.ccBillsPaise).toBe(150000);
  });

  it('falls back to current_outstanding only when balance is absent', () => {
    const stats = computeWidgetStats({
      ...base,
      cards: [{ currentOutstanding: 42000 } as any],
    });
    expect(stats.ccBillsPaise).toBe(42000);
  });

  it('sums bank account balances', () => {
    const stats = computeWidgetStats({
      ...base,
      accounts: [{ amount: 500000 } as any, { amount: NaN } as any, { amount: 250000 } as any],
    });
    expect(stats.bankBalancePaise).toBe(750000);
  });

  it('nets lent against borrowed using outstanding amounts', () => {
    const stats = computeWidgetStats({
      ...base,
      receivables: [
        { type: 'lent', amount: 100000, paidAmount: 20000 } as any,
        { type: 'borrowed', amount: 30000, paidAmount: 0 } as any,
      ],
    });
    expect(stats.netLentPaise).toBe(50000);
  });

  it('goes negative when borrowings exceed lending', () => {
    const stats = computeWidgetStats({
      ...base,
      receivables: [
        { type: 'lent', amount: 10000, paidAmount: 0 } as any,
        { type: 'borrowed', amount: 40000, paidAmount: 0 } as any,
      ],
    });
    expect(stats.netLentPaise).toBe(-30000);
  });
});

describe('computeWidgetStats — market today', () => {
  it('reports the day change in paise and percent against the previous close value', () => {
    const stats = computeWidgetStats({
      ...base,
      dayChangePaise: 2000,
      portfolioValuePaise: 100000,
    });
    // 2000 / (100000 - 2000) = 2.04%
    expect(stats.dayChangePaise).toBe(2000);
    expect(stats.dayChangePct).toBeCloseTo(2.04, 2);
    expect(stats.portfolioValuePaise).toBe(100000);
  });

  it('keeps a negative day change and reports a negative percent', () => {
    const stats = computeWidgetStats({
      ...base,
      dayChangePaise: -2500,
      portfolioValuePaise: 100000,
    });
    expect(stats.dayChangePaise).toBe(-2500);
    // -2500 / (100000 + 2500) = -2.44%
    expect(stats.dayChangePct).toBeCloseTo(-2.44, 2);
  });

  it('falls back to a zero percent when there is no portfolio value', () => {
    const stats = computeWidgetStats({ ...base, dayChangePaise: 1000 });
    expect(stats.dayChangePct).toBe(0);
    expect(stats.dayChangePaise).toBe(1000);
  });
});

describe('computeWidgetStats — tasks and net worth', () => {
  it('counts open tasks due today or overdue', () => {
    const stats = computeWidgetStats({
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

  it('keeps a non-finite net worth at zero', () => {
    const stats = computeWidgetStats({ ...base, netWorthPaise: NaN });
    expect(stats.netWorthPaise).toBe(0);
  });

  it('returns zeros when everything is empty', () => {
    const stats = computeWidgetStats(base);
    expect(stats.monthlySpendPaise).toBe(0);
    expect(stats.ccBillsPaise).toBe(0);
    expect(stats.bankBalancePaise).toBe(0);
    expect(stats.netLentPaise).toBe(0);
    expect(stats.tasksLeft).toBe(0);
  });
});
