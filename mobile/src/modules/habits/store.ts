/**
 * HabitStore — one row per day, offline-first via the central sync queue.
 * Mirrors weightStore/sleepStore patterns.
 * Habit definitions are user-editable (long-press on a habit) and sync via
 * the user_settings.habit_defs content column.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseHabits, HabitDef, effectiveHabits } from './habits';

export interface HabitDay {
  id: string;
  /** IST day key YYYY-MM-DD */
  day: string;
  /** ticked habit keys */
  habits: string[];
  notes: string;
}

interface HabitState {
  days: HabitDay[];
  /** user-edited habit definitions; null = canonical set */
  habitOverrides: HabitDef[] | null;
  toggleHabit: (dayKey: string, habitKey: string, userId?: string) => boolean;
  setNotes: (dayKey: string, notes: string, userId?: string) => void;
  setHabitOverrides: (defs: HabitDef[] | null, userId?: string) => void;
}

function flush() {
  const t = setTimeout(() => {
    try {
      const { processSyncQueue } = require('../../services/syncQueue');
      processSyncQueue().catch((_e: Error) => {});
    } catch (_e) {}
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
  } catch (_e) {}
}

/** Stable row id for a day key (deterministic — same device gets same id). */
function dayRowId(dayKey: string): string {
  return `hb_${dayKey.replace(/-/g, '')}`;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      days: [],
      habitOverrides: null,

      toggleHabit: (dayKey, habitKey, userId) => {
        const existing = get().days.find((d) => d.day === dayKey);
        const current = existing?.habits ?? [];
        const has = current.includes(habitKey);
        const next = has ? current.filter((k) => k !== habitKey) : [...current, habitKey];
        const id = existing?.id ?? dayRowId(dayKey);

        set((s) => {
          const others = s.days.filter((d) => d.day !== dayKey);
          const merged = [...others, { id, day: dayKey, habits: next, notes: existing?.notes ?? '' }];
          merged.sort((a, b) => (a.day < b.day ? 1 : -1));
          return { days: merged };
        });

        enq('habit_logs', 'create', {
          id,
          user_id: userId || null,
          log_date: dayKey,
          habits: JSON.stringify(next),
          notes: existing?.notes ?? '',
          updated_at: new Date().toISOString(),
        });
        return !has;
      },

      setNotes: (dayKey, notes, userId) => {
        const existing = get().days.find((d) => d.day === dayKey);
        if (!existing) return;
        set((s) => ({
          days: s.days.map((d) => (d.day === dayKey ? { ...d, notes } : d)),
        }));
        enq('habit_logs', 'create', {
          id: existing.id,
          user_id: userId || null,
          log_date: dayKey,
          habits: JSON.stringify(existing.habits),
          notes,
          updated_at: new Date().toISOString(),
        });
      },

      setHabitOverrides: (defs, userId) => {
        set({ habitOverrides: defs });
        if (!userId) return; // user_settings is user-keyed — nothing to sync signed out
        enq('user_settings', 'create', {
          user_id: userId,
          habit_defs: defs ? JSON.stringify(defs) : null,
          updated_at: new Date().toISOString(),
        });
      },
    }),
    {
      name: 'meridian-habits-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ days: s.days, habitOverrides: s.habitOverrides }),
    }
  )
);

/** Lookup helper: ticked keys for a given day (empty array when absent). */
export function habitsForDay(days: HabitDay[], dayKey: string): string[] {
  const d = days.find((x) => x.day === dayKey);
  return d ? parseHabits(d.habits) : [];
}

/** The effective (user-edited or canonical) habit list. */
export function useHabitDefs(): HabitDef[] {
  const overrides = useHabitStore((s) => s.habitOverrides);
  return effectiveHabits(overrides);
}
