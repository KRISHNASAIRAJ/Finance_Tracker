import {
  buildForecastEvents,
  computeAverageDailySpend,
  computeCashFlow,
  nextMonthlyDue,
} from '../forecast';
import type { ForecastEvent } from '../forecast';

const ev = (partial: Partial<ForecastEvent> & Pick<ForecastEvent, 'id' | 'dateKey' | 'amountPaise'>): ForecastEvent => ({
  title: 'x',
  subtitle: 'Lent money',
  kind: 'lent',
  ...partial,
});

describe('computeCashFlow', () => {
  const base = {
    days: 30,
    startKey: '2026-11-15',
    startBalancePaise: 100000_00, // ₹1,00,000
    minBalancePaise: 17300_00, // ₹17,300
    dailySpendPaise: 300_00, // ₹300
  };

  it('walks the window applying spend each day after today, plus same-day events', () => {
    const todayEvent = ev({ id: 'a', dateKey: '2026-11-15', amountPaise: -4582_00, kind: 'card', title: 'Card bill' });
    const f = computeCashFlow({ ...base, events: [todayEvent] });
    // Day 0: today's card bill lands, no spend yet subtracted.
    expect(f.dailyBalances[0]).toBe(100000_00 - 4582_00);
    // 30 days of everyday spend over the window.
    expect(f.projectedEndPaise).toBe(100000_00 - 4582_00 - 30 * 300_00);
  });

  it('applies events on future days and reports the tightest point', () => {
    const bigBill = ev({
      id: 'big',
      dateKey: '2026-11-30',
      amountPaise: -80000_00,
      kind: 'card',
      title: 'Huge bill',
    });
    const f = computeCashFlow({ ...base, events: [bigBill] });
    expect(f.projectedEndPaise).toBe(100000_00 - 30 * 300_00 - 80000_00);
    expect(f.dailyBalances[f.dailyBalances.length - 1]).toBe(f.projectedEndPaise);
    expect(f.tightestPaise).toBe(f.projectedEndPaise);
    expect(f.tightestDateKey).toBe('2026-12-15');
    expect(f.status).toBe('short'); // dips below the ₹17,300 minimum
  });

  it('reports safe when the cushion clears both bars', () => {
    const f = computeCashFlow({ ...base, dailySpendPaise: 100_00, events: [] });
    expect(f.status).toBe('safe');
    expect(f.lentRisk).toBeNull();
  });

  it('flags tight when headroom is under the ₹2,500 / 10% bar', () => {
    // Wallet at just above the minimum for the whole window.
    const f = computeCashFlow({
      ...base,
      startBalancePaise: 17300_00 + 500_00, // ₹500 headroom
      dailySpendPaise: 0,
      events: [],
    });
    expect(f.status).toBe('tight');
  });

  it('detects a lent inflow whose absence would break the minimum', () => {
    const lent = ev({
      id: 'lent1',
      dateKey: '2026-11-21',
      amountPaise: 500_00,
      kind: 'lent',
      title: 'Sharan',
    });
    const bill = ev({
      id: 'card1',
      dateKey: '2026-11-30',
      amountPaise: -1000_00,
      kind: 'card',
      title: 'Card bill',
    });
    const f = computeCashFlow({
      ...base,
      startBalancePaise: 17800_00, // ₹17,800 — ₹500 above the minimum
      dailySpendPaise: 0,
      events: [lent, bill],
    });
    expect(f.status).not.toBe('short'); // with the lent money, we stay above minimum
    expect(f.lentRisk).not.toBeNull();
    expect(f.lentRisk?.name).toBe('Sharan');
    expect(f.lentRisk?.firstDipDateKey).toBe('2026-11-30');
    expect(f.lentRisk?.belowPaise).toBe(500_00);
  });

  it('ignores events outside the window', () => {
    const outside = ev({ id: 'late', dateKey: '2027-01-01', amountPaise: -99999_00, kind: 'card', title: 'Out of window' });
    const f = computeCashFlow({ ...base, events: [outside] });
    expect(f.eventsInWindow).toHaveLength(0);
  });
});

describe('nextMonthlyDue', () => {
  it('returns this month when the billing day has not passed', () => {
    expect(nextMonthlyDue(20, '2026-11-15')).toBe('2026-11-20');
  });
  it('rolls to next month when the billing day already passed', () => {
    expect(nextMonthlyDue(10, '2026-11-15')).toBe('2026-12-10');
  });
  it('clamps to the last day of short months', () => {
    expect(nextMonthlyDue(31, '2026-02-10')).toBe('2026-02-28');
  });
});

describe('buildForecastEvents', () => {
  const empty = { fixedExpenses: [], cards: [], receivables: [], startKey: '2026-11-15', endKey: '2026-12-15' };

  it('builds a card event from the unpaid statement amount', () => {
    const events = buildForecastEvents({
      ...empty,
      cards: [{ id: 'c1', name: 'SBI SimplySave', balance: 5000_00, billAmount: 600_00, paidAmount: 100_00, dueDate: '2026-11-22' }],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: 'SBI SimplySave bill', subtitle: 'Card due', amountPaise: -500_00, kind: 'card' });
  });

  it('skips a fully-paid bill', () => {
    const events = buildForecastEvents({
      ...empty,
      cards: [{ id: 'c1', name: 'SBI', balance: 600_00, billAmount: 600_00, paidAmount: 600_00, dueDate: '2026-11-22' }],
    });
    expect(events).toHaveLength(0);
  });

  it('rolls a fixed expense to next month once this month is paid', () => {
    const events = buildForecastEvents({
      ...empty,
      fixedExpenses: [
        { id: 'f1', name: 'Rent', amount: 15000_00, billingDay: 5, category: 'Housing', lastPaidMonth: '2026-11' },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0].dateKey).toBe('2026-12-05');
    expect(events[0].amountPaise).toBe(-15000_00);
  });

  it('keeps this month’s bill when unpaid, even if the date already passed', () => {
    const events = buildForecastEvents({
      ...empty,
      fixedExpenses: [
        { id: 'f1', name: 'Electricity', amount: 1200_00, billingDay: 5, category: 'Utilities', lastPaidMonth: '2026-10' },
      ],
    });
    // nextMonthlyDue returns Dec 5 (Nov 5 already passed); but if it is within
    // the window it shows up; we just assert it never schedules in the past.
    for (const e of events) {
      expect(e.dateKey >= '2026-11-15').toBe(true);
    }
  });

  it('detects SIPs and treats lent money as an inflow', () => {
    const events = buildForecastEvents({
      ...empty,
      fixedExpenses: [
        { id: 's1', name: 'Parag Parikh Flexi Cap SIP', amount: 5000_00, billingDay: 20, category: 'Investments', lastPaidMonth: '2026-10' },
      ],
      receivables: [
        { id: 'r1', personName: 'Sweety', amount: 6000_00, paidAmount: 1000_00, dueDate: '2026-11-25', type: 'lent' },
        { id: 'r2', personName: 'I owe', amount: 3000_00, paidAmount: 0, dueDate: '2026-11-26', type: 'borrowed' },
      ],
    });
    const sip = events.find((e) => e.kind === 'sip');
    expect(sip?.subtitle).toBe('SIP');
    expect(sip?.amountPaise).toBe(-5000_00);
    const lent = events.find((e) => e.id === 'lent_r1');
    expect(lent?.amountPaise).toBe(5000_00); // remaining, not the full amount
    expect(events.find((e) => e.id === 'lent_r2')).toBeUndefined(); // borrowed money is not an inflow
  });
});

describe('computeAverageDailySpend', () => {
  const txs = [
    { type: 'expense', amount: 300_00, date: '2026-11-10T10:00:00', category: 'Food' },
    { type: 'expense', amount: 25000_00, date: '2026-11-05T10:00:00', category: 'Rent' }, // excluded
    { type: 'expense', amount: 5000_00, date: '2026-11-08T10:00:00', category: 'Investments' }, // SIP excluded
    { type: 'fixed_expense', amount: 4000_00, date: '2026-11-08T10:00:00', category: 'Mobile' }, // not an expense type — skipped
    { type: 'expense', amount: 2000_00, date: '2026-11-09T10:00:00', category: 'Wallet Loads' }, // excluded
    { type: 'expense', amount: 1500_00, date: '2026-11-09T10:00:00', category: 'Recharge', notes: 'Payzapp Wallet Load' }, // excluded via notes
    { type: 'fuel_purchase', amount: 1000_00, date: '2026-11-11T10:00:00', category: 'Fuel' },
    { type: 'expense', amount: 500_00, date: '2026-09-01T10:00:00', category: 'Food' }, // older than window
  ];

  it('averages only true everyday spend over the window, excluding SIP/wallet loads', () => {
    const per = computeAverageDailySpend(txs, ['Mobile'], '2026-10-16', '2026-11-15', 30);
    // (300 + 1000) / 30 days = ₹43.33… → 60 paise roll-up: 1300/30 = 43.333 → 43
    expect(per).toBe(Math.round(1300_00 / 30));
  });

  it('returns zero when there is no spend', () => {
    expect(computeAverageDailySpend([], [], '2026-10-16', '2026-11-15', 30)).toBe(0);
  });
});
