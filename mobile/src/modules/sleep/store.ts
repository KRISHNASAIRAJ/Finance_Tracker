/**
 * SleepStore — Zustand store for sleep logs with offline sync queue support.
 * Mirrors the weightStore pattern: local-first writes + sync queue enqueue.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SLEEP_MOTION_CONFIG, type SleepMotionConfig } from './sleepMotion';

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
  /** 'manual' | 'auto' | 'auto-motion' */
  source: string;
}

/** A session detected by the motion tracker, offered to the user. */
export interface DetectedSleepSession {
  bedTime: number;
  wakeTime: number;
  interruptions: number;
  durationMin: number;
}

interface SleepState {
  entries: SleepEntry[];
  /** bedtime reminder hour/min (IST) — user-configurable, null = off */
  reminderTime: { hour: number; minute: number } | null;
  /** Settings of the automatic (accelerometer) sleep tracker. */
  autoConfig: SleepMotionConfig;
  /** Latest session detected by the motion tracker (not saved yet). */
  autoSession: DetectedSleepSession | null;
  addEntry: (entry: Omit<SleepEntry, 'id'>, userId?: string) => string;
  editEntry: (id: string, data: Partial<SleepEntry>, userId?: string) => void;
  deleteEntry: (id: string, userId?: string) => void;
  setReminderTime: (time: { hour: number; minute: number } | null) => void;
  setAutoConfig: (patch: Partial<SleepMotionConfig>) => void;
  setAutoSession: (session: DetectedSleepSession | null) => void;
}

function flush() {
  const t = setTimeout(() => {
    try {
      const { processSyncQueue } = require('../../services/syncQueue');
      processSyncQueue().catch((_e: Error) => {});
    } catch (_e) { /* no-op */}
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
  } catch (_e) { /* no-op */}
}

/** Refresh the home-screen Clock + Sleep widget (best-effort). */
function refreshWidget() {
  try {
    const { pushSleepWidget } = require('../../services/sleepWidget');
    pushSleepWidget().catch(() => {});
  } catch (_e) { /* no-op */}
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
      autoConfig: { ...DEFAULT_SLEEP_MOTION_CONFIG },
      autoSession: null,

      addEntry: (entry, userId) => {
        // Idempotency guard: a start time (same minute) identifies one sleep
        // session. The widget deep link and the dashboard's SharedPreferences
        // fallback can race to log the same session — keep the first, skip
        // the rest.
        const startMs = new Date(entry.startTime).getTime();
        const dup = get().entries.find(
          (e) => Math.abs(new Date(e.startTime).getTime() - startMs) < 60000
        );
        if (dup) return dup.id;

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
        refreshWidget();
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
        // The rating / times of a night also live on the home-screen widget.
        refreshWidget();
      },

      deleteEntry: (id, userId) => {
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
        enq('sleep_logs', 'delete', { id, user_id: userId || null });
        refreshWidget();
      },

      setReminderTime: (time) => {
        // Local-only setting (persisted via AsyncStorage by zustand persist).
        // Not synced to user_settings to avoid schema coupling.
        set({ reminderTime: time });
      },

      setAutoConfig: (patch) => {
        set((s) => ({ autoConfig: { ...s.autoConfig, ...patch } }));
      },

      setAutoSession: (session) => {
        set({ autoSession: session });
      },
    }),
    {
      name: 'meridian-sleep-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
