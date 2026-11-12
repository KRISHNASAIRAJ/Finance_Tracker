/**
 * The credit card billing cycle — the due-date roll.
 *
 * Regression: the roll used `new Date(year, month, 31)`, which JavaScript
 * rolls over to the 3rd of March — a card with a 31st billing day skipped a
 * month. The roll is now clamped to the last day of the month.
 */
import { nextCardDueDate } from '../store';

describe('nextCardDueDate', () => {
  it('rolls to the next occurrence of the billing day', () => {
    const due = nextCardDueDate(20, new Date('2026-11-10T09:30:00'));
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(10); // November
    expect(due.getDate()).toBe(20);
    expect(due.getHours()).toBe(0);
  });

  it('rolls to the next month when the billing day already passed', () => {
    const due = nextCardDueDate(5, new Date('2026-11-10T09:30:00'));
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(11); // December
    expect(due.getDate()).toBe(5);
  });

  it('rolls to the next month when the billing day is today', () => {
    const due = nextCardDueDate(10, new Date('2026-11-10T00:00:00'));
    expect(due.getMonth()).toBe(11);
    expect(due.getDate()).toBe(10);
  });

  it('clamps a 31st billing day to the last day of a short month', () => {
    // The 31st of January has passed → February has no 31st, so it is the
    // 28th (never the 3rd of March).
    const due = nextCardDueDate(31, new Date('2027-01-31T12:00:00'));
    expect(due.getFullYear()).toBe(2027);
    expect(due.getMonth()).toBe(1); // February
    expect(due.getDate()).toBe(28);
  });

  it('keeps a 31st billing day in a month that has one', () => {
    const due = nextCardDueDate(31, new Date('2026-12-05T09:30:00'));
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(11); // December
    expect(due.getDate()).toBe(31);
  });

  it('clamps a 31st billing day to the last day of a 30 day month', () => {
    const due = nextCardDueDate(31, new Date('2026-11-05T09:30:00'));
    expect(due.getMonth()).toBe(10); // November
    expect(due.getDate()).toBe(30);
  });
});
