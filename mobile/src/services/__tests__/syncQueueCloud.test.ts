/**
 * syncQueue — the cloud write path.
 *
 * Regression: an UPDATE that matches no row reports NO error in PostgREST, so
 * a card bill paid while the row was not in the cloud yet was silently lost —
 * the app then pulled the old cloud state back and the bill showed as due
 * again. The queue now falls back to an upsert when the update hit 0 rows.
 */
const mockUpdateRows: any[] = [];
const mockUpserts: Array<{ table: string; data: any }> = [];
const mockUpdateError: { error: any } = { error: null };

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    },
  };
});

jest.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
      refreshSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
    },
    from: (table: string) => ({
      update: (_fields: any) => ({
        eq: (_col: string, _val: any) => ({
          select: async () => ({ data: mockUpdateRows, error: mockUpdateError.error }),
        }),
      }),
      upsert: async (data: any) => {
        mockUpserts.push({ table, data });
        return { data, error: null };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
      insert: async (data: any) => ({ data, error: null }),
    }),
  },
}));

import { enqueue, clearQueue, processSyncQueue } from '../syncQueue';

describe('syncQueue cloud writes', () => {
  beforeEach(async () => {
    await clearQueue();
    mockUpdateRows.length = 0;
    mockUpserts.length = 0;
    mockUpdateError.error = null;
  });

  it('falls back to an upsert when the update matched no row', async () => {
    // The cloud does not know this card yet → the update returns 0 rows.
    mockUpdateRows.length = 0;

    await enqueue('credit_cards', 'update', {
      id: 'card-1',
      name: 'SBI Cashback',
      network: 'VISA',
      ending_with: '1234',
      billing_day: 2,
      due_date: '2026-12-02T00:00:00.000Z',
      balance: 0,
      bill_amount: 0,
      paid_amount: 0,
    });

    const result = await processSyncQueue(true);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    // The row is created instead of being lost.
    expect(mockUpserts).toHaveLength(1);
    expect(mockUpserts[0].table).toBe('credit_cards');
    expect(mockUpserts[0].data.id).toBe('card-1');
    expect(mockUpserts[0].data.bill_amount).toBe(0);
    expect(mockUpserts[0].data.paid_amount).toBe(0);
  });

  it('does not upsert when the update did hit a row', async () => {
    mockUpdateRows.push({ id: 'card-2' });

    await enqueue('credit_cards', 'update', { id: 'card-2', balance: 0 });

    const result = await processSyncQueue(true);
    expect(result.succeeded).toBe(1);
    expect(mockUpserts).toHaveLength(0);
  });

  it('keeps the item queued when the write fails', async () => {
    mockUpdateError.error = { message: 'boom' };

    await enqueue('credit_cards', 'update', { id: 'card-3', balance: 0 });

    const result = await processSyncQueue(true);
    expect(result.failed).toBe(1);
    // The item stays in the queue (never dropped) so the local edit is not
    // lost — the pending id also protects the local row from a cloud pull.
    const { getQueue } = require('../syncQueue');
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].entity).toBe('credit_cards');
  });
});
