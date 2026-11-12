/**
 * Credit card bill payment — the due-date roll.
 *
 * Regression: the web "Pay bill" only wrote `paid_amount` and
 * `current_outstanding`, so the card kept its old (past) due date and its old
 * bill amount. The mobile app then pulled that state and kept showing the
 * bill as due.
 */
import { describe, it, expect } from 'vitest'
import { nextCardDueDate } from '../cardBill'

describe('nextCardDueDate', () => {
  it('rolls to the next occurrence of the billing day', () => {
    // Paying on the 10th → the next 20th is still ahead.
    const due = nextCardDueDate(20, new Date('2026-11-10T09:30:00'))
    expect(due.getFullYear()).toBe(2026)
    expect(due.getMonth()).toBe(10) // November
    expect(due.getDate()).toBe(20)
    expect(due.getHours()).toBe(0)
  })

  it('rolls to the next month when the billing day already passed', () => {
    const due = nextCardDueDate(5, new Date('2026-11-10T09:30:00'))
    expect(due.getFullYear()).toBe(2026)
    expect(due.getMonth()).toBe(11) // December
    expect(due.getDate()).toBe(5)
  })

  it('rolls to the next month when the billing day is today', () => {
    const due = nextCardDueDate(10, new Date('2026-11-10T00:00:00'))
    expect(due.getMonth()).toBe(11)
    expect(due.getDate()).toBe(10)
  })

  it('clamps a 31st billing day to the last day of a short month', () => {
    // The 31st of January has passed → February has no 31st, so it is the 28th
    // (never the 3rd of March).
    const due = nextCardDueDate(31, new Date('2027-01-31T12:00:00'))
    expect(due.getFullYear()).toBe(2027)
    expect(due.getMonth()).toBe(1) // February
    expect(due.getDate()).toBe(28)
  })

  it('keeps a 31st billing day in a month that has one', () => {
    const due = nextCardDueDate(31, new Date('2026-12-05T09:30:00'))
    expect(due.getFullYear()).toBe(2026)
    expect(due.getMonth()).toBe(11) // December
    expect(due.getDate()).toBe(31)
  })

  it('clamps a 31st billing day to the last day of a 30 day month', () => {
    const due = nextCardDueDate(31, new Date('2026-11-05T09:30:00'))
    expect(due.getMonth()).toBe(10) // November
    expect(due.getDate()).toBe(30)
  })
})
