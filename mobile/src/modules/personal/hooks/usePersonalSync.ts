/**
 * usePersonalSync — Supabase pull/push sync hook and queue helpers for the personal module.
 */

import { useCallback, useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../services/AuthProvider";
import { enqueue } from "../../../services/syncQueue";
import { usePersonalStore, PersonalGoal, Note, Recipe, MealPlan } from "../store";

interface SyncState {
  loading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
}

let _hasPersonalSeeded = false;

export function usePersonalSync() {
  const { user } = useAuth();
  const [state, setState] = useState<SyncState>({
    loading: true,
    error: null,
    lastSyncAt: null,
  });
  const synced = useRef(false);

  useEffect(() => {
    if (!user || synced.current) return;
    synced.current = true;
    doFullSync(user.id);
  }, [user]);

  const pullFromCloud = useCallback(async () => {
    if (!user) return;
    _hasPersonalSeeded = true;
    setState({ loading: true, error: null, lastSyncAt: null });
    await doPull(user.id);
    setState({ loading: false, error: null, lastSyncAt: new Date() });
  }, [user]);

  return { ...state, pullFromCloud };
}

export async function syncPersonalNow(userId: string): Promise<SyncState> {
  _hasPersonalSeeded = true;
  let state: SyncState = { loading: true, error: null, lastSyncAt: null };
  const setter: Dispatch<SetStateAction<SyncState>> = ((s: SetStateAction<SyncState>) => {
    if (typeof s === 'function') {
      state = (s as (prev: SyncState) => SyncState)(state);
    } else {
      Object.assign(state, s);
    }
  }) as Dispatch<SetStateAction<SyncState>>;
  await doPull(userId);
  state.loading = false;
  state.lastSyncAt = new Date();
  return state;
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function doFullSync(userId: string) {
  await doPull(userId);
  _hasPersonalSeeded = true;
}

async function doPull(userId: string) {
  const store = usePersonalStore;

  // --- GOALS ---
  const { data: goalsData, error: goalsErr } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId);

  if (!goalsErr && goalsData && goalsData.length > 0) {
    const existingIds = new Set(store.getState().goals.map((g: PersonalGoal) => g.id));
    const newGoals: PersonalGoal[] = (goalsData as Array<Record<string, unknown>>)
      .filter((r) => !existingIds.has(r.id as string))
      .map((r) => ({
        id: r.id as string,
        name: r.title as string,
        completed: Boolean(r.is_completed),
      }));
    if (newGoals.length > 0) {
      store.setState({ goals: [...newGoals, ...store.getState().goals] });
    }
  } else if (!_hasPersonalSeeded && goalsData && goalsData.length === 0) {
    await seedGoals(userId);
  }

  // --- NOTES ---
  const { data: notesData, error: notesErr } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId);

  if (!notesErr && notesData && notesData.length > 0) {
    const existingIds = new Set(store.getState().notes.map((n: Note) => n.id));
    const newNotes: Note[] = (notesData as Array<Record<string, unknown>>)
      .filter((r) => !existingIds.has(r.id as string))
      .map((r) => ({
        id: r.id as string,
        title: r.title as string,
        content: (r.content as string) ?? "",
        date: (r.created_at as string) ?? new Date().toISOString(),
      }));
    if (newNotes.length > 0) {
      store.setState({ notes: [...newNotes, ...store.getState().notes] });
    }
  } else if (!_hasPersonalSeeded && notesData && notesData.length === 0) {
    await seedNotes(userId);
  }

  // --- RECIPES ---
  const { data: recipesData, error: recipesErr } = await supabase
    .from("recipes")
    .select("*")
    .eq("user_id", userId);

  if (!recipesErr && recipesData && recipesData.length > 0) {
    const existingIds = new Set(store.getState().recipes.map((r: Recipe) => r.id));
    const newRecipes: Recipe[] = (recipesData as Array<Record<string, unknown>>)
      .filter((r) => !existingIds.has(r.id as string))
      .map((r) => ({
        id: r.id as string,
        title: r.title as string,
        prepTime: String(r.prep_time ?? "") || "0 mins",
        calories: String(r.calories ?? "") || "0 kcal",
        ingredients: safeJSON(r.ingredients as string, []),
        steps: safeJSON(r.steps as string, []),
      }));
    if (newRecipes.length > 0) {
      store.setState({ recipes: [...newRecipes, ...store.getState().recipes] });
    }
  } else if (!_hasPersonalSeeded && recipesData && recipesData.length === 0) {
    await seedRecipes(userId);
  }

  // --- DIET PLANS ---
  const { data: dietData, error: dietErr } = await supabase
    .from("diet_plans")
    .select("*")
    .eq("user_id", userId);

  if (!dietErr && dietData && dietData.length > 0) {
    const mealsFromDB = mealsFromRows(dietData as Array<Record<string, unknown>>);
    const localMeals = store.getState().meals;
    const merged = mergeMeals(localMeals, mealsFromDB);
    store.setState({ meals: merged });
  } else if (!_hasPersonalSeeded && dietData && dietData.length === 0) {
    await seedDietPlans(userId);
  }

  // --- MEAL LOGS ---
  const { data: mealData, error: mealErr } = await supabase
    .from("meal_logs")
    .select("*")
    .eq("user_id", userId);

  if (!mealErr && mealData && mealData.length > 0) {
    try {
      const { useMealStore } = require("../../meals/store");
      const mealStore = useMealStore;
      const existingIds = new Set(mealStore.getState().entries.map((e: any) => e.id));
      const newEntries: any[] = (mealData as Array<Record<string, unknown>>)
        .filter((r) => !existingIds.has(r.id as string))
        .map((r) => ({
          id: r.id as string,
          date: r.date as string,
          mealType: r.meal_type as string,
          items: safeJSON(r.items as string, []),
          notes: (r.notes as string) ?? "",
        }));
      if (newEntries.length > 0) {
        mealStore.setState({ entries: [...newEntries, ...mealStore.getState().entries] });
      }
    } catch (_e) {}
  }

  // --- WEIGHT LOGS ---
  const { data: weightData, error: weightErr } = await supabase
    .from("weight_logs")
    .select("*")
    .eq("user_id", userId);

  if (!weightErr && weightData && weightData.length > 0) {
    try {
      const { useWeightStore } = require("../../meals/weightStore");
      const weightStore = useWeightStore;
      const existingIds = new Set(weightStore.getState().entries.map((e: any) => e.id));
      const newEntries: any[] = (weightData as Array<Record<string, unknown>>)
        .filter((r) => !existingIds.has(r.id as string))
        .map((r) => ({
          id: r.id as string,
          date: r.date as string,
          weightKg: r.weight_kg as number,
          notes: (r.notes as string) ?? "",
        }));
      if (newEntries.length > 0) {
        const merged = [...newEntries, ...weightStore.getState().entries];
        merged.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        weightStore.setState({ entries: merged });
      }
    } catch (_e) {}
  }

  store.getState().setLastPersonalSyncedAt(new Date().toISOString());
}

// --- SEED FUNCTIONS ---

async function seedGoals(userId: string) {
  const items = usePersonalStore.getState().goals;
  if (items.length === 0) return;
  const rows = items.map((g) => ({
    id: uuid(), user_id: userId, title: g.name,
    is_completed: g.completed, updated_at: new Date().toISOString(),
  }));
  const { data } = await supabase.from("goals").upsert(rows, { onConflict: "id" }).select("id");
  if (data) {
    const idMap = new Map(data.map((r: any, i: number) => [items[i].id, r.id]));
    const updated = items.map((g) => ({ ...g, id: idMap.get(g.id) ?? g.id }));
    usePersonalStore.setState({ goals: updated });
  }
}

async function seedNotes(userId: string) {
  const items = usePersonalStore.getState().notes;
  if (items.length === 0) return;
  const rows = items.map((n) => ({
    id: uuid(), user_id: userId, title: n.title,
    content: n.content, created_at: n.date, updated_at: new Date().toISOString(),
  }));
  const { data } = await supabase.from("notes").upsert(rows, { onConflict: "id" }).select("id");
  if (data) {
    const idMap = new Map(data.map((r: any, i: number) => [items[i].id, r.id]));
    const updated = items.map((n) => ({ ...n, id: idMap.get(n.id) ?? n.id }));
    usePersonalStore.setState({ notes: updated });
  }
}

async function seedRecipes(userId: string) {
  const items = usePersonalStore.getState().recipes;
  if (items.length === 0) return;
  const rows = items.map((r) => ({
    id: uuid(), user_id: userId, title: r.title,
    prep_time: parseInt(r.prepTime) || 0,
    calories: parseInt(r.calories) || 0,
    ingredients: JSON.stringify(r.ingredients),
    steps: JSON.stringify(r.steps),
    updated_at: new Date().toISOString(),
  }));
  const { data } = await supabase.from("recipes").upsert(rows, { onConflict: "id" }).select("id");
  if (data) {
    const idMap = new Map(data.map((r: any, i: number) => [items[i].id, r.id]));
    const updated = items.map((r) => ({ ...r, id: idMap.get(r.id) ?? r.id }));
    usePersonalStore.setState({ recipes: updated });
  }
}

async function seedDietPlans(userId: string) {
  const meals = usePersonalStore.getState().meals;
  if (meals.length === 0) return;
  const rows: Array<Record<string, unknown>> = [];
  for (const day of meals) {
    const dayId = uuid();
    const slots: Array<{ meal_type: string; meal_name: string }> = [
      { meal_type: "breakfast", meal_name: day.breakfast },
      { meal_type: "lunch", meal_name: day.lunch },
      { meal_type: "dinner", meal_name: day.dinner },
      { meal_type: "snack", meal_name: day.snack },
    ];
    for (const slot of slots) {
      if (!slot.meal_name) continue;
      rows.push({
        id: dayId, user_id: userId, day: day.day,
        meal_type: slot.meal_type, meal_name: slot.meal_name,
        updated_at: new Date().toISOString(),
      });
    }
  }
  supabase.from("diet_plans").upsert(rows, { onConflict: "id" }).then(({ error }) => {
    if (error) console.warn('[PersonalSync] seed diet_plans:', error.message);
  });
}

// --- MERGE HELPERS ---

function safeJSON(raw: string | null | undefined, fallback: any): any {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function mealsFromRows(rows: Array<Record<string, unknown>>): MealPlan[] {
  const map = new Map<string, MealPlan>();
  for (const r of rows) {
    const day = r.day as string;
    if (!map.has(day)) {
      map.set(day, { day, breakfast: "", lunch: "", dinner: "", snack: "" });
    }
    const plan = map.get(day)!;
    const mt = r.meal_type as string;
    const mn = r.meal_name as string;
    if (mt === "breakfast") plan.breakfast = mn;
    else if (mt === "lunch") plan.lunch = mn;
    else if (mt === "dinner") plan.dinner = mn;
    else if (mt === "snack") plan.snack = mn;
  }
  return Array.from(map.values());
}

function mergeMeals(local: MealPlan[], remote: MealPlan[]): MealPlan[] {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const merged: MealPlan[] = [];
  for (const d of days) {
    const localDay = local.find((m) => m.day === d);
    const remoteDay = remote.find((m) => m.day === d);
    if (remoteDay) {
      merged.push({
        day: d,
        breakfast: remoteDay.breakfast || localDay?.breakfast || "",
        lunch: remoteDay.lunch || localDay?.lunch || "",
        dinner: remoteDay.dinner || localDay?.dinner || "",
        snack: remoteDay.snack || localDay?.snack || "",
      });
    } else if (localDay) {
      merged.push(localDay);
    }
  }
  if (merged.length === 0) merged.push(...local);
  return merged;
}

// --- QUEUE HELPERS ---

export function queueGoalSync(
  userId: string,
  action: "create" | "update" | "delete",
  goal: PersonalGoal
) {
  enqueue("goals", action, {
    id: goal.id, user_id: userId, title: goal.name,
    is_completed: goal.completed, updated_at: new Date().toISOString(),
  }).catch((e: Error) => console.warn('[PersonalSync] queueGoalSync failed:', e));
}

export function queueNoteSync(
  userId: string,
  action: "create" | "update" | "delete",
  note: Partial<Note> & { id: string }
) {
  const data: Record<string, unknown> = { id: note.id, user_id: userId };
  if (note.title !== undefined) data.title = note.title;
  if (note.content !== undefined) data.content = note.content;
  if (note.date !== undefined) data.created_at = note.date;
  data.updated_at = new Date().toISOString();
  enqueue("notes", action, data).catch((e: Error) => console.warn('[PersonalSync] queueNoteSync failed:', e));
}

export function queueRecipeSync(
  userId: string,
  action: "create" | "update" | "delete",
  recipe: Partial<Recipe> & { id: string }
) {
  const data: Record<string, unknown> = { id: recipe.id, user_id: userId };
  if (recipe.title !== undefined) data.title = recipe.title;
  if (recipe.prepTime !== undefined) data.prep_time = parseInt(recipe.prepTime) || 0;
  if (recipe.calories !== undefined) data.calories = parseInt(recipe.calories) || 0;
  if (recipe.ingredients !== undefined) data.ingredients = JSON.stringify(recipe.ingredients);
  if (recipe.steps !== undefined) data.steps = JSON.stringify(recipe.steps);
  data.updated_at = new Date().toISOString();
  enqueue("recipes", action, data).catch((e: Error) => console.warn('[PersonalSync] queueRecipeSync failed:', e));
}

export function queueDietSync(
  userId: string,
  day: string,
  slot: string,
  mealName: string
) {
  enqueue("diet_plans", "create", {
    id: uuid(), user_id: userId, day, meal_type: slot,
    meal_name: mealName, updated_at: new Date().toISOString(),
  }).catch((e: Error) => console.warn('[PersonalSync] queueDietSync failed:', e));
}
