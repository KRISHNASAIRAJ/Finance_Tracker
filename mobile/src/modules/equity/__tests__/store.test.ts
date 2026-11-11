/**
 * Equity store tests — loan ± adjust math and the NaN guards that keep a
 * malformed row from poisoning the portfolio dashboard.
 */
jest.mock('../../../services/syncQueue', () => ({
  enqueue: jest.fn(async () => {}),
  processSyncQueue: jest.fn(async () => {}),
  getQueueLength: jest.fn(() => 0),
}));

import { useInvestmentsStore, type Holding } from '../store';

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
