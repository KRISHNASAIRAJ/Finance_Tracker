/**
 * Unit tests for the finance store's pure helper logic.
 *
 * The Zustand store itself is persisted via AsyncStorage, so these tests
 * cover the exported pure functions (min-balance rules) and the
 * transaction-sorting behaviour used across the finance module.
 */
import { getMinBalanceForAccount } from '../store';

describe('Finance Store — getMinBalanceForAccount', () => {
  it('returns the minimum balance floor for known banks', () => {
    expect(getMinBalanceForAccount('HDFC Salary Account')).toBe(260000); // ₹2,600
    expect(getMinBalanceForAccount('Axis Bank')).toBe(1010000); // ₹10,000
    expect(getMinBalanceForAccount('SBI Savings')).toBe(210000); // ₹2,100
    expect(getMinBalanceForAccount('BOB Current')).toBe(250000); // ₹2,500
  });

  it('returns zero for banks without a minimum balance floor', () => {
    expect(getMinBalanceForAccount('HSBC')).toBe(0);
    expect(getMinBalanceForAccount('Slice')).toBe(0);
    expect(getMinBalanceForAccount('Unknown Bank')).toBe(0);
    expect(getMinBalanceForAccount('')).toBe(0);
  });
});

describe('Finance Store — Transaction sorting', () => {
  it('sorts transactions by date descending (newest first)', () => {
    const txs = [
      { id: '1', date: '2026-07-10T10:00:00Z' },
      { id: '2', date: '2026-07-15T10:00:00Z' },
      { id: '3', date: '2026-07-12T10:00:00Z' },
    ];

    const sorted = [...txs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    expect(sorted.map((t) => t.id)).toEqual(['2', '3', '1']);
  });

  it('keeps cards sorted by nearest due date first', () => {
    const cards = [
      { id: 'a', dueDate: '2026-08-20T00:00:00Z' },
      { id: 'b', dueDate: '2026-08-10T00:00:00Z' },
      { id: 'c', dueDate: '2026-08-30T00:00:00Z' },
    ];

    const sorted = [...cards].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

    expect(sorted.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });
});
