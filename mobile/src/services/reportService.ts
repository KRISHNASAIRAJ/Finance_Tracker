/**
 * reportService — Generates and shares monthly finance reports as PDF via expo-print.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useFinanceStore } from '../modules/finance/store';

function formatCurrency(paise: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);
}

function getCardTransactions(cardName: string, transactions: any[]): { count: number; total: number } {
  const cardTxs = transactions.filter((t: any) =>
    t.type === 'expense' && t.notes?.toLowerCase().includes(cardName.toLowerCase())
  );
  return { count: cardTxs.length, total: cardTxs.reduce((s: number, t: any) => s + t.amount, 0) };
}

export async function generateMonthlyReport(userName?: string): Promise<string | null> {
  const financeStore = useFinanceStore.getState();

  const now = new Date();
  const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthExpenses = financeStore.transactions.filter((t: any) => {
    if (t.type !== 'expense' && t.type !== 'fuel_purchase' && t.type !== 'vehicle_service') return false;
    if (t.type === 'fixed_expense') return false;
    return new Date(t.date) >= startOfMonth;
  });

  const categoryTotals: Record<string, number> = {};
  monthExpenses.forEach((t: any) => {
    const cat = t.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
  });

  const totalSpend = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  const cards = financeStore.cards || [];
  const cardUsage = cards.map((c: any) => {
    const usage = getCardTransactions(c.name, financeStore.transactions);
    return {
      name: c.name,
      endingWith: c.endingWith,
      billAmount: c.billAmount ?? c.balance,
      paidAmount: c.paidAmount ?? 0,
      transactionCount: usage.count,
      transactionTotal: usage.total,
    };
  });

  const receivables = financeStore.receivables || [];
  const totalLent = receivables.filter((r: any) => r.type === 'lent').reduce((s: number, r: any) => s + r.amount, 0);
  const totalBorrowed = receivables.filter((r: any) => r.type === 'borrowed').reduce((s: number, r: any) => s + r.amount, 0);

  const fuelExpense = monthExpenses.filter((t: any) => t.type === 'fuel_purchase').reduce((s: number, t: any) => s + t.amount, 0);

  const categoryRows = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amount]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #333">${cat}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333;text-align:right">${formatCurrency(amount)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333;text-align:right">${totalSpend > 0 ? ((amount / totalSpend) * 100).toFixed(1) : 0}%</td>
      </tr>
    `).join('');

  const cardRows = cardUsage.map((c: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #333">${c.name} (•• ${c.endingWith})</td>
      <td style="padding:8px 12px;border-bottom:1px solid #333;text-align:right">${formatCurrency(c.billAmount)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #333;text-align:right">${formatCurrency(c.paidAmount)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #333;text-align:right">${c.transactionCount}</td>
    </tr>
  `).join('');

  const lentRows = receivables
    .filter((r: any) => r.status !== 'paid')
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .map((r: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #333">${r.type === 'lent' ? 'Lent to' : 'Borrowed from'} ${r.personName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333;text-align:right;color:${r.type === 'lent' ? '#22c55e' : '#ef4444'}">${r.type === 'lent' ? '+' : '-'}${formatCurrency(r.amount)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333;text-align:right">${new Date(r.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
      </tr>
    `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, sans-serif; background: #121212; color: #fff; padding: 24px; margin: 0; }
    h1 { font-size: 24px; margin-bottom: 4px; color: #22c55e; }
    h2 { font-size: 18px; border-bottom: 2px solid #22c55e; padding-bottom: 8px; margin-top: 28px; }
    h3 { font-size: 14px; color: #a0a0a0; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { text-align: left; padding: 8px 12px; color: #a0a0a0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .total-row { font-weight: bold; border-top: 2px solid #444; }
    .footer { text-align: center; margin-top: 40px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Meridian Report</h1>
  <h3>${monthName}${userName ? ` · ${userName}` : ''}</h3>

  <h2>EXPENSE BREAKDOWN</h2>
  <table>
    <thead>
      <tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Share</th></tr>
    </thead>
    <tbody>
      ${categoryRows}
      <tr class="total-row">
        <td style="padding:8px 12px">TOTAL</td>
        <td style="padding:8px 12px;text-align:right">${formatCurrency(totalSpend)}</td>
        <td style="padding:8px 12px;text-align:right">100%</td>
      </tr>
    </tbody>
  </table>

  <h2>CREDIT CARD SUMMARY</h2>
  <table>
    <thead>
      <tr><th>Card</th><th style="text-align:right">Bill</th><th style="text-align:right">Paid</th><th style="text-align:right">Txns</th></tr>
    </thead>
    <tbody>
      ${cardRows || '<tr><td colspan="4" style="padding:12px;color:#666">No cards added</td></tr>'}
    </tbody>
  </table>

  <h2>LENT / BORROWED (PENDING)</h2>
  <table>
    <thead>
      <tr><th>Person</th><th style="text-align:right">Amount</th><th style="text-align:right">Due</th></tr>
    </thead>
    <tbody>
      ${lentRows || '<tr><td colspan="3" style="padding:12px;color:#666">No pending records</td></tr>'}
      <tr class="total-row">
        <td style="padding:8px 12px">Net</td>
        <td style="padding:8px 12px;text-align:right;color:${totalLent > totalBorrowed ? '#22c55e' : '#ef4444'}">
          ${totalLent > totalBorrowed ? '+' : ''}${formatCurrency(totalLent - totalBorrowed)}
        </td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <h2>QUICK SUMMARY</h2>
  <table>
    <tr><td style="padding:6px 12px">Total Spent</td><td style="padding:6px 12px;text-align:right;color:#ef4444">${formatCurrency(totalSpend)}</td></tr>
    <tr><td style="padding:6px 12px">Fuel</td><td style="padding:6px 12px;text-align:right">${formatCurrency(fuelExpense)}</td></tr>
    <tr><td style="padding:6px 12px">Total Lent</td><td style="padding:6px 12px;text-align:right;color:#22c55e">${formatCurrency(totalLent)}</td></tr>
    <tr><td style="padding:6px 12px">Total Borrowed</td><td style="padding:6px 12px;text-align:right;color:#ef4444">${formatCurrency(totalBorrowed)}</td></tr>
    <tr><td style="padding:6px 12px">Most Used Card</td><td style="padding:6px 12px;text-align:right">${cardUsage.sort((a: any, b: any) => b.transactionCount - a.transactionCount)[0]?.name || 'N/A'}</td></tr>
  </table>

  <div class="footer">Generated by Meridian on ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
</body>
</html>`;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Monthly Report' });
    }
    return uri;
  } catch (e) {
    console.warn('[ReportService] PDF generation failed:', e);
    return null;
  }
}
