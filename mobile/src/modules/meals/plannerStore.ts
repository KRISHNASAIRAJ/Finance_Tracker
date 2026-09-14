/**
 * MealPlannerStore — what to cook on which day (future or past), with
 * optional recipe link + notes. Offline-first via the central sync queue.
 * Mirrors the habitStore pattern: local writes first, sync when online.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export interface MealPlanItem {
  id: string;
  /** IST day key YYYY-MM-DD */
  date: string;
  slot: MealSlot;
  /** optional recipes.id link */
  recipeId: string | null;
  title: string;
  notes: string;
  done: boolean;
}

export const MEAL_SLOTS: Array<{ key: MealSlot; label: string; emoji: string }> = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch', label: 'Lunch', emoji: '🍱' },
  { key: 'snack', label: 'Snack', emoji: '🥤' },
  { key: 'dinner', label: 'Dinner', emoji: '🌙' },
];

interface MealPlannerState {
  plans: MealPlanItem[];
  setPlan: (date: string, slot: MealSlot, data: { title: string; recipeId?: string | null; notes?: string }, userId?: string) => void;
  clearPlan: (date: string, slot: MealSlot, userId?: string) => void;
  toggleDone: (date: string, slot: MealSlot, userId?: string) => void;
  setPlansBulk: (items: MealPlanItem[]) => void;
}

/** Stable row id per (date, slot) — deterministic upserts. */
export function planRowId(date: string, slot: string): string {
  return `mp_${date.replace(/-/g, '')}_${slot}`;
}

function flush() {
  const t = setTimeout(() => {
    try {
      const { processSyncQueue } = require('../../services/syncQueue');
      processSyncQueue().catch((_e: Error) => { /* best-effort */ });
    } catch (_e) { /* best-effort */ }
  }, 300);
  if (typeof t === 'object' && t && typeof (t as any).unref === 'function') {
    (t as any).unref();
  }
}

async function enq(entity: string, action: string, data: Record<string, unknown>) {
  try {
    const { enqueue } = require('../../services/syncQueue');
    await enqueue(entity, action as 'create' | 'update' | 'delete', data);
    flush();
  } catch (_e) { /* best-effort */ }
}

export const useMealPlannerStore = create<MealPlannerState>()(
  persist(
    (set, get) => ({
      plans: [],

      setPlan: (date, slot, data, userId) => {
        const id = planRowId(date, slot);
        const existing = get().plans.find((p) => p.id === id);
        const item: MealPlanItem = {
          id,
          date,
          slot,
          recipeId: data.recipeId ?? existing?.recipeId ?? null,
          title: data.title,
          notes: data.notes ?? existing?.notes ?? '',
          done: existing?.done ?? false,
        };
        set((s) => {
          const others = s.plans.filter((p) => p.id !== id);
          return { plans: [...others, item] };
        });
        enq('meal_plans', 'create', {
          id,
          user_id: userId || null,
          plan_date: date,
          slot,
          recipe_id: item.recipeId,
          title: item.title,
          notes: item.notes,
          done: item.done,
          updated_at: new Date().toISOString(),
        });
      },

      clearPlan: (date, slot, userId) => {
        const id = planRowId(date, slot);
        set((s) => ({ plans: s.plans.filter((p) => p.id !== id) }));
        enq('meal_plans', 'delete', { id, user_id: userId || null });
      },

      toggleDone: (date, slot, userId) => {
        const id = planRowId(date, slot);
        const existing = get().plans.find((p) => p.id === id);
        if (!existing) return;
        const item = { ...existing, done: !existing.done };
        set((s) => ({ plans: s.plans.map((p) => (p.id === id ? item : p)) }));
        enq('meal_plans', 'create', {
          id,
          user_id: userId || null,
          plan_date: item.date,
          slot: item.slot,
          recipe_id: item.recipeId,
          title: item.title,
          notes: item.notes,
          done: item.done,
          updated_at: new Date().toISOString(),
        });
      },

      setPlansBulk: (items) => set({ plans: items }),
    }),
    {
      name: 'meridian-meal-planner-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Plans for a given day key. */
export function plansForDate(plans: MealPlanItem[], date: string): Record<MealSlot, MealPlanItem | undefined> {
  const out = {} as Record<MealSlot, MealPlanItem | undefined>;
  for (const p of plans) {
    if (p.date === date) out[p.slot] = p;
  }
  return out;
}
