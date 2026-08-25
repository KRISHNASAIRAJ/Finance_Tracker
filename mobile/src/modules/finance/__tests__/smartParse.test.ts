/**
 * Unit tests for the natural-language transaction parser (smartParse).
 * Windfall-style: "lunch at starbucks 300 upi" → amount, category, mode, notes.
 */
import { smartParse } from '../smartParse';

describe('smartParse — natural language transaction parsing', () => {
  it('parses a simple expense with amount', () => {
    const r = smartParse('lunch at starbucks 300');
    expect(r.amount).toBe(300);
    expect(r.type).toBe('expense');
    expect(r.category).toBe('Food & Dining');
    expect(r.notes).toContain('lunch');
  });

  it('parses currency-marked amounts with commas', () => {
    const r = smartParse('₹1,200 swiggy');
    expect(r.amount).toBe(1200);
    expect(r.category).toBe('Food & Dining');
  });

  it('parses payment mode', () => {
    expect(smartParse('petrol 500 cash').paymentMode).toBe('cash');
    expect(smartParse('lunch 300 upi').paymentMode).toBe('upi');
    expect(smartParse('amazon 999 card').paymentMode).toBe('card');
    expect(smartParse('gpay to friend 200').paymentMode).toBe('upi');
  });

  it('detects income keywords', () => {
    const r = smartParse('salary 45000');
    expect(r.type).toBe('income');
    expect(r.amount).toBe(45000);
    expect(r.category).toBe('Salary');
  });

  it('detects a relative date hint', () => {
    const r = smartParse('rent 10400 yesterday');
    expect(r.amount).toBe(10400);
    expect(r.category).toBe('Rent');
    expect(r.date).not.toBeNull();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(r.date!.toDateString()).toBe(yesterday.toDateString());
  });

  it('returns amount null for text without numbers', () => {
    const r = smartParse('coffee with friend');
    expect(r.amount).toBeNull();
  });

  it('uses the last standalone number as the amount', () => {
    const r = smartParse('2x swiggy 600');
    expect(r.amount).toBe(600);
  });

  it('returns empty notes for empty input', () => {
    const r = smartParse('');
    expect(r.amount).toBeNull();
    expect(r.notes).toBe('');
  });
});

describe('smartParse — bank SMS formats (issue #9)', () => {
  it('parses a UPI debit SMS', () => {
    const r = smartParse('Rs.5000 debited from HDFC Bank A/c XX1234 on 12-Mar-25 via UPI. Available bal: Rs.25000');
    expect(r.amount).toBe(5000);
    expect(r.type).toBe('expense');
    expect(r.paymentMode).toBe('upi');
    expect(r.date).not.toBeNull();
    expect(r.date!.getMonth()).toBe(2); // March
    expect(r.date!.getDate()).toBe(12);
  });

  it('parses a UPI credit SMS as income', () => {
    const r = smartParse('Rs.10000 credited to HDFC Bank A/c XX1234 on 12/03/25. Ref no. 847201');
    expect(r.amount).toBe(10000);
    expect(r.type).toBe('income');
    expect(r.date).not.toBeNull();
    expect(r.date!.getDate()).toBe(12);
  });

  it('parses a card swipe SMS with merchant', () => {
    const r = smartParse('Your card XX1234 used at SWIGGY for INR 345.00 on 12-Mar-25. Avl limit Rs.50000');
    expect(r.amount).toBe(345);
    expect(r.type).toBe('expense');
    expect(r.paymentMode).toBe('card');
    expect(r.category).toBe('Food & Dining');
    expect(r.notes).toContain('SWIGGY');
  });

  it('parses a card payment to a merchant', () => {
    const r = smartParse('INR 1200.00 spent on your card XX1234 at STARBUCKS COFFEE on 15 Mar 25');
    expect(r.amount).toBe(1200);
    expect(r.paymentMode).toBe('card');
    expect(r.notes).toContain('STARBUCKS');
    expect(r.category).toBe('Food & Dining');
  });

  it('parses salary credit SMS', () => {
    const r = smartParse('Salary of Rs.45000 credited to your account on 01-Mar-25');
    expect(r.amount).toBe(45000);
    expect(r.type).toBe('income');
    expect(r.category).toBe('Salary');
  });

  it('ignores the available-balance amount after the txn amount', () => {
    const r = smartParse('Rs.3000 debited from A/c XX1234 on 12-Mar-25 via UPI. Available bal: Rs.25000');
    expect(r.amount).toBe(3000);
    expect(r.notes).not.toMatch(/25000|balance/i);
  });
});
