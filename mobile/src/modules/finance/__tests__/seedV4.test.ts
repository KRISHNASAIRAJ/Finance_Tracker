/**
 * Fixed-expense seed v4 + the scheduled 2027-01-01 amount changes.
 * The cloud pull/sync queue is mocked so the flows run fully offline.
 */
jest.mock('../../../services/supabaseClient', () => {
  const chainable = (): any => {
    const fn: any = async () => ({ data: [], error: null });
    fn.then = (cb: any) => Promise.resolve({ data: [], error: null }).then(cb);
    fn.finally = (cb: any) => Promise.resolve({ data: [], error: null }).finally(cb);
    [
      'select', 'order', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'or',
      'ilike', 'like', 'match', 'insert', 'upsert', 'update', 'delete',
      'single', 'maybeSingle', 'limit', 'returns', 'textSearch', 'not', 'is',
    ].forEach((m) => { fn[m] = chainable; });
    return fn;
  };
  return {
    supabase: {
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
      from: jest.fn(() => chainable()),
      channel: jest.fn(() => ({
        on: jest.fn(() => ({ subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })) })),
      })),
    },
  };
});

jest.mock('../../../services/syncQueue', () => ({
  enqueue: jest.fn(async () => {}),
  processSyncQueue: jest.fn(async () => {}),
  getQueueLength: jest.fn(() => 0),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFinanceStore, seedFixedExpenseFixesV4, applyScheduledFixedExpenseChanges, type FixedExpense } from '../store';

const FIX_FLAG = 'meridian-fixed-expense-fixes-v4';
const SCHEDULE_FLAG = 'meridian-fixed-expense-schedule-v4';

const fx = (over: Partial<FixedExpense>): FixedExpense =>
  ({
    id: 'fx',
    name: 'Fixed',
    amount: 100000,
    billingDay: 1,
    category: 'Investments',
    lastPaidMonth: '',
    dueDate: new Date(2026, 11, 1).toISOString(),
    ...over,
  } as FixedExpense);

const seedRows = () =>
  useFinanceStore.setState({
    fixedExpenses: [
      fx({ id: 'fx_rent', name: 'Flat Rent', amount: 1040000, category: 'Rent' }),
      fx({ id: 'fx_mid', name: 'HDFC Mid Cap Opportunities', amount: 100000 }),
      fx({ id: 'fx_small', name: 'HDFC Small Cap Fund', amount: 100000 }),
      fx({ id: 'fx_emerg', name: 'Emergency Fund SIP', amount: 12000, billingDay: 31 }),
    ],
    cards: [],
    transactions: [],
    receivables: [],
    accounts: [],
    expectedIncomes: [],
    payzappLoads: [],
    categoryBudgets: [],
  });

const rows = () => useFinanceStore.getState().fixedExpenses;
const findByName = (needle: string) =>
  rows().find((f) => (f.name || '').toLowerCase().includes(needle));

describe('Fixed expense seed v4', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    seedRows();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-11T10:00:00+05:30'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retires the Emergency Fund SIP, adds Invesco ₹1,000 and Motilal ₹500, arms the 2027 schedule', async () => {
    await seedFixedExpenseFixesV4('u1');

    expect(findByName('emergency')).toBeUndefined();

    const invesco = findByName('invesco');
    expect(invesco?.amount).toBe(100000);
    expect(invesco?.billingDay).toBe(1);
    expect(invesco?.lastPaidMonth).toBe('2026-12');
    const due = new Date(invesco!.dueDate);
    expect(due.getFullYear()).toBe(2027);
    expect(due.getMonth()).toBe(0);
    expect(due.getDate()).toBe(1);

    expect(findByName('motilal')?.amount).toBe(50000);

    expect(await AsyncStorage.getItem(SCHEDULE_FLAG)).toBe('pending');
    expect(await AsyncStorage.getItem(FIX_FLAG)).toBe('done');
  });

  it('does not duplicate rows when it runs again', async () => {
    await seedFixedExpenseFixesV4('u1');
    await seedFixedExpenseFixesV4('u1');

    expect(rows().filter((f) => (f.name || '').toLowerCase().includes('invesco'))).toHaveLength(1);
    expect(rows().filter((f) => (f.name || '').toLowerCase().includes('motilal'))).toHaveLength(1);
    expect(rows().filter((f) => (f.name || '').toLowerCase().includes('emergency'))).toHaveLength(0);
  });
});

describe('Scheduled 2027-01-01 fixed-expense changes', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    seedRows();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing before the effective date', async () => {
    jest.setSystemTime(new Date('2026-11-11T10:00:00+05:30'));
    await AsyncStorage.setItem(SCHEDULE_FLAG, 'pending');

    await applyScheduledFixedExpenseChanges('u1');

    expect(findByName('mid cap')?.amount).toBe(100000);
    expect(findByName('small cap')?.amount).toBe(100000);
    expect(await AsyncStorage.getItem(SCHEDULE_FLAG)).toBe('pending');
  });

  it('applies mid/small cap ₹500 and Motilal ₹1,000 on the effective date', async () => {
    jest.setSystemTime(new Date('2026-11-11T10:00:00+05:30'));
    await seedFixedExpenseFixesV4('u1');
    expect(findByName('motilal')?.amount).toBe(50000);

    jest.setSystemTime(new Date('2027-01-05T10:00:00+05:30'));
    await applyScheduledFixedExpenseChanges('u1');

    expect(findByName('mid cap')?.amount).toBe(50000);
    expect(findByName('small cap')?.amount).toBe(50000);
    expect(findByName('motilal')?.amount).toBe(100000);
    expect(findByName('invesco')?.amount).toBe(100000);
    expect(await AsyncStorage.getItem(SCHEDULE_FLAG)).toBe('done');
  });

  it('bumps a pre-seeded Motilal row from ₹500 to ₹1,000', async () => {
    jest.setSystemTime(new Date('2027-01-05T10:00:00+05:30'));
    await AsyncStorage.setItem(SCHEDULE_FLAG, 'pending');
    useFinanceStore.setState({
      fixedExpenses: [
        ...rows(),
        fx({ id: 'fx_moti', name: 'Motilal Oswal Green', amount: 50000 }),
      ],
    });

    await applyScheduledFixedExpenseChanges('u1');

    expect(rows().find((f) => f.id === 'fx_moti')?.amount).toBe(100000);
  });

  it('is a no-op once the schedule flag is done', async () => {
    jest.setSystemTime(new Date('2027-01-05T10:00:00+05:30'));
    await AsyncStorage.setItem(SCHEDULE_FLAG, 'done');
    seedRows();

    await applyScheduledFixedExpenseChanges('u1');

    expect(findByName('mid cap')?.amount).toBe(100000);
  });
});
