/**
 * DiaryStore — Zustand store for weekly diary entries with offline sync queue support.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DiaryEntry {
  id: string;
  weekYear: number;
  weekNumber: number;
  content: string;
  updatedAt: string;
}

function flushSyncQueue() {
  setTimeout(() => {
    try {
      const { processSyncQueue } = require('../../services/syncQueue');
      processSyncQueue().catch((e: Error) => console.warn('[DiaryStore] syncQueue flush failed:', e));
    } catch (e) { console.warn('[DiaryStore] flushSyncQueue failed:', e); }
  }, 300);
}

async function enqueueSync(entity: string, action: string, payload: Record<string, unknown>) {
  try {
    const { enqueue } = require('../../services/syncQueue');
    await enqueue(entity, action as 'create' | 'update' | 'delete', payload);
    flushSyncQueue();
  } catch (e) { console.warn('[DiaryStore] enqueueSync failed:', e); }
}

interface DiaryState {
  entries: DiaryEntry[];
  addEntry: (weekYear: number, weekNumber: number, content: string, userId?: string) => void;
  updateEntry: (id: string, content: string, userId?: string) => void;
  deleteEntry: (id: string, userId?: string) => void;
  getEntryByWeek: (weekYear: number, weekNumber: number) => DiaryEntry | undefined;
  lastSyncedAt: string | null;
  setLastSyncedAt: (iso: string) => void;
}

export const useDiaryStore = create<DiaryState>()(
  persist(
    (set, get) => ({
      entries: [],
      lastSyncedAt: null,
      setLastSyncedAt: (iso) => set({ lastSyncedAt: iso }),
      addEntry: (weekYear, weekNumber, content, userId) => {
        const existing = get().entries.find((e) => e.weekYear === weekYear && e.weekNumber === weekNumber);
        if (existing) {
          get().updateEntry(existing.id, content, userId);
          return;
        }
        const id = Math.random().toString(36).substring(2, 9);
        const entry: DiaryEntry = {
          id,
          weekYear,
          weekNumber,
          content,
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ entries: [...state.entries, entry] }));
        enqueueSync('weekly_diary', 'create', {
          id, user_id: userId || null, week_year: weekYear, week_number: weekNumber,
          content, updated_at: entry.updatedAt,
        });
      },
      updateEntry: (id, content, userId) => {
        const updatedAt = new Date().toISOString();
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...e, content, updatedAt } : e)),
        }));
        const entry = get().entries.find((e) => e.id === id);
        if (entry) {
          enqueueSync('weekly_diary', 'create', {
            id: entry.id, user_id: userId || null,
            week_year: entry.weekYear, week_number: entry.weekNumber,
            content, updated_at: updatedAt,
          });
        }
      },
      deleteEntry: (id, userId) => {
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
        enqueueSync('weekly_diary', 'delete', { id, user_id: userId || null });
      },
      getEntryByWeek: (weekYear, weekNumber) => {
        return get().entries.find((e) => e.weekYear === weekYear && e.weekNumber === weekNumber);
      },
    }),
    {
      name: 'meridian-diary-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
