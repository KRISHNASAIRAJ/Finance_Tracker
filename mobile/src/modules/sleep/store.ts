/**
 * SleepStore — Zustand store for sleep logs with offline sync queue support.
 * Mirrors the weightStore pattern: local-first writes + sync queue enqueue.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SleepEntry {
  id: string;
  /** ISO timestamps (UTC in DB, but stored locally as full ISO strings) */
  startTime: string;
  endTime: string;
  /** 1–5 quality rating */
  quality: number | null;
  /** morning mood label */
  mood: string | null;
  /** night wake-ups */
  interruptions: number;
  notes: string;
  /** 'manual' | 'auto' */
  source: string;
}

interface SleepState {
  entries: SleepEntry[];
  /** bedtime reminder hour/min (IST) — user-configurable, null = off */
  reminderTime: { hour: number; minute: number } | null;
  addEntry: (entry: Omit<SleepEntry, 'id'>, userId?: string) => string;
  editEntry: (id: string, data: Partial<SleepEntry>, userId?: string) => void;
  deleteEntry: (id: string, userId?: string) => void;
  setReminderTime: (time: { hour: number; minute: number } | null) => void;
}

function flush() {
  const t = setTimeout(() => {
    try {
      const { processSyncQueue } = require('../../services/syncQueue');
      processSyncQueue().catch((_e: Error) => {});
    } catch (_e) {}
  }, 300);
  // Don't keep the JS env alive just for a sync attempt
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

export function sleepDurationHours(entry: Pick<SleepEntry, 'startTime' | 'endTime'>): number {
  const ms = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
  return Math.max(0, ms / 3600000);
}

/** Format hours as "7h 32m" */
export function formatSleepDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export const useSleepStore = create<SleepState>()(
  persist(
    (set, get) => ({
      entries: [],
      reminderTime: null,

      addEntry: (entry, userId) => {
        const id = Math.random().toString(36).substring(2, 9);
        const full: SleepEntry = {
          id,
          startTime: entry.startTime,
          endTime: entry.endTime,
          quality: entry.quality ?? null,
          mood: entry.mood ?? null,
          interruptions: entry.interruptions ?? 0,
          notes: entry.notes || '',
          source: entry.source || 'manual',
        };
        set((s) => {
          const updated = [...s.entries, full];
          updated.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
          return { entries: updated };
        });
        enq('sleep_logs', 'create', {
          id,
          user_id: userId || null,
          start_time: full.startTime,
          end_time: full.endTime,
          quality: full.quality,
          mood: full.mood,
          interruptions: full.interruptions,
          notes: full.notes,
          source: full.source,
          updated_at: new Date().toISOString(),
        });
        return id;
      },

      editEntry: (id, data, userId) => {
        const current = get().entries.find((e) => e.id === id);
        if (!current) return;
        const merged = { ...current, ...data };
        set((s) => {
          const updated = s.entries.map((e) => (e.id === id ? merged : e));
          updated.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
          return { entries: updated };
        });
        enq('sleep_logs', 'create', {
          id,
          user_id: userId || null,
          start_time: merged.startTime,
          end_time: merged.endTime,
          quality: merged.quality,
          mood: merged.mood,
          interruptions: merged.interruptions,
          notes: merged.notes,
          source: merged.source,
          updated_at: new Date().toISOString(),
        });
      },

      deleteEntry: (id, userId) => {
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
        enq('sleep_logs', 'delete', { id, user_id: userId || null });
      },

      setReminderTime: (time) => {
        // Local-only setting (persisted via AsyncStorage by zustand persist).
        // Not synced to user_settings to avoid schema coupling.
        set({ reminderTime: time });
      },
    }),
    {
      name: 'meridian-sleep-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
