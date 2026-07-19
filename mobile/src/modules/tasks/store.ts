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
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  subtasks: Subtask[];
  recurrence: RecurrenceType;
}

function enqueueThenFlush(entity: string, action: "create" | "update" | "delete", payload: Record<string, unknown>) {
  try {
    const { enqueue, processSyncQueue } = require('../../services/syncQueue');
    enqueue(entity, action, payload).finally(() => {
      setTimeout(() => {
        processSyncQueue().catch((e: Error) => console.warn('[TasksStore] flush failed:', e));
      }, 200);
    }).catch((e: Error) => console.warn('[TasksStore] enqueue failed:', e));
  } catch (e) { console.warn('[TasksStore] sync require failed:', e); }
}

function getNextDueDate(currentDue: string, recurrence: RecurrenceType): string {
  const d = new Date(currentDue);
  switch (recurrence) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    default: return currentDue;
  }
  return d.toISOString();
}

function makeTaskPayload(id: string, userId: string, name: string, description: string | undefined | null, priority: string, dueDate: string, isCompleted: boolean, subtasks: Subtask[], recurrence: string) {
  return {
    id, user_id: userId, title: name,
    description: description ?? null, priority,
    due_date: dueDate, is_completed: isCompleted,
    subtasks: JSON.stringify(subtasks), recurrence,
  };
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
      tasks: [],
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
        set((state) => ({ tasks: [newTask, ...state.tasks] }));
        if (userId) {
          enqueueThenFlush('tasks', 'create', makeTaskPayload(newTask.id, userId, newTask.name, newTask.description, newTask.priority, newTask.dueDate, false, subtasks, newTask.recurrence));
        }
      },
      updateTask: (id, updatedFields, userId) => {
        set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updatedFields } : t)) }));
        if (userId) {
          const task = get().tasks.find((t) => t.id === id);
          if (task) {
            enqueueThenFlush('tasks', 'create', makeTaskPayload(task.id, userId, task.name, task.description, task.priority, task.dueDate, task.completed, task.subtasks, task.recurrence));
          }
        }
      },
      editTask: (id, data, userId) => {
        const existingTask = get().tasks.find((t) => t.id === id);
        const prevSubtasks = existingTask?.subtasks ?? [];
        const subtasks: Subtask[] = data.subtasks.map((name, index) => {
          const existing = prevSubtasks.find((s) => s.name === name);
          return existing ? { ...existing } : { id: `${Math.random().toString(36).substring(2, 9)}-${index}`, name, completed: false };
        });
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, name: data.name, description: data.description, priority: data.priority, dueDate: data.dueDate, subtasks, recurrence: data.recurrence } : t
          ),
        }));
        if (userId) {
          const task = get().tasks.find((t) => t.id === id);
          if (task) {
            enqueueThenFlush('tasks', 'create', makeTaskPayload(task.id, userId, task.name, task.description, task.priority, task.dueDate, task.completed, task.subtasks, task.recurrence));
          }
        }
      },
      toggleTaskCompleted: (id, userId) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;
        const newCompleted = !task.completed;
        const completedAt = newCompleted ? new Date().toISOString() : null;
        set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: newCompleted, completedAt } : t)) }));
        if (userId) {
          enqueueThenFlush('tasks', 'create', makeTaskPayload(task.id, userId, task.name, task.description, task.priority, task.dueDate, newCompleted, task.subtasks, task.recurrence));
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
          set((state) => ({ tasks: [nextTask, ...state.tasks] }));
          if (userId) {
            enqueueThenFlush('tasks', 'create', makeTaskPayload(nextTask.id, userId, nextTask.name, nextTask.description, nextTask.priority, nextTask.dueDate, false, resetSubtasks, nextTask.recurrence));
          }
        }
      },
      deleteTask: (id, userId) => {
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
        if (userId) {
          enqueueThenFlush('tasks', 'delete', { id, user_id: userId });
        }
      },
      toggleSubtaskCompleted: (taskId, subtaskId, userId) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const updatedSubtasks = t.subtasks.map((st) => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
            return { ...t, subtasks: updatedSubtasks };
          }),
        }));
        if (userId) {
          const task = get().tasks.find((t) => t.id === taskId);
          if (task) {
            enqueueThenFlush('tasks', 'create', makeTaskPayload(task.id, userId, task.name, task.description, task.priority, task.dueDate, task.completed, task.subtasks, task.recurrence));
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
      name: 'meridian-tasks-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
