/**
 * Medication reminders — dose-time parsing, next-occurrence maths, skip
 * bookkeeping and the reminder scheduling rules.
 */
jest.mock('../../../services/syncQueue', () => ({
  enqueue: jest.fn(async () => {}),
  processSyncQueue: jest.fn(async () => {}),
  getQueueLength: jest.fn(() => 0),
}));

jest.mock('../../../services/notificationService', () => ({
  scheduleLocal: jest.fn(async () => {}),
  MEDICATION_CATEGORY: 'medication-reminder',
  MEDICATION_ACTION_SKIP: 'medication_skip',
  MEDICATION_ACTION_REMIND_30: 'medication_remind_30',
}));

import {
  useMedicationsStore,
  parseDoseTimes,
  timeToMinutes,
  nextDose,
  doseKey,
  medDayKey,
} from '../store';
import { scheduleMedicationReminders, handleMedicationAction } from '../../../services/medicationReminders';
import { scheduleLocal, MEDICATION_ACTION_SKIP, MEDICATION_ACTION_REMIND_30 } from '../../../services/notificationService';

const mockSchedule = scheduleLocal as jest.Mock;

describe('parseDoseTimes', () => {
  it('parses comma separated 24h times', () => {
    expect(parseDoseTimes('08:00, 20:00')).toEqual(['08:00', '20:00']);
  });

  it('normalises single digit hours and sorts them', () => {
    expect(parseDoseTimes('9:05, 6:30')).toEqual(['06:30', '09:05']);
  });

  it('drops invalid entries and duplicates', () => {
    expect(parseDoseTimes('08:00, 08:00, 25:00, 10:70, abc, 13:45')).toEqual(['08:00', '13:45']);
  });

  it('accepts an array input', () => {
    expect(parseDoseTimes(['07:15', '21:00'])).toEqual(['07:15', '21:00']);
  });
});

describe('timeToMinutes / nextDose', () => {
  it('converts HH:MM to minutes', () => {
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('24:00')).toBeNull();
    expect(timeToMinutes('nope')).toBeNull();
  });

  it('picks the next dose today when it is still ahead', () => {
    const now = new Date('2026-11-11T09:00:00');
    const next = nextDose(['08:00', '20:00'], now);
    expect(next?.time).toBe('20:00');
    expect(next?.at.getDate()).toBe(11);
  });

  it('rolls to tomorrow when the day is over', () => {
    const now = new Date('2026-11-11T21:00:00');
    const next = nextDose(['08:00', '20:00'], now);
    expect(next?.time).toBe('08:00');
    expect(next?.at.getDate()).toBe(12);
  });

  it('returns null without valid times', () => {
    expect(nextDose([], new Date())).toBeNull();
    expect(nextDose(['bad'], new Date())).toBeNull();
  });
});

describe('medication store — skips', () => {
  beforeEach(() => {
    useMedicationsStore.setState({ medications: [], skipped: {} });
    mockSchedule.mockClear();
  });

  it('remembers a skipped dose for that day only', () => {
    useMedicationsStore.getState().skipDose('m1', '2026-11-11', '08:00');
    expect(useMedicationsStore.getState().skipped[doseKey('m1', '2026-11-11', '08:00')]).toBeTruthy();

    useMedicationsStore.getState().clearSkips('2026-11-11');
    expect(useMedicationsStore.getState().skipped[doseKey('m1', '2026-11-11', '08:00')]).toBeUndefined();
  });

  it('builds a day-scoped dose key', () => {
    expect(doseKey('m1', '2026-11-11', '08:00')).toBe('m1|2026-11-11|08:00');
  });

  it('derives an IST day key', () => {
    expect(medDayKey(new Date('2026-11-11T20:00:00.000Z'))).toBe('2026-11-12');
  });
});

describe('medication reminders — scheduling', () => {
  beforeEach(() => {
    useMedicationsStore.setState({
      medications: [
        { id: 'm1', name: 'Metformin', dosage: '500 mg', times: ['08:00'], notes: '', active: true },
        { id: 'm2', name: 'Vitamin D', dosage: '', times: ['09:00'], notes: '', active: false },
      ],
      skipped: {},
    });
    mockSchedule.mockClear();
  });

  it('schedules only active medications', async () => {
    await scheduleMedicationReminders(new Date('2026-11-11T06:00:00'));
    const calls = mockSchedule.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const bodies = calls.map((c) => c[0]);
    expect(bodies).toContain('💊 Time for Metformin');
    expect(bodies.some((b: string) => b.includes('Vitamin D'))).toBe(false);
  });

  it('does not schedule a dose that was skipped', async () => {
    useMedicationsStore.getState().skipDose('m1', '2026-11-11', '08:00');
    await scheduleMedicationReminders(new Date('2026-11-11T06:00:00'));
    const today = mockSchedule.mock.calls.filter((c) => c[4]?.dateKey === '2026-11-11');
    expect(today).toHaveLength(0);
  });

  it('passes the medication category so the action buttons show', async () => {
    await scheduleMedicationReminders(new Date('2026-11-11T06:00:00'));
    const call = mockSchedule.mock.calls[0];
    expect(call[3]).toBe('medication-reminders');
    expect(call[5]).toBe('medication-reminder');
  });
});

describe('medication reminders — actions', () => {
  beforeEach(() => {
    useMedicationsStore.setState({
      medications: [
        { id: 'm1', name: 'Metformin', dosage: '500 mg', times: ['08:00'], notes: '', active: true },
      ],
      skipped: {},
    });
    mockSchedule.mockClear();
  });

  it('skip marks the dose as skipped for that day', async () => {
    const handled = await handleMedicationAction(MEDICATION_ACTION_SKIP, {
      medId: 'm1',
      dateKey: '2026-11-11',
      time: '08:00',
    });
    expect(handled).toBe(true);
    expect(useMedicationsStore.getState().skipped[doseKey('m1', '2026-11-11', '08:00')]).toBeTruthy();
  });

  it('remind in 30 min schedules the dose again', async () => {
    const before = Date.now();
    const handled = await handleMedicationAction(MEDICATION_ACTION_REMIND_30, {
      medId: 'm1',
      dateKey: '2026-11-11',
      time: '08:00',
    });
    expect(handled).toBe(true);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const trigger = mockSchedule.mock.calls[0][2] as Date;
    expect(trigger.getTime()).toBeGreaterThanOrEqual(before + 29 * 60 * 1000);
    expect(trigger.getTime()).toBeLessThanOrEqual(Date.now() + 31 * 60 * 1000);
  });

  it('ignores unrelated actions', async () => {
    const handled = await handleMedicationAction('some_other_action', { medId: 'm1' });
    expect(handled).toBe(false);
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
