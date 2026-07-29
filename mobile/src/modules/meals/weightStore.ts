import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
  notes: string;
}

interface WeightState {
  entries: WeightEntry[];
  addEntry: (date: string, weightKg: number, notes: string, userId?: string) => string;
  editEntry: (id: string, data: Partial<WeightEntry>, userId?: string) => void;
  deleteEntry: (id: string, userId?: string) => void;
}

function flush() {
  setTimeout(() => {
    try {
      const { processSyncQueue } = require('../../services/syncQueue');
      processSyncQueue().catch((_e: Error) => {});
    } catch (_e) {}
  }, 300);
}

async function enq(entity: string, action: string, data: Record<string, unknown>) {
  try {
    const { enqueue } = require('../../services/syncQueue');
    await enqueue(entity, action as 'create' | 'update' | 'delete', data);
    flush();
  } catch (_e) {}
}

export const useWeightStore = create<WeightState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (date, weightKg, notes, userId) => {
        const id = Math.random().toString(36).substring(2, 9);
        const entry: WeightEntry = { id, date, weightKg, notes: notes || '' };
        set((s) => {
          const updated = [...s.entries, entry];
          updated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          return { entries: updated };
        });
        enq('weight_logs', 'create', {
          id,
          user_id: userId || null,
          date,
          weight_kg: weightKg,
          notes: notes || '',
          updated_at: new Date().toISOString(),
        });
        return id;
      },

      editEntry: (id, data, userId) => {
        const current = get().entries.find((e) => e.id === id);
        if (!current) return;
        const merged = { ...current, ...data };
        set((s) => ({ entries: s.entries.map((e) => (e.id === id ? merged : e)) }));
        enq('weight_logs', 'create', {
          id,
          user_id: userId || null,
          date: merged.date,
          weight_kg: merged.weightKg,
          notes: merged.notes || '',
          updated_at: new Date().toISOString(),
        });
      },

      deleteEntry: (id, userId) => {
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
        enq('weight_logs', 'delete', { id, user_id: userId || null });
      },
    }),
    {
      name: 'meridian-weight-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
