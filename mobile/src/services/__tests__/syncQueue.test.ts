/**
 * Unit tests for syncQueue write serialization.
 * Regression: two enqueues issued in the same tick (fuel edit enqueues both
 * `fuel_fills` and the linked `transactions` row) used to race on the
 * read-modify-write of the persisted queue and silently lose one item.
 */
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

import { enqueue, getQueue, getPendingEntityIds, clearQueue } from '../syncQueue';

describe('syncQueue enqueue serialization', () => {
  beforeEach(async () => {
    await clearQueue();
  });

  it('keeps both items when two enqueues are issued in the same tick', async () => {
    const p1 = enqueue('fuel_fills', 'create', { id: 'fill-1' });
    const p2 = enqueue('transactions', 'update', { id: 'tx-1' });
    await Promise.all([p1, p2]);

    const queue = await getQueue();
    expect(queue).toHaveLength(2);
    expect(queue.map((i) => i.entity).sort()).toEqual(['fuel_fills', 'transactions']);
  });

  it('serializes a burst of enqueues without dropping any item', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      enqueue('fuel_fills', 'create', { id: `f-${i}` })
    );
    await Promise.all(tasks);

    const queue = await getQueue();
    expect(queue).toHaveLength(10);
    expect(new Set(queue.map((i) => i.data.id)).size).toBe(10);
  });

  it('getPendingEntityIds sees an enqueue that has not been awaited yet', async () => {
    const pending = enqueue('fuel_fills', 'create', { id: 'fill-2' });
    const ids = await getPendingEntityIds();
    expect(ids.has('fuel_fills|fill-2')).toBe(true);
    await pending;
  });
});
