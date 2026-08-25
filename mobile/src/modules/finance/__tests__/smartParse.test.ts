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
