/**
 * notificationDedup — the helpers that stop the "7:29 + 7:30" double-pop.
 *
 * scheduleAllReminders rebuilds every scheduled notification on app open. If
 * it cancels an alarm that is already about to fire, Android/OxygenOS can
 * still deliver it, while the freshly armed copy fires a minute later. The
 * helpers below identify those imminent alarms so they are left untouched.
 */
import {
  isImminentScheduledNotification, istDayKey, planOverdueReminders,
  receivableOutstanding, scheduledTriggerTime,
} from '../notificationService';

const NOW = new Date('2026-11-23T02:00:00.000Z').getTime(); // 07:30 IST

describe('scheduledTriggerTime', () => {
  it('reads a DATE trigger whose date is a Date', () => {
    expect(scheduledTriggerTime({ trigger: { type: 'date', date: new Date(NOW + 1000) } })).toBe(NOW + 1000);
  });

  it('reads a DATE trigger whose date is an ISO string or epoch number', () => {
    expect(scheduledTriggerTime({ trigger: { type: 'date', date: new Date(NOW).toISOString() } })).toBe(NOW);
    expect(scheduledTriggerTime({ trigger: { type: 'date', date: NOW } })).toBe(NOW);
  });

  it('returns null for relative / immediate triggers and malformed dates', () => {
    expect(scheduledTriggerTime({ trigger: { type: 'timeInterval', seconds: 60 } })).toBeNull();
    expect(scheduledTriggerTime({ trigger: null })).toBeNull();
    expect(scheduledTriggerTime({ trigger: { type: 'date', date: 'not-a-date' } })).toBeNull();
    expect(scheduledTriggerTime(undefined)).toBeNull();
  });
});

describe('isImminentScheduledNotification', () => {
  it('protects a notification due in under two minutes', () => {
    const n = { trigger: { type: 'date', date: new Date(NOW + 60_000) } };
    expect(isImminentScheduledNotification(n, NOW)).toBe(true);
  });

  it('also protects one that is technically already past due', () => {
    const n = { trigger: { type: 'date', date: new Date(NOW - 5_000) } };
    expect(isImminentScheduledNotification(n, NOW)).toBe(true);
  });

  it('does not protect a notification further out', () => {
    const n = { trigger: { type: 'date', date: new Date(NOW + 2 * 60_000 + 1000) } };
    expect(isImminentScheduledNotification(n, NOW)).toBe(false);
  });

  it('does not protect non-date triggers', () => {
    expect(isImminentScheduledNotification({ trigger: { type: 'timeInterval', seconds: 30 } }, NOW)).toBe(false);
  });
});

describe('istDayKey', () => {
  it('uses the IST calendar day even near the UTC midnight boundary', () => {
    // 01:30 UTC = 07:00 IST on 23 Nov — the UTC day is still 23 here.
    expect(istDayKey(new Date('2026-11-23T01:30:00.000Z'))).toBe('2026-11-23');
    // 18:30 UTC = 00:00 IST on 24 Nov — UTC day is 23 but IST day is 24.
    expect(istDayKey(new Date('2026-11-23T18:30:00.000Z'))).toBe('2026-11-24');
  });
});

describe('overdue receivable reminders', () => {
  const NOW = new Date('2026-11-26T04:00:00.000Z'); // 09:30 IST
  const debt = {
    id: 'r1', personName: 'SHARAN', amount: 1592085, paidAmount: 0,
    dueDate: '2026-11-25T00:00:00.000Z', type: 'lent' as const, status: 'pending',
  };

  it('arms one 10 AM nudge per day for at most three days', () => {
    const plans = planOverdueReminders(debt, NOW);
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.key)).toEqual([
      'recv_r1_od_2026-11-27_am',
      'recv_r1_od_2026-11-28_am',
      'recv_r1_od_2026-11-29_am',
    ]);
    expect(plans.every((p) => p.at.getHours() === 10)).toBe(true);
  });

  it('quotes only the amount still outstanding after a partial collection', () => {
    expect(receivableOutstanding({ amount: 1592085, paidAmount: 592085 })).toBe(1000000);
    const plan = planOverdueReminders({ ...debt, paidAmount: 592085 }, NOW)[0];
    expect(plan.body).toContain('₹10,000');
    expect(plan.body).not.toContain('₹15,920.85');
  });

  it('arms nothing once the debt is paid or not yet due', () => {
    expect(planOverdueReminders({ ...debt, status: 'paid' }, NOW)).toEqual([]);
    expect(planOverdueReminders({ ...debt, paidAmount: debt.amount }, NOW)).toEqual([]);
    expect(planOverdueReminders({ ...debt, dueDate: '2026-12-01T00:00:00.000Z' }, NOW)).toEqual([]);
  });
});
