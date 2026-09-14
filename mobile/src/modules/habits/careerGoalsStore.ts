/**
 * CareerGoalsStore — user-edited career goal overrides (long-press edit).
 * Overrides sync via user_settings.career_goals_json; null = canonical set.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CareerGoalYear } from '../../shared/careerGoals';

interface CareerGoalsState {
  overrides: CareerGoalYear[] | null;
  setOverrides: (goals: CareerGoalYear[] | null, userId?: string) => void;
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

export const useCareerGoalsStore = create<CareerGoalsState>()(
  persist(
    (set) => ({
      overrides: null,

      setOverrides: (goals, userId) => {
        set({ overrides: goals });
        if (!userId) return; // user_settings is user-keyed — nothing to sync signed out
        try {
          const { enqueue } = require('../../services/syncQueue');
          enqueue('user_settings', 'create', {
            user_id: userId,
            career_goals_json: goals ? JSON.stringify(goals) : null,
            updated_at: new Date().toISOString(),
          }).then(flush).catch(() => { /* best-effort */ });
        } catch (_e) { /* best-effort */ }
      },
    }),
    {
      name: 'meridian-career-goals-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
