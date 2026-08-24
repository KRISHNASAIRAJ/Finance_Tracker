import { describe, expect, it } from 'vitest'
import { paiseToRupees, paiseToRupeesCompact, paiseToRupeesDetailed, rupeesToPaise } from '../format'
import { istWeekNumber, istWeekYear } from '../istDate'

describe('format helpers', () => {
  it('formats paise to rupees', () => {
    expect(paiseToRupees(123456)).toBe('₹1,235')
    expect(paiseToRupees(0)).toBe('₹0')
    expect(paiseToRupees(9999)).toBe('₹100')
  })

  it('formats detailed paise', () => {
    expect(paiseToRupeesDetailed(123456)).toBe('₹1,234.56')
  })

  it('formats compact lakh/crore', () => {
    expect(paiseToRupeesCompact(12500000)).toBe('₹1.25L')
    expect(paiseToRupeesCompact(450000000)).toBe('₹45.00L')
    expect(paiseToRupeesCompact(4500000000)).toBe('₹4.50Cr')
  })

  it('converts rupees input to paise', () => {
    expect(rupeesToPaise('1234.5')).toBe(123450)
    expect(rupeesToPaise('0')).toBe(0)
  })
})

describe('ist date helpers', () => {
  it('computes week number and year', () => {
    const d = new Date('2026-08-24T12:00:00Z')
    const week = istWeekNumber(d)
    expect(week).toBeGreaterThanOrEqual(1)
    expect(week).toBeLessThanOrEqual(53)
    expect(istWeekYear(d)).toBe(2026)
  })
})
