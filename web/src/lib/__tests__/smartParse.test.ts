/**
 * Unit tests for the web natural-language transaction parser (smartParse).
 */
import { describe, expect, it } from 'vitest'
import { smartParse } from '../smartParse'

describe('smartParse — web natural language parsing', () => {
  it('parses a simple expense with amount and category', () => {
    const r = smartParse('lunch at starbucks 300')
    expect(r.amount).toBe(300)
    expect(r.type).toBe('expense')
    expect(r.category).toBe('Food & Dining')
    expect(r.notes).toContain('lunch')
  })

  it('parses currency-marked amounts with commas', () => {
    expect(smartParse('₹1,200 swiggy').amount).toBe(1200)
  })

  it('parses payment mode', () => {
    expect(smartParse('petrol 500 cash').paymentMode).toBe('cash')
    expect(smartParse('lunch 300 upi').paymentMode).toBe('upi')
    expect(smartParse('amazon 999 card').paymentMode).toBe('card')
  })

  it('detects income keywords', () => {
    const r = smartParse('salary 45000')
    expect(r.type).toBe('income')
    expect(r.amount).toBe(45000)
    expect(r.category).toBe('Salary')
  })

  it('detects a relative date hint', () => {
    const r = smartParse('rent 10400 yesterday')
    expect(r.amount).toBe(10400)
    expect(r.category).toBe('Rent')
    expect(r.date).not.toBeNull()
  })

  it('returns amount null for text without numbers', () => {
    expect(smartParse('coffee with friend').amount).toBeNull()
  })

  it('uses the last standalone number as the amount', () => {
    expect(smartParse('2x swiggy 600').amount).toBe(600)
  })
})
