/**
 * Task due-time reminders ΓÇö the "five identical pings for one chore" regression.
 *
 * Duplicate task rows share a name and due time; older builds also left alarms
 * with different/no keys. One chore must end with exactly one OS alarm.
 */
jest.mock('expo-notifications', () => {
  const scheduled: any[] = [];
  let seq = 0;
  return {
    __scheduled: scheduled,
    __reset: () => { scheduled.length = 0; seq = 0; },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => {}),
    setNotificationCategoryAsync: jest.fn(async () => {}),
    getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    scheduleNotificationAsync: jest.fn(async (request: any) => {
      const id = `n-${++seq}`;
      scheduled.push({ id, content: request.content, trigger: request.trigger });
      return id;
    }),
    getAllScheduledNotificationsAsync: jest.fn(async () => [...scheduled]),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
      const i = scheduled.findIndex((n) => n.id === id);
      if (i >= 0) scheduled.splice(i, 1);
    }),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => { scheduled.length = 0; }),
    AndroidImportance: { HIGH: 4, DEFAULT: 3 },
    AndroidNotificationPriority: { HIGH: 5 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
  };
});

import {
  isTaskAlarmFor, scheduleTaskReminder, taskAlarmKey,
} from '../notificationService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const N: any = require('expo-notifications');

const TASK = {
  id: 'laundry',
  name: 'Laundry (1/3)',
  description: 'Task due now',
};

function alarm(id: string, fireAt: Date, data: Record<string, string> = { dedupKey: 'task_laundry', taskId: 'laundry' }) {
  return {
    id,
    content: {
      title: `Laundry (1/3), ${fireAt.toISOString()}`,
      data,
    },
    trigger: { type: 'date', date: fireAt },
  };
}

beforeEach(() => {
  N.__reset();
  jest.clearAllMocks();
});

describe('task alarm identity', () => {
  it('uses the same key for duplicate rows with the same name and due time', () => {
    const due = Date.parse('2026-11-23T12:30:00.000Z');
    expect(taskAlarmKey('Lunch Box Washing', due)).toBe(taskAlarmKey('Lunch Box Washing', due));
    expect(taskAlarmKey('Lunch Box Washing', due)).not.toBe(taskAlarmKey('Laundry', due));
  });

  it('recognises alarms from older builds by taskId or title', () => {
    const fireAt = new Date(Date.now() + 60_000);
    expect(isTaskAlarmFor(alarm('legacy', fireAt, { taskId: 'laundry' }), TASK)).toBe(true);
    expect(isTaskAlarmFor(alarm('old', fireAt, {}), TASK)).toBe(true);
    expect(isTaskAlarmFor({ content: { title: 'Other chore, 23 Nov', data: {} } }, TASK)).toBe(false);
  });
});

describe('scheduleTaskReminder', () => {
  it('leaves an imminent alarm for the same due time alone', async () => {
    const due = new Date(Date.now() + 60_000);
    N.__scheduled.push(alarm('existing', due));

    await scheduleTaskReminder({ ...TASK, dueDate: due.toISOString() });

    expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(N.__scheduled).toHaveLength(1);
  });

  it('replaces a stale alarm whose fire time is an older due time', async () => {
    const oldDue = new Date(Date.now() + 60 * 60_000);
    const newDue = new Date(Date.now() + 2 * 60 * 60_000);
    N.__scheduled.push(alarm('stale', oldDue));

    await scheduleTaskReminder({ ...TASK, dueDate: newDue.toISOString() });

    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith('stale');
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(N.__scheduled).toHaveLength(1);
    expect(N.__scheduled[0].content.data.dedupKey).toBe(taskAlarmKey(TASK.name, newDue.getTime()));
  });

  it('arms exactly one alarm when two save paths call it concurrently', async () => {
    const due = new Date(Date.now() + 60_000).toISOString();

    await Promise.all([
      scheduleTaskReminder({ ...TASK, dueDate: due }),
      scheduleTaskReminder({ ...TASK, dueDate: due }),
    ]);

    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(N.__scheduled).toHaveLength(1);
  });

  it('collapses five duplicate task rows into a single alarm', async () => {
    const due = new Date(Date.now() + 60 * 60_000).toISOString();
    await Promise.all([0, 1, 2, 3, 4].map((i) => scheduleTaskReminder({
      ...TASK, id: `row-${i}`, dueDate: due,
    })));

    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(N.__scheduled).toHaveLength(1);
  });

  it('removes extra legacy alarms near the due time without arming a new copy', async () => {
    const due = new Date(Date.now() + 60_000);
    N.__scheduled.push(
      alarm('legacy-1', due, { taskId: 'laundry' }),
      alarm('legacy-2', due, {}),
      alarm('legacy-3', due, { dedupKey: 'task_laundry' }),
    );

    await scheduleTaskReminder({ ...TASK, dueDate: due.toISOString() });

    expect(N.__scheduled).toHaveLength(1);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels the alarm when the task is completed', async () => {
    const due = new Date(Date.now() + 60_000).toISOString();
    await scheduleTaskReminder({ ...TASK, dueDate: due });
    expect(N.__scheduled).toHaveLength(1);

    await scheduleTaskReminder({ ...TASK, dueDate: due, completed: true });

    expect(N.__scheduled).toHaveLength(0);
  });
});
