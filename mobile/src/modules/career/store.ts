import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CareerEvent {
  id: string;
  name: string;
  date: string;
  type: 'up' | 'down' | 'balance';
  notes: string;
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

interface CareerState {
  events: CareerEvent[];
  addEvent: (event: Omit<CareerEvent, 'id'>, userId?: string) => string;
  editEvent: (id: string, data: Partial<CareerEvent>, userId?: string) => void;
  deleteEvent: (id: string, userId?: string) => void;
}

export const useCareerStore = create<CareerState>()(
  persist(
    (set, get) => ({
      events: [],
      addEvent: (event, userId) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newEvent: CareerEvent = { ...event, id };
        const sorted = [...get().events, newEvent].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        set({ events: sorted });
        enq('career_events', 'create', {
          id, user_id: userId || null, name: newEvent.name,
          date: newEvent.date, type: newEvent.type, notes: newEvent.notes,
          updated_at: new Date().toISOString(),
        });
        return id;
      },
      editEvent: (id, data, userId) => {
        const current = get().events.find((e) => e.id === id);
        if (!current) return;
        const merged = { ...current, ...data };
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? merged : e)).sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          ),
        }));
        enq('career_events', 'create', {
          id, user_id: userId || null, name: merged.name,
          date: merged.date, type: merged.type, notes: merged.notes,
          updated_at: new Date().toISOString(),
        });
      },
      deleteEvent: (id, userId) => {
        set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
        enq('career_events', 'delete', { id, user_id: userId || null });
      },
    }),
    {
      name: 'meridian-career-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
