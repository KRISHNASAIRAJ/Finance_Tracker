/**
 * peopleCadence — the "keep in touch" interval maths.
 */
import {
  addDays,
  addInterval,
  addMonth,
  cadenceLabel,
  daysUntilDue,
  dueLabel,
  intervalDays,
  isDue,
  isOverdue,
  nextDueFrom,
} from '../peopleCadence';

describe('intervalDays', () => {
  it('maps the cadence to its length', () => {
    expect(intervalDays('weekly')).toBe(7);
    expect(intervalDays('days_45')).toBe(45);
    expect(intervalDays('monthly')).toBe(30);
    expect(intervalDays('custom', 21)).toBe(21);
  });

  it('never lets a custom interval fall below one day', () => {
    expect(intervalDays('custom', 0)).toBe(1);
    expect(intervalDays('custom', -5)).toBe(1);
    expect(intervalDays('custom', undefined)).toBe(1);
  });
});

describe('cadenceLabel', () => {
  it('labels every cadence', () => {
    expect(cadenceLabel('weekly')).toBe('Weekly');
    expect(cadenceLabel('monthly')).toBe('Monthly');
    expect(cadenceLabel('days_45')).toBe('Every 45 days');
    expect(cadenceLabel('custom', 21)).toBe('Every 21 days');
  });
});

describe('addMonth', () => {
  it('clamps to the last day of a short month', () => {
    const due = addMonth(new Date(2026, 0, 31, 10, 0, 0));
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(1); // February
    expect(due.getDate()).toBe(28);
  });

  it('rolls over the year', () => {
    const due = addMonth(new Date(2026, 11, 15, 10, 0, 0));
    expect(due.getFullYear()).toBe(2027);
    expect(due.getMonth()).toBe(0); // January
    expect(due.getDate()).toBe(15);
  });

  it('keeps the time of day', () => {
    const due = addMonth(new Date(2026, 5, 10, 21, 30, 0));
    expect(due.getHours()).toBe(21);
    expect(due.getMinutes()).toBe(30);
  });
});

describe('addDays', () => {
  it('adds the days', () => {
    const due = addDays(new Date(2026, 10, 1, 9, 0, 0), 45);
    expect(due.getMonth()).toBe(11);
    expect(due.getDate()).toBe(16);
  });
});

describe('nextDueFrom', () => {
  it('adds the interval to the last contact', () => {
    const last = new Date(2026, 10, 1, 9, 0, 0);
    expect(nextDueFrom(last, 'weekly').getTime()).toBe(addDays(last, 7).getTime());
    expect(nextDueFrom(last, 'days_45').getTime()).toBe(addDays(last, 45).getTime());
    expect(nextDueFrom(last, 'monthly').getTime()).toBe(addMonth(last).getTime());
    expect(nextDueFrom(last, 'custom', 21).getTime()).toBe(addDays(last, 21).getTime());
  });

  it('makes a person who was never contacted due after ONE full interval', () => {
    const now = new Date(2026, 10, 1, 9, 0, 0);
    expect(nextDueFrom(null, 'weekly', undefined, now).getTime()).toBe(addDays(now, 7).getTime());
    expect(nextDueFrom(null, 'monthly', undefined, now).getTime()).toBe(addMonth(now).getTime());
    expect(nextDueFrom(undefined, 'days_45', undefined, now).getTime()).toBe(addDays(now, 45).getTime());
  });
});

describe('daysUntilDue / isDue / isOverdue', () => {
  const now = new Date(2026, 10, 1, 9, 0, 0);

  it('counts the days until the due date', () => {
    // Later today is still "today".
    expect(daysUntilDue(new Date(2026, 10, 1, 23, 0, 0), now)).toBe(0);
    expect(daysUntilDue(new Date(2026, 10, 2, 9, 0, 0), now)).toBe(1);
    expect(daysUntilDue(new Date(2026, 10, 4, 9, 0, 0), now)).toBe(3);
    expect(daysUntilDue(new Date(2026, 9, 29, 9, 0, 0), now)).toBe(-3);
  });

  it('knows what is due and what is overdue', () => {
    expect(isDue(new Date(2026, 10, 1, 23, 0, 0), now)).toBe(true);
    expect(isDue(new Date(2026, 10, 4, 9, 0, 0), now)).toBe(false);
    expect(isOverdue(new Date(2026, 9, 28, 9, 0, 0), now)).toBe(true);
    expect(isOverdue(new Date(2026, 10, 1, 23, 0, 0), now)).toBe(false);
  });
});

describe('dueLabel', () => {
  const now = new Date(2026, 10, 1, 9, 0, 0);

  it('reads like a human', () => {
    expect(dueLabel(new Date(2026, 10, 1, 23, 0, 0), now)).toBe('Due today');
    expect(dueLabel(new Date(2026, 10, 2, 9, 0, 0), now)).toBe('Due tomorrow');
    expect(dueLabel(new Date(2026, 10, 4, 9, 0, 0), now)).toBe('in 3 days');
    expect(dueLabel(new Date(2026, 9, 30, 9, 0, 0), now)).toBe('2 days ago');
    expect(dueLabel(new Date(2026, 9, 31, 9, 0, 0), now)).toBe('1 day ago');
  });
});

describe('addInterval', () => {
  it('uses the calendar for monthly and the days for the rest', () => {
    const from = new Date(2026, 0, 31, 8, 0, 0);
    expect(addInterval(from, 'monthly').getDate()).toBe(28);
    expect(addInterval(from, 'weekly').getDate()).toBe(7);
  });
});
