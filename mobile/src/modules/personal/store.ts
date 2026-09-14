/**
 * PersonalStore — Zustand store for personal goals, notes, recipes, and meal plan.
 */

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
  /** Apple-Notes-style folder name; 'Notes' is the default. */
  folder: string;
  /** pinned notes float to the top. */
  pinned: boolean;
  /** ISO timestamp when soft-deleted (Recently Deleted); null = alive. */
  deletedAt: string | null;
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

export interface BuyListItem {
  id: string;
  name: string;
  price: number; // paise
  itemDate: string | null; // YYYY-MM-DD, optional reminder/buy-by date
  link: string;
  notes: string;
  completed: boolean;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  price: number; // paise
  itemDate: string | null;
  link: string;
  notes: string;
  completed: boolean;
}

type BuyOrGrocery = Partial<BuyListItem & GroceryItem> & { id: string };

/** snake_case row for the sync queue (unknown camelCase keys are dropped by syncQueue). */
function listRow(userId: string | null | undefined, item: BuyOrGrocery): Record<string, unknown> {
  const row: Record<string, unknown> = { id: item.id, user_id: userId ?? null };
  if (item.name !== undefined) row.name = item.name;
  if (item.price !== undefined) row.price = item.price;
  if (item.itemDate !== undefined) row.item_date = item.itemDate;
  if (item.link !== undefined) row.link = item.link;
  if (item.notes !== undefined) row.notes = item.notes;
  if (item.completed !== undefined) row.completed = item.completed;
  if (item.quantity !== undefined) row.quantity = item.quantity;
  row.updated_at = new Date().toISOString();
  return row;
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
  buyListItems: BuyListItem[];
  groceryItems: GroceryItem[];
  toggleGoal: (id: string, userId?: string) => void;
  addGoal: (name: string, userId?: string) => PersonalGoal;
  deleteGoal: (id: string, userId?: string) => void;
  addNote: (title: string, content: string, userId?: string, folder?: string) => string;
  deleteNote: (id: string, userId?: string) => void;
  updateNote: (id: string, title: string, content: string, userId?: string) => void;
  /** Soft-delete into Recently Deleted (Apple Notes parity). */
  trashNote: (id: string, userId?: string) => void;
  restoreNote: (id: string, userId?: string) => void;
  purgeNote: (id: string, userId?: string) => void;
  toggleNotePinned: (id: string, userId?: string) => void;
  moveNote: (id: string, folder: string, userId?: string) => void;
  renameFolder: (oldName: string, newName: string, userId?: string) => void;
  addRecipe: (recipe: Omit<Recipe, 'id'>, userId?: string) => string;
  deleteRecipe: (id: string, userId?: string) => void;
  updateRecipe: (id: string, recipe: Partial<Recipe>, userId?: string) => void;
  updateMealSlot: (day: string, slot: 'breakfast' | 'lunch' | 'dinner' | 'snack', name: string, userId?: string) => void;
  addBuyItem: (item: Omit<BuyListItem, 'id' | 'completed'>, userId?: string) => string;
  updateBuyItem: (id: string, item: Partial<BuyListItem>, userId?: string) => void;
  deleteBuyItem: (id: string, userId?: string) => void;
  toggleBuyItem: (id: string, userId?: string) => void;
  addGroceryItem: (item: Omit<GroceryItem, 'id' | 'completed'>, userId?: string) => string;
  updateGroceryItem: (id: string, item: Partial<GroceryItem>, userId?: string) => void;
  deleteGroceryItem: (id: string, userId?: string) => void;
  toggleGroceryItem: (id: string, userId?: string) => void;
}

export const usePersonalStore = create<PersonalState>()(
  persist(
    (set, get) => ({
      lastPersonalSyncedAt: null,
      setLastPersonalSyncedAt: (iso) => set({ lastPersonalSyncedAt: iso }),
      goals: [],
      notes: [],
      recipes: [],
      buyListItems: [],
      groceryItems: [],
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
      addNote: (title, content, userId, folder) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newNote: Note = {
          id, title, content,
          date: new Date().toISOString(),
          folder: folder || 'Notes',
          pinned: false,
          deletedAt: null,
        };
        set((state) => ({ notes: [newNote, ...state.notes] }));
        enqueueSync('notes', 'create', {
          id, user_id: userId || null, title, content,
          folder: newNote.folder, pinned: false, deleted_at: null,
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
          id, user_id: userId || null, title, content,
          created_at: date, updated_at: date,
        });
      },
      trashNote: (id, userId) => {
        const now = new Date().toISOString();
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, deletedAt: now, pinned: false } : n)),
        }));
        enqueueSync('notes', 'create', {
          id, user_id: userId || null, deleted_at: now, pinned: false, updated_at: now,
        });
      },
      restoreNote: (id, userId) => {
        const now = new Date().toISOString();
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, deletedAt: null } : n)),
        }));
        enqueueSync('notes', 'create', {
          id, user_id: userId || null, deleted_at: null, updated_at: now,
        });
      },
      purgeNote: (id, userId) => {
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
        enqueueSync('notes', 'delete', { id, user_id: userId || null });
      },
      toggleNotePinned: (id, userId) => {
        const now = new Date().toISOString();
        let nextPinned = false;
        set((state) => {
          const notes = state.notes.map((n) => {
            if (n.id !== id) return n;
            nextPinned = !n.pinned;
            return { ...n, pinned: nextPinned };
          });
          return { notes };
        });
        enqueueSync('notes', 'create', {
          id, user_id: userId || null, pinned: nextPinned, updated_at: now,
        });
      },
      moveNote: (id, folder, userId) => {
        const now = new Date().toISOString();
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, folder } : n)),
        }));
        enqueueSync('notes', 'create', {
          id, user_id: userId || null, folder, updated_at: now,
        });
      },
      renameFolder: (oldName, newName, userId) => {
        const now = new Date().toISOString();
        set((state) => ({
          notes: state.notes.map((n) => (n.folder === oldName ? { ...n, folder: newName } : n)),
        }));
        // Folder renames fan out per-note; compactQueue collapses to one op per id.
        const { notes } = get();
        for (const n of notes.filter((x) => x.folder === newName)) {
          enqueueSync('notes', 'create', {
            id: n.id, user_id: userId || null, folder: newName, updated_at: now,
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
      // --- BUY LIST ---
      addBuyItem: (item, userId) => {
        const id = Math.random().toString(36).substring(2, 15);
        const newItem: BuyListItem = { ...item, id, completed: false };
        set((state) => ({ buyListItems: [newItem, ...state.buyListItems] }));
        enqueueSync('buy_list_items', 'create', listRow(userId, newItem));
        return id;
      },
      updateBuyItem: (id, item, userId) => {
        set((state) => ({
          buyListItems: state.buyListItems.map((i) => (i.id === id ? { ...i, ...item } : i)),
        }));
        const updated = get().buyListItems.find((i) => i.id === id);
        if (updated) enqueueSync('buy_list_items', 'create', listRow(userId, updated));
      },
      deleteBuyItem: (id, userId) => {
        set((state) => ({
          buyListItems: state.buyListItems.filter((i) => i.id !== id),
        }));
        enqueueSync('buy_list_items', 'delete', { id, user_id: userId || null });
      },
      toggleBuyItem: (id, userId) => {
        set((state) => ({
          buyListItems: state.buyListItems.map((i) =>
            i.id === id ? { ...i, completed: !i.completed } : i
          ),
        }));
        const updated = get().buyListItems.find((i) => i.id === id);
        if (updated) enqueueSync('buy_list_items', 'create', listRow(userId, updated));
      },
      // --- GROCERY LIST ---
      addGroceryItem: (item, userId) => {
        const id = Math.random().toString(36).substring(2, 15);
        const newItem: GroceryItem = { ...item, id, completed: false };
        set((state) => ({ groceryItems: [newItem, ...state.groceryItems] }));
        enqueueSync('grocery_items', 'create', listRow(userId, newItem));
        return id;
      },
      updateGroceryItem: (id, item, userId) => {
        set((state) => ({
          groceryItems: state.groceryItems.map((i) => (i.id === id ? { ...i, ...item } : i)),
        }));
        const updated = get().groceryItems.find((i) => i.id === id);
        if (updated) enqueueSync('grocery_items', 'create', listRow(userId, updated));
      },
      deleteGroceryItem: (id, userId) => {
        set((state) => ({
          groceryItems: state.groceryItems.filter((i) => i.id !== id),
        }));
        enqueueSync('grocery_items', 'delete', { id, user_id: userId || null });
      },
      toggleGroceryItem: (id, userId) => {
        set((state) => ({
          groceryItems: state.groceryItems.map((i) =>
            i.id === id ? { ...i, completed: !i.completed } : i
          ),
        }));
        const updated = get().groceryItems.find((i) => i.id === id);
        if (updated) enqueueSync('grocery_items', 'create', listRow(userId, updated));
      },
    }),
    {
      name: 'meridian-personal-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
