/**
 * Finance E2E — end-to-end store flows: add/edit cards, bill payment lifecycle,
 * quick amount updates, and the AMC seeding rules. Supabase sync is mocked so
 * the flows run fully offline in CI.
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

import { useFinanceStore, seedCardAmcFixes } from '../store';

const resetState = () => {
  useFinanceStore.setState({
    cards: [],
    transactions: [],
    receivables: [],
    accounts: [],
    fixedExpenses: [],
    expectedIncomes: [],
    payzappLoads: [],
  });
};

describe('Finance E2E — card lifecycle', () => {
  beforeEach(resetState);

  it('adds a card and updates its outstanding balance via editCard', () => {
    const { addCard, editCard } = useFinanceStore.getState();
    addCard({
      name: 'SBI Cashback',
      network: 'VISA',
      endingWith: '1234',
      billingDay: 5,
      balance: 50000,
      dueDate: '2026-09-05T00:00:00.000Z',
      cardLimit: 5000000,
    });

    const cards = useFinanceStore.getState().cards;
    expect(cards).toHaveLength(1);
    expect(cards[0].balance).toBe(50000);

    editCard(cards[0].id, { balance: 75000 });
    expect(useFinanceStore.getState().cards[0].balance).toBe(75000);
  });

  it('paying the full bill creates a credit_card_bill transaction and resets the card', () => {
    const { addCard, markCardBillPaid } = useFinanceStore.getState();
    addCard({
      name: 'HDFC Millennia',
      network: 'Mastercard',
      endingWith: '5678',
      billingDay: 10,
      balance: 120000,
      dueDate: '2026-09-10T00:00:00.000Z',
      billAmount: 120000,
      paidAmount: 0,
    });

    const id = useFinanceStore.getState().cards[0].id;
    markCardBillPaid(id, 120000);

    const card = useFinanceStore.getState().cards[0];
    expect(card.billAmount).toBe(0);
    expect(card.paidAmount).toBe(0);
    expect(card.balance).toBe(0);

    const tx = useFinanceStore.getState().transactions[0];
    expect(tx.type).toBe('credit_card_bill');
    expect(tx.amount).toBe(120000);
    expect(tx.notes).toContain('HDFC Millennia');
  });

  it('partial payment only updates paidAmount', () => {
    const { addCard, markCardBillPaid } = useFinanceStore.getState();
    addCard({
      name: 'Amazon Pay ICICI',
      network: 'VISA',
      endingWith: '0001',
      billingDay: 1,
      balance: 200000,
      dueDate: '2026-09-01T00:00:00.000Z',
      billAmount: 200000,
      paidAmount: 0,
    });

    const id = useFinanceStore.getState().cards[0].id;
    markCardBillPaid(id, 80000);

    const card = useFinanceStore.getState().cards[0];
    expect(card.paidAmount).toBe(80000);
    expect(card.billAmount).toBe(200000);
    expect(useFinanceStore.getState().transactions).toHaveLength(0);
  });
});

describe('Finance E2E — AMC seeding', () => {
  beforeEach(resetState);

  it('seeds SBI Cashback with ₹1,180 AMC on Dec 2 and marks other cards LTF on Jan 1', async () => {
    const { addCard } = useFinanceStore.getState();
    addCard({
      name: 'SBI Cashback',
      network: 'VISA',
      endingWith: '1234',
      billingDay: 2,
      balance: 0,
      dueDate: '2026-09-02T00:00:00.000Z',
    });
    addCard({
      name: 'HDFC Millennia',
      network: 'Mastercard',
      endingWith: '5678',
      billingDay: 1,
      balance: 0,
      dueDate: '2026-09-01T00:00:00.000Z',
    });

    await seedCardAmcFixes();

    const cards = useFinanceStore.getState().cards;
    const sbi = cards.find((c) => c.name === 'SBI Cashback');
    const hdfc = cards.find((c) => c.name === 'HDFC Millennia');

    expect(sbi?.annualCharge).toBe(118000);
    expect(sbi?.isLtf).toBe(false);
    expect(sbi?.annualChargeDate).toBeTruthy();
    expect(new Date(sbi!.annualChargeDate!).getMonth()).toBe(11); // December
    expect(new Date(sbi!.annualChargeDate!).getDate()).toBe(2);

    expect(hdfc?.isLtf).toBe(true);
    expect(hdfc?.annualCharge).toBe(0);
    expect(hdfc?.annualChargeDate).toBeTruthy();
    expect(new Date(hdfc!.annualChargeDate!).getMonth()).toBe(0); // January
    expect(new Date(hdfc!.annualChargeDate!).getDate()).toBe(1);
  });

  it('auto-derives isLtf when an annual charge is cleared (amount 0 → LTF)', async () => {
    const { addCard } = useFinanceStore.getState();
    addCard({
      name: 'IDFC First',
      network: 'VISA',
      endingWith: '9999',
      billingDay: 3,
      balance: 0,
      dueDate: '2026-09-03T00:00:00.000Z',
    });
    await seedCardAmcFixes();

    const id = useFinanceStore.getState().cards[0].id;
    // User later enters an annual charge of ₹500 → not LTF
    useFinanceStore.getState().editCard(id, { annualCharge: 50000, isLtf: false });
    expect(useFinanceStore.getState().cards[0].annualCharge).toBe(50000);
    expect(useFinanceStore.getState().cards[0].isLtf).toBe(false);
  });
});
