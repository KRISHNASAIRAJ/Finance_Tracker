/**
 * Unit tests for the tasks store reminder wiring — completing a task must
 * cancel its due-time notification, while re-opening / adding / editing must
 * (re)schedule it. notificationService is mocked; the store talks to it via
 * lazy require so the circular import stays safe.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../services/notificationService', () => ({
  cancelTaskReminder: jest.fn().mockResolvedValue(undefined),
  scheduleTaskReminder: jest.fn().mockResolvedValue(undefined),
}));

function freshModules() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const store = require('../store').useTasksStore as typeof import('../store').useTasksStore;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const svc = require('../../../services/notificationService');
  return { store, svc };
}

const TASK_INPUT = {
  name: 'Pay electricity bill',
  description: 'BESCOM',
  priority: 'high' as const,
  dueDate: '2026-11-01T05:30:00.000Z',
  subtasks: [] as string[],
};

describe('Tasks Store — reminder wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('addTask schedules the due-time reminder', () => {
    const { store, svc } = freshModules();
    store.getState().addTask(TASK_INPUT, 'user-1');
    const task = store.getState().tasks[0];
    expect(svc.scheduleTaskReminder).toHaveBeenCalledTimes(1);
    expect(svc.scheduleTaskReminder).toHaveBeenCalledWith(expect.objectContaining({ id: task.id }));
  });

  it('completing a task cancels its reminder; re-opening reschedules', () => {
    const { store, svc } = freshModules();
    store.getState().addTask(TASK_INPUT, 'user-1');
    const id = store.getState().tasks[0].id;

    store.getState().toggleTaskCompleted(id, 'user-1');
    expect(svc.cancelTaskReminder).toHaveBeenCalledWith(id);
    expect(store.getState().tasks.find((t) => t.id === id)?.completed).toBe(true);

    store.getState().toggleTaskCompleted(id, 'user-1');
    expect(svc.scheduleTaskReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id, completed: false })
    );
  });

  it('editing the due date reschedules an open task', () => {
    const { store, svc } = freshModules();
    store.getState().addTask(TASK_INPUT, 'user-1');
    const id = store.getState().tasks[0].id;
    svc.scheduleTaskReminder.mockClear();

    store.getState().editTask(
      id,
      {
        name: TASK_INPUT.name,
        description: TASK_INPUT.description,
        priority: 'high',
        dueDate: '2026-11-02T05:30:00.000Z',
        subtasks: [],
        recurrence: 'none',
      },
      'user-1'
    );
    expect(svc.scheduleTaskReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id, dueDate: '2026-11-02T05:30:00.000Z' })
    );
  });

  it('deleting a task cancels its reminder', () => {
    const { store, svc } = freshModules();
    store.getState().addTask(TASK_INPUT, 'user-1');
    const id = store.getState().tasks[0].id;

    store.getState().deleteTask(id, 'user-1');
    expect(svc.cancelTaskReminder).toHaveBeenCalledWith(id);
  });

  it('completing a recurring task cancels it and schedules the next occurrence', () => {
    const { store, svc } = freshModules();
    store.getState().addTask({ ...TASK_INPUT, recurrence: 'daily' }, 'user-1');
    const original = store.getState().tasks[0];
    svc.scheduleTaskReminder.mockClear();

    store.getState().toggleTaskCompleted(original.id, 'user-1');
    expect(svc.cancelTaskReminder).toHaveBeenCalledWith(original.id);
    expect(svc.scheduleTaskReminder).toHaveBeenCalledTimes(1);
    const next = svc.scheduleTaskReminder.mock.calls[0][0];
    expect(next.id).not.toBe(original.id);
    expect(new Date(next.dueDate).getTime()).toBeGreaterThan(new Date(original.dueDate).getTime());
  });
});
