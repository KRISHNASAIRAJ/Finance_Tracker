import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PersonalGoal {
  id: string;
  name: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
}

export interface Recipe {
  id: string;
  title: string;
  prepTime: string;
  calories: string;
  ingredients: string[];
  steps: string[];
}

export interface MealPlan {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
}

export interface PersonalSyncMeta {
  lastPersonalSyncedAt: string | null;
  setLastPersonalSyncedAt: (iso: string) => void;
}

function flushSyncQueue() {
  setTimeout(() => {
    try {
      const { processSyncQueue } = require('../../services/syncQueue');
      processSyncQueue().catch((e: Error) => console.warn('[PersonalStore] syncQueue flush failed:', e));
    } catch (e) { console.warn('[PersonalStore] flushSyncQueue failed:', e); }
  }, 300);
}

async function enqueueSync(entity: string, action: string, payload: Record<string, unknown>) {
  try {
    const { enqueue } = require('../../services/syncQueue');
    await enqueue(entity, action as "create" | "update" | "delete", payload);
    flushSyncQueue();
  } catch (e) { console.warn('[PersonalStore] enqueueSync failed:', e); }
}

interface PersonalState extends PersonalSyncMeta {
  goals: PersonalGoal[];
  notes: Note[];
  recipes: Recipe[];
  meals: MealPlan[];
  toggleGoal: (id: string, userId?: string) => void;
  addGoal: (name: string, userId?: string) => PersonalGoal;
  deleteGoal: (id: string, userId?: string) => void;
  addNote: (title: string, content: string, userId?: string) => string;
  deleteNote: (id: string, userId?: string) => void;
  updateNote: (id: string, title: string, content: string, userId?: string) => void;
  addRecipe: (recipe: Omit<Recipe, 'id'>, userId?: string) => string;
  deleteRecipe: (id: string, userId?: string) => void;
  updateRecipe: (id: string, recipe: Partial<Recipe>, userId?: string) => void;
  updateMealSlot: (day: string, slot: 'breakfast' | 'lunch' | 'dinner' | 'snack', name: string, userId?: string) => void;
}

export const usePersonalStore = create<PersonalState>()(
  persist(
    (set, get) => ({
      lastPersonalSyncedAt: null,
      setLastPersonalSyncedAt: (iso) => set({ lastPersonalSyncedAt: iso }),
      goals: [],
      notes: [],
      recipes: [],
      meals: [],
      toggleGoal: (id, userId) => {
        set((state) => {
          const updated = state.goals.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g));
          return { goals: updated };
        });
        if (userId) {
          const goal = get().goals.find((g) => g.id === id);
          if (goal) {
            enqueueSync('goals', 'create', {
              id: goal.id, user_id: userId, title: goal.name,
              is_completed: goal.completed, updated_at: new Date().toISOString(),
            });
          }
        }
      },
      addGoal: (name, userId) => {
        const goal: PersonalGoal = { id: Math.random().toString(36).substring(2, 9), name, completed: false };
        set((state) => ({ goals: [...state.goals, goal] }));
        if (userId) {
          enqueueSync('goals', 'create', {
            id: goal.id, user_id: userId, title: goal.name,
            is_completed: false, updated_at: new Date().toISOString(),
          });
        }
        return goal;
      },
      deleteGoal: (id, userId) => {
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
        }));
        if (userId) {
          enqueueSync('goals', 'delete', { id, user_id: userId });
        }
      },
      addNote: (title, content, userId) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newNote: Note = { id, title, content, date: new Date().toISOString() };
        set((state) => ({ notes: [newNote, ...state.notes] }));
        if (userId) {
          enqueueSync('notes', 'create', {
            id, user_id: userId, title, content,
            created_at: newNote.date, updated_at: new Date().toISOString(),
          });
        }
        return id;
      },
      deleteNote: (id, userId) => {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
        }));
        if (userId) {
          enqueueSync('notes', 'delete', { id, user_id: userId });
        }
      },
      updateNote: (id, title, content, userId) => {
        const date = new Date().toISOString();
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, title, content, date } : n)),
        }));
        if (userId) {
          enqueueSync('notes', 'create', {
            id, user_id: userId, title, content, created_at: date, updated_at: date,
          });
        }
      },
      addRecipe: (recipe, userId) => {
        const newRecipe: Recipe = {
          ...recipe,
          id: Math.random().toString(36).substring(2, 9),
        };
        set((state) => ({
          recipes: [...state.recipes, newRecipe],
        }));
        if (userId) {
          enqueueSync('recipes', 'create', {
            id: newRecipe.id, user_id: userId, title: newRecipe.title,
            prep_time: parseInt(newRecipe.prepTime) || 0,
            calories: parseInt(newRecipe.calories) || 0,
            ingredients: JSON.stringify(newRecipe.ingredients),
            steps: JSON.stringify(newRecipe.steps),
            updated_at: new Date().toISOString(),
          });
        }
        return newRecipe.id;
      },
      deleteRecipe: (id, userId) => {
        set((state) => ({
          recipes: state.recipes.filter((r) => r.id !== id),
        }));
        if (userId) {
          enqueueSync('recipes', 'delete', { id, user_id: userId });
        }
      },
      updateRecipe: (id, recipe, userId) => {
        set((state) => ({
          recipes: state.recipes.map((r) => (r.id === id ? { ...r, ...recipe } : r)),
        }));
        if (userId) {
          const updated = get().recipes.find((r) => r.id === id);
          if (updated) {
            enqueueSync('recipes', 'create', {
              id: updated.id, user_id: userId, title: updated.title,
              prep_time: parseInt(updated.prepTime) || 0,
              calories: parseInt(updated.calories) || 0,
              ingredients: JSON.stringify(updated.ingredients),
              steps: JSON.stringify(updated.steps),
              updated_at: new Date().toISOString(),
            });
          }
        }
      },
      updateMealSlot: (day, slot, name, userId) => {
        set((state) => ({
          meals: state.meals.map((m) => (m.day === day ? { ...m, [slot]: name } : m)),
        }));
        if (userId) {
          enqueueSync('diet_plans', 'create', {
            id: `${userId}_${day}_${slot}`,
            user_id: userId, day, meal_type: slot,
            meal_name: name, updated_at: new Date().toISOString(),
          });
        }
      },
    }),
    {
      name: 'meridian-personal-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
