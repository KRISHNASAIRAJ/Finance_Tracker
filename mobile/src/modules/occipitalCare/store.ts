/**
 * OccipitalCareStore — local-only daily care checklist.
 *
 * Deliberately device-only (AsyncStorage): this is personal health habit data,
 * not financial data, so it needs no Supabase table, RLS policy or sync-queue
 * write. Keeping it local respects the repo's "preferences stay on device"
 * guidance and avoids a schema migration for what is a self-care aid.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CareDay, careDayId, careDayFor } from './careData';

interface OccipitalCareState {
  days: CareDay[];
  /** Toggle one item for a day. Returns true when it is now ticked. */
  toggle: (dayKey: string, key: string) => boolean;
  /** Set 0–10 pain score for a day (null clears it). */
  setPain: (dayKey: string, pain: number | null) => void;
}

export const useOccipitalCareStore = create<OccipitalCareState>()(
  persist(
    (set, get) => ({
      days: [],

      toggle: (dayKey, key) => {
        const existing = careDayFor(get().days, dayKey);
        const current = existing?.done ?? [];
        const has = current.includes(key);
        const next = has ? current.filter((k) => k !== key) : [...current, key];
        const row: CareDay = {
          id: existing?.id ?? careDayId(dayKey),
          day: dayKey,
          done: next,
          pain: existing?.pain ?? null,
        };

        set((s) => {
          const others = s.days.filter((d) => d.day !== dayKey);
          const merged = [...others, row];
          merged.sort((a, b) => (a.day < b.day ? 1 : -1));
          return { days: merged };
        });
        return !has;
      },

      setPain: (dayKey, pain) => {
        const existing = careDayFor(get().days, dayKey);
        const value = pain === null ? null : Math.max(0, Math.min(10, Math.round(pain)));
        const row: CareDay = {
          id: existing?.id ?? careDayId(dayKey),
          day: dayKey,
          done: existing?.done ?? [],
          pain: value,
        };
        set((s) => ({
          days: [...s.days.filter((d) => d.day !== dayKey), row].sort((a, b) =>
            a.day < b.day ? 1 : -1
          ),
        }));
      },
    }),
    {
      name: 'meridian-occipital-care-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ days: s.days }),
    }
  )
);
