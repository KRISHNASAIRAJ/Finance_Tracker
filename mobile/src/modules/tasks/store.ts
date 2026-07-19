import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Subtask {
  id: string;
  name: string;
  completed: boolean;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate: string; // ISO date string
  completed: boolean;
  completedAt: string | null; // ISO timestamp when marked done
  subtasks: Subtask[];
  recurrence: RecurrenceType;
}

function queueSync(entity: string, action: "create" | "delete", payload: Record<string, unknown>) {
  try {
    const { enqueue } = require('../../services/syncQueue');
    enqueue(entity, action, payload);
  } catch {}
}

function getNextDueDate(currentDue: string, recurrence: RecurrenceType): string {
  const d = new Date(currentDue);
  switch (recurrence) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    default:
      return currentDue;
  }
  return d.toISOString();
}

interface TasksState {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks' | 'recurrence'> & { subtasks: string[]; recurrence?: RecurrenceType }, userId?: string) => void;
  updateTask: (id: string, updatedFields: Partial<Omit<Task, 'id' | 'subtasks'>>, userId?: string) => void;
  editTask: (id: string, data: { name: string; description?: string; priority: Task['priority']; dueDate: string; subtasks: string[]; recurrence: RecurrenceType }, userId?: string) => void;
  toggleTaskCompleted: (id: string, userId?: string) => void;
  deleteTask: (id: string, userId?: string) => void;
  toggleSubtaskCompleted: (taskId: string, subtaskId: string, userId?: string) => void;
  purgeOldCompletedTasks: () => void;
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [
        {
          id: '1',
          name: 'Renew Car Insurance policy',
          description: 'HDFC Ergo policy expires on Oct 30. Check quotes first.',
          priority: 'urgent',
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
          completed: false,
          completedAt: null,
          subtasks: [
            { id: '1-1', name: 'Get PUC certificate', completed: true },
            { id: '1-2', name: 'Compare policy premiums online', completed: false },
          ],
          recurrence: 'none',
        },
        {
          id: '2',
          name: 'Quarterly investment portfolio rebalancing',
          description: 'Adjust weights according to AI target allocations.',
          priority: 'high',
          dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
          completed: false,
          completedAt: null,
          subtasks: [],
          recurrence: 'none',
        },
        {
          id: '3',
          name: 'Log weekly diet tracker meal slot plan',
          priority: 'medium',
          dueDate: new Date().toISOString(),
          completed: true,
          completedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          subtasks: [],
          recurrence: 'none',
        },
      ],
      addTask: (newTaskData, userId) => {
        const subtasks: Subtask[] = newTaskData.subtasks.map((name, index) => ({
          id: `${Math.random().toString(36).substring(2, 9)}-${index}`,
          name,
          completed: false,
        }));

        const newTask: Task = {
          id: Math.random().toString(36).substring(2, 9),
          name: newTaskData.name,
          description: newTaskData.description,
          priority: newTaskData.priority,
          dueDate: newTaskData.dueDate,
          completed: false,
          completedAt: null,
          subtasks,
          recurrence: newTaskData.recurrence ?? 'none',
        };

        set((state) => ({
          tasks: [newTask, ...state.tasks],
        }));

        if (userId) {
          queueSync('tasks', 'create', {
            id: newTask.id,
            user_id: userId,
            title: newTask.name,
            description: newTask.description ?? null,
            priority: newTask.priority,
            due_date: newTask.dueDate,
            is_completed: false,
            subtasks: JSON.stringify(subtasks),
            recurrence: newTask.recurrence,
          });
        }
      },
      updateTask: (id, updatedFields, userId) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updatedFields } : t)),
        }));
        if (userId) {
          const task = get().tasks.find((t) => t.id === id);
          if (task) {
            queueSync('tasks', 'create', {
              id: task.id,
              user_id: userId,
              title: task.name,
              description: task.description ?? null,
              priority: task.priority,
              due_date: task.dueDate,
              is_completed: task.completed,
              subtasks: JSON.stringify(task.subtasks),
              recurrence: task.recurrence,
            });
          }
        }
      },
      editTask: (id, data, userId) => {
        const existingTask = get().tasks.find((t) => t.id === id);
        const prevSubtasks = existingTask?.subtasks ?? [];
        const subtasks: Subtask[] = data.subtasks.map((name, index) => {
          const existing = prevSubtasks.find((s) => s.name === name);
          return existing
            ? { ...existing }
            : { id: `${Math.random().toString(36).substring(2, 9)}-${index}`, name, completed: false };
        });
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? { ...t, name: data.name, description: data.description, priority: data.priority, dueDate: data.dueDate, subtasks, recurrence: data.recurrence }
              : t
          ),
        }));
        if (userId) {
          const task = get().tasks.find((t) => t.id === id);
          if (task) {
            queueSync('tasks', 'create', {
              id: task.id,
              user_id: userId,
              title: task.name,
              description: task.description ?? null,
              priority: task.priority,
              due_date: task.dueDate,
              is_completed: task.completed,
              subtasks: JSON.stringify(task.subtasks),
              recurrence: task.recurrence,
            });
          }
        }
      },
      toggleTaskCompleted: (id, userId) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;

        const newCompleted = !task.completed;
        const completedAt = newCompleted ? new Date().toISOString() : null;
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: newCompleted, completedAt } : t)),
        }));

        if (userId) {
          queueSync('tasks', 'create', {
            id: task.id,
            user_id: userId,
            title: task.name,
            description: task.description ?? null,
            priority: task.priority,
            due_date: task.dueDate,
            is_completed: newCompleted,
            subtasks: JSON.stringify(task.subtasks),
            recurrence: task.recurrence,
          });
        }

        if (newCompleted && task.recurrence !== 'none') {
          const nextDate = getNextDueDate(task.dueDate, task.recurrence);
          const resetSubtasks = task.subtasks.map((st) => ({ ...st, completed: false }));
          const nextTask: Task = {
            id: Math.random().toString(36).substring(2, 9),
            name: task.name,
            description: task.description,
            priority: task.priority,
            dueDate: nextDate,
            completed: false,
            completedAt: null,
            subtasks: resetSubtasks,
            recurrence: task.recurrence,
          };
          set((state) => ({
            tasks: [nextTask, ...state.tasks],
          }));
          if (userId) {
            queueSync('tasks', 'create', {
              id: nextTask.id,
              user_id: userId,
              title: nextTask.name,
              description: nextTask.description ?? null,
              priority: nextTask.priority,
              due_date: nextTask.dueDate,
              is_completed: false,
              subtasks: JSON.stringify(resetSubtasks),
              recurrence: nextTask.recurrence,
            });
          }
        }
      },
      deleteTask: (id, userId) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }));
        if (userId) {
          queueSync('tasks', 'delete', { id, user_id: userId });
        }
      },
      toggleSubtaskCompleted: (taskId, subtaskId, userId) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const updatedSubtasks = t.subtasks.map((st) =>
              st.id === subtaskId ? { ...st, completed: !st.completed } : st
            );
            return { ...t, subtasks: updatedSubtasks };
          }),
        }));
        if (userId) {
          const task = get().tasks.find((t) => t.id === taskId);
          if (task) {
            queueSync('tasks', 'create', {
              id: task.id,
              user_id: userId,
              title: task.name,
              description: task.description ?? null,
              priority: task.priority,
              due_date: task.dueDate,
              is_completed: task.completed,
              subtasks: JSON.stringify(task.subtasks),
              recurrence: task.recurrence,
            });
          }
        }
      },
      purgeOldCompletedTasks: () => {
        const cutoff = Date.now() - 7 * 86400000;
        set((state) => ({
          tasks: state.tasks.filter((t) => {
            if (!t.completed || !t.completedAt) return true;
            return new Date(t.completedAt).getTime() > cutoff;
          }),
        }));
      },
    }),
    {
      name: 'meridian-tasks-storage', // Do NOT bump — preserves data across updates
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
