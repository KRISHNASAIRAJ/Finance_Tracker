/**
 * notificationDedup — the helpers that stop the "7:29 + 7:30" double-pop.
 *
 * scheduleAllReminders rebuilds every scheduled notification on app open. If
 * it cancels an alarm that is already about to fire, Android/OxygenOS can
 * still deliver it, while the freshly armed copy fires a minute later. The
 * helpers below identify those imminent alarms so they are left untouched.
 */
import { isImminentScheduledNotification, istDayKey, scheduledTriggerTime } from '../notificationService';

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
