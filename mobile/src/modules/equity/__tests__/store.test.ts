/**
 * Equity store tests — loan ± adjust math and the NaN guards that keep a
 * malformed row from poisoning the portfolio dashboard.
 */
jest.mock('../../../services/syncQueue', () => ({
  enqueue: jest.fn(async () => {}),
  processSyncQueue: jest.fn(async () => {}),
  getQueueLength: jest.fn(() => 0),
}));

import {
  useInvestmentsStore,
  allocationCategoryOf,
  allocationBuckets,
  holdingDisplayName,
  todayPnLSplit,
  holdingDayChange,
  type Holding,
} from '../store';

const reset = () =>
  useInvestmentsStore.setState({
    holdings: [],
    goals: [],
    loans: [],
    fds: [],
    snapshots: [],
    chatHistory: [],
    portfolioActionPlan: '',
    lastEquitySyncedAt: null,
  });

const holding = (over: Partial<Holding> = {}): Holding =>
  ({
    id: 'h1',
    symbol: 'TEST',
    name: 'Test Fund',
    type: 'mf',
    quantity: 10,
    avgPrice: 100,
    currentPrice: 120,
    source: 'manual',
    ...over,
  } as Holding);

describe('Equity — loan adjust', () => {
  beforeEach(reset);

  it('adds to the outstanding amount', () => {
    const { addLoan, adjustLoanAmount } = useInvestmentsStore.getState();
    const id = addLoan({ name: 'Home loan', amount: 5000000 });

    adjustLoanAmount(id, 250000);
    expect(useInvestmentsStore.getState().loans[0].amount).toBe(5250000);
  });

  it('subtracts from the outstanding amount', () => {
    const { addLoan, adjustLoanAmount } = useInvestmentsStore.getState();
    const id = addLoan({ name: 'Home loan', amount: 5000000 });

    adjustLoanAmount(id, -1000000);
    expect(useInvestmentsStore.getState().loans[0].amount).toBe(4000000);
  });

  it('clamps at zero when the subtraction exceeds the outstanding', () => {
    const { addLoan, adjustLoanAmount } = useInvestmentsStore.getState();
    const id = addLoan({ name: 'Bike loan', amount: 100000 });

    adjustLoanAmount(id, -500000);
    expect(useInvestmentsStore.getState().loans[0].amount).toBe(0);
  });

  it('ignores zero, NaN and unknown-id adjustments', () => {
    const { addLoan, adjustLoanAmount } = useInvestmentsStore.getState();
    const id = addLoan({ name: 'Home loan', amount: 5000000 });

    adjustLoanAmount(id, 0);
    adjustLoanAmount(id, NaN);
    adjustLoanAmount('missing-id', 1000);

    expect(useInvestmentsStore.getState().loans[0].amount).toBe(5000000);
  });
});

describe('Equity — display names', () => {
  it('suffixes mutual funds with SIP', () => {
    expect(holdingDisplayName({ name: 'HDFC Mid Cap', type: 'mf' })).toBe('HDFC Mid Cap (SIP)');
  });

  it('leaves equities, ETFs and others untouched', () => {
    expect(holdingDisplayName({ name: 'RELIANCE', type: 'equity' })).toBe('RELIANCE');
    expect(holdingDisplayName({ name: 'NIFTYBEES', type: 'etf' })).toBe('NIFTYBEES');
    expect(holdingDisplayName({ name: 'Sovereign Gold', type: 'other' })).toBe('Sovereign Gold');
  });

  it('does not double-suffix an already tagged name', () => {
    expect(holdingDisplayName({ name: 'HDFC Mid Cap (SIP)', type: 'mf' })).toBe('HDFC Mid Cap (SIP)');
    expect(holdingDisplayName({ name: 'HDFC Mid Cap (sip)', type: 'mf' })).toBe('HDFC Mid Cap (sip)');
  });

  it('handles an empty name', () => {
    expect(holdingDisplayName({ name: '', type: 'mf' })).toBe('');
  });
});

describe('Equity — allocation categories', () => {
  it('falls back to the holding type when no category is set', () => {
    expect(allocationCategoryOf({ type: 'mf' })).toBe('Mutual Funds');
    expect(allocationCategoryOf({ type: 'etf' })).toBe('ETF');
    expect(allocationCategoryOf({ type: 'equity' })).toBe('Equity');
    expect(allocationCategoryOf({ type: 'other' })).toBe('Other');
  });

  it('honours an explicit, known category (trimmed, case-insensitive)', () => {
    expect(allocationCategoryOf({ type: 'mf', allocation: 'gold' })).toBe('Gold');
    expect(allocationCategoryOf({ type: 'mf', allocation: '  Realty ' })).toBe('Realty');
  });

  it('ignores an unknown category string', () => {
    expect(allocationCategoryOf({ type: 'mf', allocation: 'Crypto' })).toBe('Mutual Funds');
    expect(allocationCategoryOf({ type: 'mf', allocation: '' })).toBe('Mutual Funds');
  });

  it('skips holdings worth nothing so they cannot create phantom slices', () => {
    const buckets = allocationBuckets([
      { type: 'mf', quantity: 10, currentPrice: 100 },
      { type: 'mf', allocation: 'Gold', quantity: 0, currentPrice: 100 }, // sold out → out
      { type: 'equity', quantity: 5, currentPrice: 0 }, // zero value → out
      { type: 'mf', quantity: NaN, currentPrice: 100 }, // malformed → out
      { type: 'mf', quantity: 10, currentPrice: 50 },
    ]);

    expect(buckets.map((b) => b.category)).toEqual(['Mutual Funds']);
    expect(buckets[0].value).toBe(1500);
    expect(buckets[0].pct).toBe(100);
  });

  it('groups by category and sorts by value descending', () => {
    const buckets = allocationBuckets([
      { type: 'mf', quantity: 10, currentPrice: 100 }, // Mutual Funds 1000
      { type: 'mf', allocation: 'Gold', quantity: 10, currentPrice: 300 }, // Gold 3000
      { type: 'equity', quantity: 10, currentPrice: 200 }, // Equity 2000
    ]);

    expect(buckets.map((b) => b.category)).toEqual(['Gold', 'Equity', 'Mutual Funds']);
    expect(buckets[0].pct).toBeCloseTo(50);
  });
});

describe('Equity — NaN guards', () => {
  beforeEach(reset);

  it('skips holdings with non-finite quantity or price', () => {
    useInvestmentsStore.setState({
      holdings: [
        holding({ id: 'ok', quantity: 10, currentPrice: 120 }),
        holding({ id: 'nan_qty', quantity: NaN, currentPrice: 120 }),
        holding({ id: 'nan_price', quantity: 10, currentPrice: NaN }),
      ],
    });

    expect(useInvestmentsStore.getState().getPortfolioValue()).toBe(1200);
  });

  it('skips rows without a usable prevClose in the day P&L', () => {
    useInvestmentsStore.setState({
      holdings: [
        holding({ id: 'ok', quantity: 10, currentPrice: 120, prevClose: 100 }),
        holding({ id: 'no_prev', quantity: 10, currentPrice: 120 }),
        holding({ id: 'zero_prev', quantity: 10, currentPrice: 120, prevClose: 0 }),
        holding({ id: 'nan_prev', quantity: 10, currentPrice: 120, prevClose: NaN }),
      ],
    });

    expect(useInvestmentsStore.getState().getTodayPnL()).toBe(200);
  });

  it('splits the day P&L into equity and mutual funds', () => {
    const split = todayPnLSplit([
      holding({ id: 'eq', type: 'equity', quantity: 10, currentPrice: 120, prevClose: 100 }),
      holding({ id: 'mf', type: 'mf', quantity: 20, currentPrice: 50, prevClose: 55 }),
      holding({ id: 'etf', type: 'etf', quantity: 5, currentPrice: 200, prevClose: 190 }),
      holding({ id: 'other', type: 'other', quantity: 1, currentPrice: 10, prevClose: 5 }),
      holding({ id: 'no_prev', type: 'mf', quantity: 10, currentPrice: 120 }),
    ]);

    // Equity: 10 × (120−100) = 200, ETFs: 5 × (200−190) = 50
    expect(split.equity).toBe(250);
    // Mutual funds: 20 × (50−55) = −100
    expect(split.mf).toBe(-100);
    expect(split.other).toBe(5);
  });

  it('treats a holding without a usable prevClose as no day change', () => {
    expect(holdingDayChange({ quantity: 10, currentPrice: 120 })).toBe(0);
    expect(holdingDayChange({ quantity: 10, currentPrice: 120, prevClose: 0 })).toBe(0);
    expect(holdingDayChange({ quantity: 10, currentPrice: 120, prevClose: 100 })).toBe(200);
    expect(holdingDayChange({ quantity: NaN, currentPrice: 120, prevClose: 100 })).toBe(0);
  });

  it('ignores non-finite loan and FD amounts in the totals', () => {
    useInvestmentsStore.setState({
      loans: [
        { id: 'l1', name: 'Home loan', amount: 5000000 },
        { id: 'l2', name: 'Broken', amount: NaN },
      ],
      fds: [
        { id: 'f1', name: 'FD', amount: 1000000 },
        { id: 'f2', name: 'Broken', amount: NaN },
      ],
    });

    expect(useInvestmentsStore.getState().getTotalLoans()).toBe(5000000);
    expect(useInvestmentsStore.getState().getTotalFDs()).toBe(1000000);
  });

  it('computes net worth as holdings + FDs − loans', () => {
    useInvestmentsStore.setState({
      holdings: [holding({ id: 'ok', quantity: 10, currentPrice: 120 })],
      loans: [{ id: 'l1', name: 'Home loan', amount: 200000 }],
      fds: [{ id: 'f1', name: 'FD', amount: 500000 }],
    });

    expect(useInvestmentsStore.getState().getNetWorth()).toBe(1200 + 500000 - 200000);
  });
});
