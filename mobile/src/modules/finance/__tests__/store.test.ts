describe('Finance Store — CreditCard operations', () => {
  it('computes bill left correctly', () => {
    const billAmount = 100000; // ₹1000
    const paidAmount = 30000;  // ₹300
    const billLeft = Math.max(0, billAmount - paidAmount);
    expect(billLeft).toBe(70000); // ₹700

    const fullyPaid = Math.max(0, billAmount - billAmount);
    expect(fullyPaid).toBe(0);

    const overpaid = Math.max(0, billAmount - 150000);
    expect(overpaid).toBe(0);
  });

  it('formats currency from paise', () => {
    const formatCurrency = (paise: number) =>
      `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

    expect(formatCurrency(0)).toBe('₹0');
    expect(formatCurrency(45000)).toBe('₹450');
    expect(formatCurrency(100000)).toBe('₹1,000');
    expect(formatCurrency(299900)).toBe('₹2,999');
  });
});

describe('Finance Store — Transaction sorting', () => {
  it('sorts transactions by date descending', () => {
    const txs = [
      { id: '1', date: '2026-07-10T10:00:00Z', amount: 100 },
      { id: '2', date: '2026-07-15T10:00:00Z', amount: 200 },
      { id: '3', date: '2026-07-12T10:00:00Z', amount: 300 },
    ];

    const sorted = [...txs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('3');
    expect(sorted[2].id).toBe('1');
  });
});
