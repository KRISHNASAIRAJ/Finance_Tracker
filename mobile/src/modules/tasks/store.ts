import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  subtasks: Subtask[];
}

interface TasksState {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'completed' | 'subtasks'> & { subtasks: string[] }) => void;
  updateTask: (id: string, updatedFields: Partial<Omit<Task, 'id' | 'subtasks'>>) => void;
  toggleTaskCompleted: (id: string) => void;
  deleteTask: (id: string) => void;
  toggleSubtaskCompleted: (taskId: string, subtaskId: string) => void;
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set) => ({
      tasks: [
        {
          id: '1',
          name: 'Renew Car Insurance policy',
          description: 'HDFC Ergo policy expires on Oct 30. Check quotes first.',
          priority: 'urgent',
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
          completed: false,
          subtasks: [
            { id: '1-1', name: 'Get PUC certificate', completed: true },
            { id: '1-2', name: 'Compare policy premiums online', completed: false },
          ],
        },
        {
          id: '2',
          name: 'Quarterly investment portfolio rebalancing',
          description: 'Adjust weights according to AI target allocations.',
          priority: 'high',
          dueDate: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
          completed: false,
          subtasks: [],
        },
        {
          id: '3',
          name: 'Log weekly diet tracker meal slot plan',
          priority: 'medium',
          dueDate: new Date().toISOString(),
          completed: true,
          subtasks: [],
        },
      ],
      addTask: (newTaskData) => {
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
          subtasks,
        };

        set((state) => ({
          tasks: [newTask, ...state.tasks],
        }));
      },
      updateTask: (id, updatedFields) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updatedFields } : t)),
        }));
      },
      toggleTaskCompleted: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
        }));
      },
      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }));
      },
      toggleSubtaskCompleted: (taskId, subtaskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const updatedSubtasks = t.subtasks.map((st) =>
              st.id === subtaskId ? { ...st, completed: !st.completed } : st
            );
            return { ...t, subtasks: updatedSubtasks };
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
