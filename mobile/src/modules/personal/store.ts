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
      meals: [
        { day: 'Monday', breakfast: 'Overnight oats: Greek yoghurt, fruit, walnuts, peanut butter, seed dose', lunch: 'Rice + rasam + airfryer chicken (double batch) + sautéed cabbage (tiffin)', dinner: 'Reheat chicken + 2 ragi dosa with chutney', snack: 'Roasted chana + nuts (10:45) | Peanuts + seeds (5:30pm)' },
        { day: 'Tuesday', breakfast: 'Dosa + tomato chutney + 1 boiled egg, seed dose', lunch: 'Rice + sambar + airfryer chicken + carrot poriyal (tiffin)', dinner: 'Reheat chicken + fresh chapati', snack: 'Protein smoothie (10:45) | Makhana in ghee + seeds (5:30pm)' },
        { day: 'Wednesday', breakfast: 'Overnight oats: Greek yoghurt, fruit, almonds, peanut butter, seed dose', lunch: 'Rice + dal tadka (double batch) + sautéed cabbage (tiffin)', dinner: 'Reheat dal + ragi dosa with chutney', snack: 'Fruit chaat + peanuts (10:45) | Chana + nuts + yoghurt (5:30pm)' },
        { day: 'Thursday', breakfast: 'Sourdough toast + avocado + peanut butter, seed dose', lunch: 'Rice + tomato pappu + paneer/mushroom curry + beetroot poriyal (tiffin)', dinner: 'Reheat paneer/mushroom curry + aloo-paneer paratha', snack: 'Protein smoothie (10:45) | Chana + nuts + fruit (5:30pm)' },
        { day: 'Friday', breakfast: 'Dosa + chutney + 1 boiled egg, seed dose', lunch: 'Rice + rasam + airfryer chicken + bhindi fry (tiffin)', dinner: 'Reheat chicken + fresh chapati', snack: 'Makhana + nuts (10:45) | Peanuts + seeds (5:30pm)' },
        { day: 'Saturday', breakfast: 'Overnight oats: Greek yoghurt, banana/avocado, walnuts, peanut butter, seed dose', lunch: 'Rice + veg kurma + fish/prawns or chicken + cabbage (tiffin)', dinner: 'Reheat protein + ragi dosa', snack: 'Protein smoothie (10:45) | Chana + nuts + fruit (5:30pm)' },
        { day: 'Sunday', breakfast: 'Sourdough/milk bread + peanut butter + banana, seed dose', lunch: 'Rice + sambar + veg curry + chicken curry (bigger meal)', dinner: 'Reheat chicken + fresh chapati', snack: 'Nuts + seeds trail mix (10:45) | Fruit chaat + yoghurt + prep (5:30pm)' },
      ],
      toggleGoal: (id, userId) => {
        set((state) => {
          const updated = state.goals.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g));
          return { goals: updated };
        });
        const goal = get().goals.find((g) => g.id === id);
        if (goal) {
          enqueueSync('goals', 'create', {
            id: goal.id, user_id: userId || null, title: goal.name,
            is_completed: goal.completed, updated_at: new Date().toISOString(),
          });
        }
      },
      addGoal: (name, userId) => {
        const goal: PersonalGoal = { id: Math.random().toString(36).substring(2, 9), name, completed: false };
        set((state) => ({ goals: [...state.goals, goal] }));
        enqueueSync('goals', 'create', {
          id: goal.id, user_id: userId || null, title: goal.name,
          is_completed: false, updated_at: new Date().toISOString(),
        });
        return goal;
      },
      deleteGoal: (id, userId) => {
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
        }));
        enqueueSync('goals', 'delete', { id, user_id: userId || null });
      },
      addNote: (title, content, userId) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newNote: Note = { id, title, content, date: new Date().toISOString() };
        set((state) => ({ notes: [newNote, ...state.notes] }));
        enqueueSync('notes', 'create', {
          id, user_id: userId || null, title, content,
          created_at: newNote.date, updated_at: new Date().toISOString(),
        });
        return id;
      },
      deleteNote: (id, userId) => {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
        }));
        enqueueSync('notes', 'delete', { id, user_id: userId || null });
      },
      updateNote: (id, title, content, userId) => {
        const date = new Date().toISOString();
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, title, content, date } : n)),
        }));
        enqueueSync('notes', 'create', {
          id, user_id: userId || null, title, content, created_at: date, updated_at: date,
        });
      },
      addRecipe: (recipe, userId) => {
        const newRecipe: Recipe = {
          ...recipe,
          id: Math.random().toString(36).substring(2, 9),
        };
        set((state) => ({
          recipes: [...state.recipes, newRecipe],
        }));
        enqueueSync('recipes', 'create', {
          id: newRecipe.id, user_id: userId || null, title: newRecipe.title,
          prep_time: parseInt(newRecipe.prepTime) || 0,
          calories: parseInt(newRecipe.calories) || 0,
          ingredients: JSON.stringify(newRecipe.ingredients),
          steps: JSON.stringify(newRecipe.steps),
          updated_at: new Date().toISOString(),
        });
        return newRecipe.id;
      },
      deleteRecipe: (id, userId) => {
        set((state) => ({
          recipes: state.recipes.filter((r) => r.id !== id),
        }));
        enqueueSync('recipes', 'delete', { id, user_id: userId || null });
      },
      updateRecipe: (id, recipe, userId) => {
        set((state) => ({
          recipes: state.recipes.map((r) => (r.id === id ? { ...r, ...recipe } : r)),
        }));
        const updated = get().recipes.find((r) => r.id === id);
        if (updated) {
          enqueueSync('recipes', 'create', {
            id: updated.id, user_id: userId || null, title: updated.title,
            prep_time: parseInt(updated.prepTime) || 0,
            calories: parseInt(updated.calories) || 0,
            ingredients: JSON.stringify(updated.ingredients),
            steps: JSON.stringify(updated.steps),
            updated_at: new Date().toISOString(),
          });
        }
      },
      updateMealSlot: (day, slot, name, userId) => {
        set((state) => ({
          meals: state.meals.map((m) => (m.day === day ? { ...m, [slot]: name } : m)),
        }));
        enqueueSync('diet_plans', 'create', {
          id: `${userId || 'local'}_${day}_${slot}`,
          user_id: userId || null, day, meal_type: slot,
          meal_name: name, updated_at: new Date().toISOString(),
        });
      },
    }),
    {
      name: 'meridian-personal-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
