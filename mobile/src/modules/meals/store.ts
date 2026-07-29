import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MealFoodItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealLogEntry {
  id: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  items: MealFoodItem[];
  notes: string;
}

export interface MealAIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  date: string;
}

interface MealState {
  entries: MealLogEntry[];
  aiMessages: MealAIMessage[];
  dailyCalorieTarget: number;
  dailyProteinTarget: number;
  dailyCarbsTarget: number;
  dailyFatTarget: number;
  dailyWaterTarget: number;
  setTargets: (calories: number, protein: number, carbs: number, fat: number, water: number) => void;
  addEntry: (entry: Omit<MealLogEntry, 'id'>, userId?: string) => string;
  editEntry: (id: string, data: Partial<MealLogEntry>, userId?: string) => void;
  deleteEntry: (id: string, userId?: string) => void;
  addAIMessage: (role: 'user' | 'assistant', text: string) => void;
  clearAIChat: () => void;
  getTodayTotals: () => { calories: number; protein: number; carbs: number; fat: number; water: number };
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

export const useMealStore = create<MealState>()(
  persist(
    (set, get) => ({
      entries: [],
      aiMessages: [],
      dailyCalorieTarget: 2650,
      dailyProteinTarget: 130,
      dailyCarbsTarget: 340,
      dailyFatTarget: 85,
      dailyWaterTarget: 2.8,
      setTargets: (calories, protein, carbs, fat, water) => set({ dailyCalorieTarget: calories, dailyProteinTarget: protein, dailyCarbsTarget: carbs, dailyFatTarget: fat, dailyWaterTarget: water }),
      addEntry: (entry, userId) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newEntry: MealLogEntry = { ...entry, id };
        set((s) => ({ entries: [newEntry, ...s.entries] }));
        enq('meal_logs', 'create', {
          id, user_id: userId || null, date: newEntry.date, meal_type: newEntry.mealType,
          items: JSON.stringify(newEntry.items), notes: newEntry.notes,
          updated_at: new Date().toISOString(),
        });
        return id;
      },
      editEntry: (id, data, userId) => {
        const current = get().entries.find((e) => e.id === id);
        if (!current) return;
        const merged = { ...current, ...data };
        set((s) => ({ entries: s.entries.map((e) => (e.id === id ? merged : e)) }));
        enq('meal_logs', 'create', {
          id, user_id: userId || null, date: merged.date, meal_type: merged.mealType,
          items: JSON.stringify(merged.items), notes: merged.notes,
          updated_at: new Date().toISOString(),
        });
      },
      deleteEntry: (id, userId) => {
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
        enq('meal_logs', 'delete', { id, user_id: userId || null });
      },
      addAIMessage: (role, text) => {
        const msg: MealAIMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role,
          text,
          date: new Date().toISOString(),
        };
        set((s) => ({ aiMessages: [...s.aiMessages, msg] }));
      },
      clearAIChat: () => set({ aiMessages: [] }),
      getTodayTotals: () => {
        const today = new Date().toISOString().slice(0, 10);
        const todayEntries = get().entries.filter((e) => e.date.slice(0, 10) === today);
        return todayEntries.reduce(
          (acc, e) => {
            for (const item of e.items) {
              acc.calories += item.calories || 0;
              acc.protein += item.protein || 0;
              acc.carbs += item.carbs || 0;
              acc.fat += item.fat || 0;
            }
            return acc;
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 }
        );
      },
    }),
    {
      name: 'meridian-meal-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
